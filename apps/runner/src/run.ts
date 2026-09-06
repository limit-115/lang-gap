import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  questionSchema,
  safeIdSchema,
  type DatasetManifest,
  type Experiment,
  type ProviderAdapter,
  type Question,
} from "@llang-gap/contracts";
import { createAdapter } from "@llang-gap/providers";
import { getProtocol } from "@llang-gap/evaluation";
import { atomicWrite, hash, implementationIdentity, json, jsonl, workspace } from "./files";
import { createJobs } from "./plan";
import { execute } from "./scheduler";
import { acquireLock, RunState } from "./state";
import { readSnapshot, type Snapshot } from "./snapshot";

export const runsDirectory = join(workspace, ".llang-gap/runs");
export function runPath(id: string) {
  return join(runsDirectory, safeIdSchema.parse(id));
}
export async function readRunQuestions(
  directory: string,
  expectedHash: string,
): Promise<Question[]> {
  const text = await readFile(join(directory, "dataset.jsonl"), "utf8");
  if (hash(text) !== expectedHash) throw new Error("Run dataset snapshot checksum mismatch");
  return text
    .trimEnd()
    .split("\n")
    .map((line) => questionSchema.parse(JSON.parse(line)));
}

interface ExecutionControls {
  budgetUsd: number;
  concurrency?: number;
  maxJobs?: number;
  signal?: AbortSignal;
  onProgress?: Parameters<typeof execute>[0]["onProgress"];
}

export async function createRun(
  options: ExecutionControls & {
    experiment: Experiment;
    questions: Question[];
    manifest: DatasetManifest;
    directory?: string;
    adapters?: ReadonlyMap<string, ProviderAdapter>;
  },
) {
  const { experiment, questions, manifest, budgetUsd } = options;
  const protocol = getProtocol(experiment.protocol);
  const runId = `${experiment.id}-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`;
  const directory = options.directory ?? runPath(runId);
  const adapters =
    options.adapters ??
    new Map(
      experiment.models.map((model) => [
        model.provider,
        createAdapter(model, experiment.execution.timeoutMs),
      ]),
    );
  const dataset = jsonl(questions);
  const snapshot: Snapshot = {
    schemaVersion: 1,
    runId,
    createdAt: new Date().toISOString(),
    experiment,
    datasetManifest: manifest,
    datasetHash: hash(dataset),
    protocolHash: hash(json(protocol)),
    protocol,
    implementation: await implementationIdentity(workspace),
    node: process.version,
    initialBudgetUsd: budgetUsd,
    providerMetadata: [...adapters.values()].map((a) => ({
      provider: a.name,
      sdkVersion: a.sdkVersion,
      endpoint: a.endpoint,
    })),
  };
  const configHash = hash(json(snapshot));
  const jobs = createJobs(experiment, questions, configHash);
  if (!jobs.length) throw new Error("Empty experiment");
  await mkdir(join(directory, ".."), { recursive: true });
  await mkdir(directory, { mode: 0o700 });
  const releaseLock = await acquireLock(directory);
  let state: RunState | undefined;
  try {
    await atomicWrite(join(directory, "resolved.json"), json(snapshot));
    await atomicWrite(join(directory, "identity.json"), json({ configHash }));
    await atomicWrite(join(directory, "dataset.jsonl"), dataset);
    state = new RunState(join(directory, "state.sqlite"));
    state.initialize(jobs);
    state.event("created", { runId, configHash, budgetUsd });
    const summary = await execute({
      state,
      jobs,
      adapters,
      budgetUsd,
      concurrency: options.concurrency ?? experiment.execution.concurrency,
      maxAttempts: experiment.execution.maxAttempts,
      ...(options.maxJobs === undefined ? {} : { maxJobs: options.maxJobs }),
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.onProgress ? { onProgress: options.onProgress } : {}),
    });
    return { runId, directory, ...summary };
  } finally {
    state?.close();
    await releaseLock();
  }
}

export async function resumeRun(
  directory: string,
  options: ExecutionControls & {
    retryUncertain?: boolean;
    retryFailed?: boolean;
    maxAttempts?: number;
    adapters?: ReadonlyMap<string, ProviderAdapter>;
  },
) {
  await stat(join(directory, "state.sqlite"));
  const releaseLock = await acquireLock(directory);
  let state: RunState | undefined;
  try {
    const { snapshot, configHash } = await readSnapshot(directory);
    const current = await implementationIdentity(workspace);
    if (current.sha256 !== snapshot.implementation.sha256)
      throw new Error(
        "Runner source or dependency lock changed; restore the recorded implementation before resuming",
      );
    const questions = await readRunQuestions(directory, snapshot.datasetHash);
    const jobs = createJobs(snapshot.experiment, questions, configHash);
    state = new RunState(join(directory, "state.sqlite"));
    state.assertJobs(jobs);
    const maxAttempts = options.maxAttempts ?? snapshot.experiment.execution.maxAttempts;
    state.recover(options.retryUncertain ?? false, maxAttempts, options.retryFailed ?? false);
    const adapters =
      options.adapters ??
      new Map(
        snapshot.experiment.models.map((model) => [
          model.provider,
          createAdapter(model, snapshot.experiment.execution.timeoutMs),
        ]),
      );
    const concurrency = options.concurrency ?? snapshot.experiment.execution.concurrency;
    state.event("resumed", { budgetUsd: options.budgetUsd, concurrency, maxAttempts });
    return {
      runId: snapshot.runId,
      ...(await execute({
        state,
        jobs,
        adapters,
        budgetUsd: options.budgetUsd,
        concurrency,
        maxAttempts,
        ...(options.maxJobs === undefined ? {} : { maxJobs: options.maxJobs }),
        ...(options.signal ? { signal: options.signal } : {}),
        ...(options.onProgress ? { onProgress: options.onProgress } : {}),
      })),
    };
  } finally {
    state?.close();
    await releaseLock();
  }
}
