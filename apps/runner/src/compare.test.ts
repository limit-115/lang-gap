import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  datasetManifestSchema,
  experimentSchema,
  releaseManifestSchema,
  type Question,
} from "@llang-gap/contracts";
import { createFakeAdapter } from "@llang-gap/providers";
import { pairedDifference } from "@llang-gap/evaluation";
import { createRun } from "./run";
import { compareRuns } from "./compare";
import { buildRelease, scoreRun, verifyRelease } from "./release";
import { hash, json, jsonl, readJson } from "./files";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "llang-compare-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});
const languages = ["de", "ja"];
const questions: Question[] = languages.flatMap((language) =>
  [1, 2].map((id) => ({
    id: `q${id}`,
    sourceId: id,
    language,
    split: "test",
    category: "arithmetic",
    question: `${language}: ${id} + ${id}?`,
    options: [String(2 * id), "0"],
    answer: "A",
    cot: "PRIVATE_SOLUTION",
  })),
);
const fake = createFakeAdapter();
const generate = vi.fn(async (request: Parameters<typeof fake.generate>[0]) => ({
  ...(await fake.generate(request)),
  text: request.model.endsWith(":free") ? "A" : "B",
}));
async function run(
  name: string,
  options: {
    dataset?: string;
    languages?: string[];
    models?: string[];
    cap?: number;
    repeats?: number;
    questionLimit?: number;
    maxJobs?: number;
    promptSuffix?: string;
    questions?: Question[];
    truncated?: boolean;
  } = {},
) {
  const dataset = options.dataset ?? "arithmetic-fixture";
  const manifest = datasetManifestSchema.parse({
    schemaVersion: 2,
    id: dataset,
    repository: `fixtures/${dataset}`,
    revision: "a".repeat(40),
    normalizerVersion: 1,
    format: "normalized-jsonl",
    license: "Synthetic only",
    source: "https://example.org/fixtures",
    prompts: Object.fromEntries(
      languages.map((language) => [
        language,
        { instruction: `Answer ${language}: A or B`, question: "Q:", options: "Options:" },
      ]),
    ),
    files: languages.map((language) => ({
      language,
      path: `${language}/test.jsonl`,
      split: "test",
      rows: 2,
      sha256: hash(jsonl(questions.filter((q) => q.language === language))),
    })),
  });
  const config = experimentSchema.parse({
    schemaVersion: 3,
    id: name,
    dataset,
    protocol: "multiple-choice-v1",
    languages: options.languages ?? languages,
    repeats: options.repeats ?? 2,
    seed: 42,
    questionLimit: options.questionLimit,
    models: (options.models ?? ["fixtures/a:free", "fixtures/b"]).map((model) => ({
      transport: "openrouter",
      model,
      efforts: ["max"],
      maxOutputTokens: options.cap ?? 1024,
    })),
    execution: { concurrency: 2, maxAttempts: 1, timeoutMs: 1000 },
  });
  const directory = join(root, name);
  await createRun({
    directory,
    experiment: config,
    questions: (options.questions ?? questions)
      .filter((q) => config.languages.includes(q.language))
      .map((q) => ({ ...q, question: q.question + (options.promptSuffix ?? "") })),
    manifest,
    adapters: new Map([
      [
        "openrouter",
        {
          ...fake,
          transport: "openrouter",
          generate: async (request) => ({
            ...(await generate(request)),
            ...(options.truncated ? { outcome: "truncated" as const } : {}),
          }),
        },
      ],
    ]),
    ...(options.maxJobs === undefined ? {} : { maxJobs: options.maxJobs }),
  });
  return directory;
}

