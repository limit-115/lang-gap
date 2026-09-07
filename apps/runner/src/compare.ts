import { randomUUID } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  analysisReportSchema,
  analysisSelectionSchema,
  type AnalysisCondition,
  type AnalysisReport,
  type AnalysisSelection,
  type ItemResult,
} from "@llang-gap/contracts";
import { aggregateResults, pairedDifference } from "@llang-gap/evaluation";
import { hash, json, jsonl, workspace } from "./files";
import { recompute } from "./release";
import { acquireLock, RunState } from "./state";

async function readAnalysisRun(directory: string) {
  await stat(join(directory, "state.sqlite"));
  const unlock = await acquireLock(directory);
  let state: RunState | undefined;
  try {
    state = new RunState(join(directory, "state.sqlite"));
    const summary = state.summary();
    if (!summary.total || summary.completed !== summary.total)
      throw new Error("Comparison requires completed runs; use status or resume");
    const run = await recompute(directory, state.results(), false, {
      comparisons: [],
      allowTruncated: true,
    });
    state.assertJobs(run.jobs);
    return run;
  } finally {
    state?.close();
    await unlock();
  }
}

interface ConditionData {
  condition: AnalysisCondition;
  source: AnalysisReport["sources"][number];
  datasetSignatures: ReadonlyMap<string, string>;
  questionSignature: string;
  promptSignature: string;
  scores: ReadonlyMap<string, number>;
}
function incompatible(a: ConditionData, b: ConditionData): string | null {
  if (a.source.dataset !== b.source.dataset || a.source.manifestHash !== b.source.manifestHash)
    return "Different dataset identity, revision or manifest inputs";
  // Whole-snapshot hashes also change when the selected languages change. Check
  // every shared language, including inputs outside the selected analysis pair.
  if (a.source.datasetHash !== b.source.datasetHash)
    for (const [language, signature] of a.datasetSignatures) {
      const other = b.datasetSignatures.get(language);
      if (other !== undefined && signature !== other)
        return `Different saved dataset inputs: ${language}`;
    }
  if (a.source.protocolHash !== b.source.protocolHash) return "Different protocol inputs";
  if (a.condition.maxOutputTokens !== b.condition.maxOutputTokens) return "Different token caps";
  if (a.condition.repeats !== b.condition.repeats) return "Different repeat counts";
  if ((a.condition.transport === "fake") !== (b.condition.transport === "fake"))
    return "Synthetic and live conditions cannot be compared";
  if (a.questionSignature !== b.questionSignature)
    return "Questions are not aligned: IDs, categories, gold labels or option counts differ";
  if (a.condition.language === b.condition.language && a.promptSignature !== b.promptSignature)
    return "Same-language prompt inputs differ";
  return null;
}

