import { mkdir, readFile, readdir, rename, rm, stat, writeFile, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  itemResultSchema,
  releaseManifestSchema,
  safeIdSchema,
  type ItemResult,
} from "@llang-gap/contracts";
import { aggregateResults, scoreAnswer } from "@llang-gap/evaluation";
import { validateDataset } from "@llang-gap/datasets";
import { calculateCost } from "@llang-gap/providers";
import {
  atomicWrite,
  hash,
  implementationIdentity,
  json,
  jsonl,
  readJson,
  workspace,
} from "./files";
import { createJobs } from "./plan";
import { readRunQuestions } from "./run";
import { readSnapshot } from "./snapshot";
import { acquireLock, RunState } from "./state";
import { verifyAttemptLedger } from "./release-audit";

export async function recompute(directory: string, items: ItemResult[], benchmark: boolean) {
  const { snapshot, configHash } = await readSnapshot(directory);
  if ((await implementationIdentity(workspace)).sha256 !== snapshot.implementation.sha256)
    throw new Error(
      "Scoring implementation differs from this run; restore the recorded source and runtime dependencies",
    );
  const questions = await readRunQuestions(directory, snapshot.datasetHash);
  if (benchmark) {
    validateDataset(questions);
    if (
      snapshot.experiment.questionLimit ||
      snapshot.experiment.models.some((m) => m.provider === "fake")
    )
      throw new Error("Synthetic or subset runs cannot become benchmark releases");
    if (!snapshot.implementation.commit || !snapshot.implementation.clean)
      throw new Error("Benchmark runs must start from a clean committed source tree");
  }
  const jobs = createJobs(snapshot.experiment, questions, configHash);
  const byId = new Map(items.map((item) => [item.jobId, item]));
  if (items.length !== jobs.length || byId.size !== items.length)
    throw new Error("Incomplete or duplicate release matrix");
  const rescored = jobs.map((job) => {
    const item = byId.get(job.id);
    if (
      !item ||
      item.questionId !== job.questionId ||
      item.language !== job.request.language ||
      item.model !== job.model.model ||
      item.effort !== job.request.effort ||
      item.repeat !== job.repeat ||
      item.provider !== job.model.provider ||
      item.expected !== job.expected ||
      item.prompt !== job.request.prompt ||
      item.category !== job.category
    )
      throw new Error(`Result/configuration mismatch: ${job.id}`);
    if (item.outcome === "truncated") throw new Error("Truncation blocks release");
    const score = scoreAnswer(
      item.output,
      item.language,
      job.expected,
      job.optionCount,
      item.outcome,
      snapshot.experiment.protocol,
    );
    const costUsd = item.usage ? calculateCost(item.usage, job.model.pricing) : null;
    if (score.answer !== item.answer || score.correct !== item.correct || costUsd !== item.costUsd)
      throw new Error(`Saved score or cost does not reproduce: ${job.id}`);
    return { ...item, ...score, costUsd };
  });
  return {
    snapshot,
    configHash,
    jobs,
    items: rescored,
    aggregate: aggregateResults(rescored, snapshot.experiment.seed),
  };
}

export async function scoreRun(directory: string) {
  await stat(join(directory, "state.sqlite"));
  const releaseLock = await acquireLock(directory);
  const state = new RunState(join(directory, "state.sqlite"));
  try {
    const summary = state.summary();
    if (summary.completed !== summary.total || !summary.total)
      throw new Error("Run is incomplete; use status or resume");
    const scored = await recompute(directory, state.results(), false);
    await atomicWrite(join(directory, "aggregate.json"), json(scored.aggregate));
    return { aggregate: scored.aggregate, summary };
  } finally {
    state.close();
    await releaseLock();
  }
}

const csv = (rows: ReturnType<typeof aggregateResults>) => {
  const header =
    "provider,model,effort,n,repeats,accuracy_en,accuracy_ru,gap_pp,ci95_low_pp,ci95_high_pp";
  return `${header}\n${rows.map((r) => [r.provider, r.model, r.effort, r.n, r.repeats, r.en, r.ru, r.gapPp, ...r.gapCi95].join(",")).join("\n")}\n`;
};