it("compares saved models and languages without predeclared pairs and preserves run inputs", async () => {
  const directory = await run("matrix");
  const snapshot = await readFile(join(directory, "resolved.json"), "utf8");
  const calls = generate.mock.calls.length;
  const result = await compareRuns([directory], { id: "matrix-analysis", outputRoot: root });
  expect(result.report.conditions).toHaveLength(4);
  expect(result.report.comparisons).toHaveLength(6);
  expect(result.report.incompatible).toEqual([]);
  for (const pair of result.report.comparisons) {
    const a = result.report.conditions.find((row) => row.id === pair.baseline)!;
    const b = result.report.conditions.find((row) => row.id === pair.candidate)!;
    expect(pair.gapPp).toBe(100 * (a.accuracy - b.accuracy));
    expect(pair.gapCi95).toEqual([pair.gapPp, pair.gapPp]);
    expect(pair.n).toBe(2);
  }
  expect(await readJson(result.path)).toEqual(result.report);
  expect(await readFile(join(directory, "resolved.json"), "utf8")).toBe(snapshot);
  expect(generate.mock.calls.length).toBe(calls);
  await expect(
    compareRuns([directory], { id: "matrix-analysis", outputRoot: root }),
  ).rejects.toThrow("EEXIST");
  await expect(
    compareRuns([directory], { selection: { models: ["missing"] }, outputRoot: root }),
  ).rejects.toThrow("No saved conditions");
});

it.each(["arithmetic-fixture", "another-fixture"])(
  "compares separate single-language runs for %s deterministically",
  async (dataset) => {
    const a = await run("first", { dataset, languages: ["ja"], models: ["fixtures/a:free"] });
    const b = await run("second", { dataset, languages: ["de"], models: ["fixtures/b"] });
    const options = {
      outputRoot: root,
      seed: 17,
      selection: { efforts: ["max" as const], languages: ["de", "ja"] },
    };
    const forward = await compareRuns([a, b], options);
    const reverse = await compareRuns([b, a], options);
    expect(forward.report.comparisons).toHaveLength(1);
    expect(forward.report.comparisons).toEqual(reverse.report.comparisons);
    expect(forward.report.sources).toEqual(reverse.report.sources);
    expect(forward.report.conditions).toEqual(reverse.report.conditions);
    expect(
      forward.report.conditions.every(
        (row) => row.n === 2 && row.repeats === 2 && row.costUsd === null,
      ),
    ).toBe(true);
  },
);

it("compares matching saved inputs with partially overlapping language selections", async () => {
  const a = await run("first", { languages: ["ja"], models: ["fixtures/a:free"] });
  const b = await run("second", { models: ["fixtures/b"] });
  const result = await compareRuns([a, b], { outputRoot: root });
  expect(result.report.sources[0]!.datasetHash).not.toBe(result.report.sources[1]!.datasetHash);
  expect(result.report.conditions).toHaveLength(3);
  expect(result.report.comparisons).toHaveLength(3);
  expect(result.report.incompatible).toEqual([]);
});

it.each(["question", "options"] as const)(
  "rejects cross-run language pairs when saved %s text differs under the same manifest",
  async (field) => {
    const a = await run("first", { models: ["fixtures/a:free"] });
    const b = await run("second", {
      models: ["fixtures/b"],
      questions: questions.map((question) =>
        question.language !== "de"
          ? question
          : {
              ...question,
              ...(field === "question"
                ? { question: `${question.question} changed` }
                : { options: question.options.map((option) => `${option} changed`) }),
            },
      ),
    });
    const result = await compareRuns([a, b], { outputRoot: root });
    expect(result.report.sources[0]!.manifestHash).toBe(result.report.sources[1]!.manifestHash);
    expect(result.report.sources[0]!.datasetHash).not.toBe(result.report.sources[1]!.datasetHash);
    expect(result.report.comparisons).toHaveLength(2);
    const conditions = new Map(
      result.report.conditions.map((condition) => [condition.id, condition]),
    );
    for (const pair of result.report.comparisons)
      expect(conditions.get(pair.baseline)!.runId).toBe(conditions.get(pair.candidate)!.runId);
    expect(result.report.incompatible).toHaveLength(4);
    expect(
      result.report.incompatible.every(
        (pair) => pair.reason === "Different saved dataset inputs: de",
      ),
    ).toBe(true);
  },
);