export async function compareRuns(
  directories: readonly string[],
  options: {
    id?: string;
    seed?: number;
    selection?: AnalysisSelection;
    outputRoot?: string;
  } = {},
) {
  if (!directories.length || new Set(directories).size !== directories.length)
    throw new Error("Provide unique run IDs for comparison");
  const selection = analysisSelectionSchema.parse(options.selection ?? {});
  const sources: AnalysisReport["sources"] = [];
  const conditions: ConditionData[] = [];
  for (const directory of directories) {
    const run = await readAnalysisRun(directory);
    const { snapshot } = run;
    if (sources.some((source) => source.runId === snapshot.runId))
      throw new Error("Duplicate source run identity");
    const source = {
      runId: snapshot.runId,
      configHash: run.configHash,
      dataset: snapshot.experiment.dataset,
      datasetHash: snapshot.datasetHash,
      manifestHash: hash(json(snapshot.datasetManifest)),
      protocolHash: snapshot.protocolHash,
      itemsHash: hash(jsonl([...run.items].sort((a, b) => a.jobId.localeCompare(b.jobId)))),
    };
    sources.push(source);
    const datasetSignatures = new Map(
      snapshot.experiment.languages.map((language) => [
        language,
        hash(
          jsonl(
            run.questions
              .filter((question) => question.language === language)
              .sort((a, b) => json([a.split, a.id]).localeCompare(json([b.split, b.id]))),
          ),
        ),
      ]),
    );
    const groups = new Map<string, ItemResult[]>();
    for (const item of run.items) {
      if (
        (selection.models && !selection.models.includes(item.model)) ||
        (selection.transports && !selection.transports.includes(item.transport)) ||
        (selection.efforts && !selection.efforts.includes(item.effort)) ||
        (selection.languages && !selection.languages.includes(item.language))
      )
        continue;
      const key = json([item.transport, item.model, item.effort, item.language]);
      const group = groups.get(key) ?? [];
      group.push(item);
      groups.set(key, group);
    }
    const jobs = new Map(run.jobs.map((job) => [job.id, job]));
    for (const group of groups.values()) {
      const first = group[0]!;
      const aggregate = aggregateResults(group, snapshot.experiment.seed, 10_000, {
        languages: [first.language],
        comparisons: [],
      })[0]!;
      const score = aggregate.scores[0]!;
      const unique = group
        .filter((item) => item.repeat === 0)
        .sort((a, b) => a.questionId.localeCompare(b.questionId));
      const totals = new Map<string, number>();
      for (const item of group)
        totals.set(item.questionId, (totals.get(item.questionId) ?? 0) + Number(item.correct));
      const condition = {
        id: hash(
          json([snapshot.runId, first.transport, first.model, first.effort, first.language]),
        ),
        runId: snapshot.runId,
        transport: first.transport,
        model: first.model,
        effort: first.effort,
        maxOutputTokens: jobs.get(first.jobId)!.request.maxOutputTokens,
        repeats: aggregate.repeats,
        ...score,
        costUsd: aggregate.costUsd,
      };
      conditions.push({
        condition,
        source,
        datasetSignatures,
        questionSignature: hash(
          json(
            unique.map((item) => [
              item.questionId,
              item.category,
              item.expected,
              jobs.get(item.jobId)!.optionCount,
            ]),
          ),
        ),
        promptSignature: hash(json(unique.map((item) => [item.questionId, item.prompt]))),
        scores: new Map([...totals].map(([id, total]) => [id, total / aggregate.repeats])),
      });
    }
  }
  if (!conditions.length) throw new Error("No saved conditions match the requested filters");
  const filterKeys = {
    models: "model",
    efforts: "effort",
    languages: "language",
    transports: "transport",
  } as const;
  for (const key of Object.keys(filterKeys) as (keyof typeof filterKeys)[])
    for (const value of selection[key] ?? [])
      if (!conditions.some(({ condition }) => condition[filterKeys[key]] === value))
        throw new Error(`No saved condition matches ${key}: ${value}`);
  sources.sort((a, b) => a.runId.localeCompare(b.runId));
  conditions.sort((a, b) =>
    json([
      a.condition.runId,
      a.condition.transport,
      a.condition.model,
      a.condition.effort,
      a.condition.language,
    ]).localeCompare(
      json([
        b.condition.runId,
        b.condition.transport,
        b.condition.model,
        b.condition.effort,
        b.condition.language,
      ]),
    ),
  );
  const seed = options.seed ?? 42;
  const comparisons: AnalysisReport["comparisons"] = [];
  const excluded: AnalysisReport["incompatible"] = [];
  for (let i = 0; i < conditions.length; i++) {
    for (let j = i + 1; j < conditions.length; j++) {
      const a = conditions[i]!;
      const b = conditions[j]!;
      const pair = { baseline: a.condition.id, candidate: b.condition.id };
      const reason = incompatible(a, b);
      if (reason) excluded.push({ ...pair, reason });
      else comparisons.push({ ...pair, ...pairedDifference(a.scores, b.scores, seed) });
    }
  }
  const report = analysisReportSchema.parse({
    schemaVersion: 1,
    id:
      options.id ??
      `comparison-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    method: "post-hoc-paired-question-bootstrap",
    seed,
    samples: 10_000,
    selection,
    sources,
    conditions: conditions.map(({ condition }) => condition),
    comparisons,
    incompatible: excluded,
  });
  const root = options.outputRoot ?? join(workspace, ".llang-gap/analyses");
  await mkdir(root, { recursive: true });
  const path = join(root, `${report.id}.json`);
  await writeFile(path, json(report), { flag: "wx", mode: 0o600 });
  return { path, report };
}