export async function buildRelease(
  directory: string,
  id: string,
  kind: "benchmark" | "test",
  outputRoot = join(workspace, ".llang-gap/releases"),
) {
  safeIdSchema.parse(id);
  await stat(join(directory, "state.sqlite"));
  const releaseLock = await acquireLock(directory);
  const state = new RunState(join(directory, "state.sqlite"));
  const target = join(outputRoot, id);
  const temp = join(outputRoot, `.${id}-${randomUUID()}.tmp`);
  try {
    const summary = state.summary();
    if (!summary.total || summary.total !== summary.completed)
      throw new Error("Incomplete run cannot be released");
    const scored = await recompute(directory, state.results(), kind === "benchmark");
    await mkdir(outputRoot, { recursive: true });
    try {
      await stat(target);
      throw new Error(`Release already exists: ${id}`);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    await mkdir(temp);
    const assets: Record<string, string> = {
      "resolved.json": await readFile(join(directory, "resolved.json"), "utf8"),
      "identity.json": await readFile(join(directory, "identity.json"), "utf8"),
      "dataset.jsonl": await readFile(join(directory, "dataset.jsonl"), "utf8"),
      "dataset-manifest.json": json(scored.snapshot.datasetManifest),
      "items.jsonl": jsonl(scored.items),
      "aggregate.json": json(scored.aggregate),
      "aggregate.csv": csv(scored.aggregate),
      "attempts.jsonl": jsonl(state.audit()),
      "execution.json": json({
        summary,
        events: state.db.prepare("SELECT created_at,kind,detail FROM events ORDER BY id").all(),
      }),
      "ATTRIBUTION.md":
        "# Source attribution\n\nDataset: li-lab/MMLU-ProX-Lite, MIT per its dataset card.\nhttps://huggingface.co/datasets/li-lab/MMLU-ProX-Lite\n\nPrompts adapted from EleutherAI/lm-evaluation-harness (MIT).\nSee resolved.json for pinned revisions and protocol differences.\n\n" +
        (await readFile(join(workspace, "packages/evaluation/reference/LICENSE.md"), "utf8")),
    };
    const files: Record<string, string> = {};
    for (const [name, content] of Object.entries(assets)) {
      await writeFile(join(temp, name), content, { flag: "wx" });
      files[name] = hash(content);
    }
    const manifest = releaseManifestSchema.parse({
      schemaVersion: 1,
      id,
      runId: scored.snapshot.runId,
      kind,
      createdAt: new Date().toISOString(),
      dataset: scored.snapshot.experiment.dataset,
      datasetRevision: scored.snapshot.datasetManifest.revision,
      protocol: scored.snapshot.experiment.protocol,
      configHash: scored.configHash,
      files,
      aggregate: scored.aggregate,
    });
    await writeFile(join(temp, "manifest.json"), json(manifest), { flag: "wx" });
    await verifyRelease(temp);
    await rename(temp, target);
    return { id, kind, directory: target, files: Object.keys(files).length };
  } finally {
    state.close();
    await releaseLock();
    await rm(temp, { recursive: true, force: true });
  }
}

export async function verifyRelease(directory: string) {
  const manifest = releaseManifestSchema.parse(await readJson(join(directory, "manifest.json")));
  const required = [
    "resolved.json",
    "identity.json",
    "dataset.jsonl",
    "dataset-manifest.json",
    "items.jsonl",
    "aggregate.json",
    "aggregate.csv",
    "attempts.jsonl",
    "execution.json",
    "ATTRIBUTION.md",
  ];
  const actual = (await readdir(directory)).sort();
  if (
    JSON.stringify(actual) !== JSON.stringify([...required, "manifest.json"].sort()) ||
    JSON.stringify(Object.keys(manifest.files).sort()) !== JSON.stringify(required.sort())
  )
    throw new Error("Unexpected release asset set");
  for (const [name, checksum] of Object.entries(manifest.files)) {
    if (!required.includes(name) || hash(await readFile(join(directory, name))) !== checksum)
      throw new Error(`Release checksum mismatch: ${name}`);
  }
  const items = (await readFile(join(directory, "items.jsonl"), "utf8"))
    .trimEnd()
    .split("\n")
    .map((line) => itemResultSchema.parse(JSON.parse(line)));
  const recomputed = await recompute(directory, items, manifest.kind === "benchmark");
  if (
    json(await readJson(join(directory, "dataset-manifest.json"))) !==
    json(recomputed.snapshot.datasetManifest)
  )
    throw new Error("Dataset manifest differs from the resolved snapshot");
  await verifyAttemptLedger(directory, recomputed.jobs, recomputed.items);
  if (
    manifest.configHash !== recomputed.configHash ||
    manifest.runId !== recomputed.snapshot.runId ||
    manifest.dataset !== recomputed.snapshot.experiment.dataset ||
    manifest.datasetRevision !== recomputed.snapshot.datasetManifest.revision ||
    manifest.protocol !== recomputed.snapshot.experiment.protocol
  )
    throw new Error("Release provenance mismatch");
  if (
    json(manifest.aggregate) !== json(recomputed.aggregate) ||
    (await readFile(join(directory, "aggregate.json"), "utf8")) !== json(recomputed.aggregate) ||
    (await readFile(join(directory, "aggregate.csv"), "utf8")) !== csv(recomputed.aggregate)
  )
    throw new Error("Release aggregates do not reproduce");
  return manifest;
}

export async function stageRelease(directory: string, assetsUrl: string) {
  const baseUrl = z.url().parse(assetsUrl).replace(/\/$/, "");
  if (!baseUrl.startsWith("https://"))
    throw new Error("Public artifacts require an HTTPS base URL");
  const manifest = await verifyRelease(directory);
  if (manifest.kind !== "benchmark") throw new Error("Test releases cannot enter the public index");
  const root = join(workspace, "results");
  const target = join(root, manifest.id);
  const releaseLock = await acquireLock(root);
  try {
    await mkdir(target);
    try {
      await copyFile(join(directory, "manifest.json"), join(target, "manifest.json"));
      await copyFile(join(directory, "aggregate.json"), join(target, "aggregate.json"));
      await atomicWrite(join(target, "assets.json"), json({ baseUrl }));
      const index = z
        .strictObject({
          schemaVersion: z.literal(1),
          latest: z.string().nullable(),
          releases: z.array(z.string()),
        })
        .parse(await readJson(join(root, "index.json")));
      if (index.releases.includes(manifest.id)) throw new Error("Release already indexed");
      await atomicWrite(
        join(root, "index.json"),
        json({ ...index, latest: manifest.id, releases: [manifest.id, ...index.releases] }),
      );
    } catch (error) {
      await rm(target, { recursive: true, force: true });
      throw error;
    }
  } finally {
    await releaseLock();
  }
  return { id: manifest.id, directory: target };
}