it.each([
  [{ dataset: "different" }, "dataset"],
  [{ cap: 2048 }, "token caps"],
  [{ repeats: 1 }, "repeat counts"],
  [{ questionLimit: 1 }, "Questions are not aligned"],
  [{ promptSuffix: " changed" }, "saved dataset inputs"],
] as const)("reports incompatible pairs without intersection: %j", async (change, reason) => {
  const baseline = { languages: ["ja"], models: ["fixtures/a:free"] };
  const a = await run("first", baseline);
  const b = await run("second", { ...baseline, ...change });
  const result = await compareRuns([a, b], { outputRoot: root });
  expect(result.report.comparisons).toEqual([]);
  expect(result.report.incompatible).toHaveLength(1);
  expect(result.report.incompatible[0]!.reason).toContain(reason);
});

it("rejects incomplete sources and analyzes truncated responses without releasing them", async () => {
  const partial = await run("partial", { maxJobs: 1 });
  await expect(compareRuns([partial], { outputRoot: root })).rejects.toThrow("completed runs");
  const truncated = await run("truncated", { truncated: true });
  expect((await compareRuns([truncated], { outputRoot: root })).report.comparisons).toHaveLength(6);
  expect((await scoreRun(truncated)).aggregate).toHaveLength(2);
  await expect(buildRelease(truncated, "truncated-release", "test", root)).rejects.toThrow(
    "Truncation",
  );
});

it("publishes post-run language comparisons with a separate reproducible analysis file", async () => {
  const directory = await run("release-source");
  const snapshot = await readFile(join(directory, "resolved.json"), "utf8");
  const comparisons = [{ baseline: "ja", language: "de" }];
  const scored = await scoreRun(directory, comparisons);
  expect(scored.aggregate.every((row) => row.comparisons[0]?.baseline === "ja")).toBe(true);
  const artifact = await buildRelease(directory, "post-run", "test", root, comparisons);
  expect((await verifyRelease(artifact.directory)).comparisons).toEqual(comparisons);
  expect(await readFile(join(directory, "resolved.json"), "utf8")).toBe(snapshot);
  expect(JSON.parse(snapshot).experiment.comparisons).toEqual([]);
  const changed = json({ schemaVersion: 1, comparisons: [{ baseline: "de", language: "ja" }] });
  await writeFile(join(artifact.directory, "analysis.json"), changed);
  const manifest = releaseManifestSchema.parse(
    await readJson(join(artifact.directory, "manifest.json")),
  );
  manifest.files["analysis.json"] = hash(changed);
  await writeFile(join(artifact.directory, "manifest.json"), json(manifest));
  await expect(verifyRelease(artifact.directory)).rejects.toThrow("provenance mismatch");
});

it("clusters repeats by question and keeps bootstrap results independent of item order", () => {
  const a = new Map([
    ["q1", 1],
    ["q2", 0.5],
    ["q3", 0],
  ]);
  const b = new Map([
    ["q1", 0],
    ["q2", 0.5],
    ["q3", 1],
  ]);
  const result = pairedDifference(a, b, 42);
  expect(result).toMatchObject({ n: 3, gapPp: 0 });
  expect(result.gapCi95[0]).toBeLessThan(0);
  expect(result.gapCi95[1]).toBeGreaterThan(0);
  expect(pairedDifference(new Map([...a].reverse()), b, 42)).toEqual(result);
  expect(() => pairedDifference(a, new Map([["q1", 0]]), 42)).toThrow("aligned");
});

it("does not accumulate fractional correctness beyond the probability bounds", async () => {
  const directory = await run("nine-repeats", { repeats: 9 });
  const result = await compareRuns([directory], { outputRoot: root });
  expect(result.report.comparisons.every((pair) => pair.gapPp === 0 || pair.gapPp === 100)).toBe(
    true,
  );
});
