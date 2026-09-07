import { validateManifestQuestions } from "@llang-gap/datasets";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  experimentSchema,
  questionSchema,
  safeIdSchema,
  type DatasetManifest,
  type Experiment,
  type TransportAdapter,
  type Question,
} from "@llang-gap/contracts";
import { createAdapter, validateModel } from "@llang-gap/providers";
import { getProtocol } from "@llang-gap/evaluation";
import { atomicWrite, hash, implementationIdentity, json, jsonl, workspace } from "./files";
import { createJobs } from "./plan";
import { execute, validateBudget } from "./scheduler";
import { acquireLock, RunState } from "./state";
import { readSnapshot, type Snapshot } from "./snapshot";
import { logger } from "./logging";

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
  budgetUsd?: number | null;
  concurrency?: number;
  maxJobs?: number;
  signal?: AbortSignal;
  onProgress?: Parameters<typeof execute>[0]["onProgress"];
  onReady?: (runId: string, directory: string) => Promise<void>;
}

export async function createRun(
  options: ExecutionControls & {
    experiment: Experiment;
    questions: Question[];
    manifest: DatasetManifest;
    directory?: string;
    adapters?: ReadonlyMap<string, TransportAdapter>;
  },
) {
  const { questions, manifest } = options;
  const experiment = experimentSchema.parse(options.experiment);
  const budgetUsd =
    options.budgetUsd === undefined ? (experiment.execution.budgetUsd ?? null) : options.budgetUsd;
  validateManifestQuestions(questions, manifest, experiment.languages);
  for (const model of experiment.models) validateModel(model);
  const protocol = getProtocol(experiment.protocol);
  const runId = `${experiment.id}-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`;
  const directory = options.directory ?? runPath(runId);
  const adapters =
    options.adapters ??
    new Map(
      [...new Set(experiment.models.map((model) => model.transport))].map((transport) => [
        transport,
        createAdapter(transport, experiment.execution.timeoutMs),
      ]),
    );
  const dataset = jsonl(questions);
  const snapshot: Snapshot = {
    schemaVersion: 3,
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
    transportMetadata: [...adapters.values()].map((a) => ({
      transport: a.transport,
      sdkVersion: a.sdkVersion,
      endpoint: a.endpoint,
    })),
  };
  const configHash = hash(json(snapshot));
  const jobs = createJobs(experiment, questions, configHash, manifest);
  validateBudget(budgetUsd, jobs);
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
    await options.onReady?.(runId, directory);
    const log = logger.with({ runId, dataset: experiment.dataset });
    log.info(
      "Created experiment {experiment} · dataset {dataset} · languages {languages} · protocol {protocol}",
      {
        event: "run.created",
        experiment: experiment.id,
        dataset: experiment.dataset,
        languages: experiment.languages.join(", "),
        protocol: experiment.protocol,
        repeats: experiment.repeats,
        timeoutMs: experiment.execution.timeoutMs,
      },
    );
    for (const model of experiment.models)
      log.info(
        "Condition {transport}/{model} · efforts {efforts} · output cap {cap} · timeout {timeoutMs}ms",
        {
          event: "run.model",
          transport: model.transport,
          model: model.model,
          efforts: model.efforts.join(", "),
          cap: model.maxOutputTokens ?? "provider default",
          timeoutMs: experiment.execution.timeoutMs,
        },
      );
    state.event("created", { runId, configHash, budgetUsd });
    const summary = await execute({
      state,
      jobs,
      adapters,
      logger: log,
      budgetUsd,
      concurrency: options.concurrency ?? experiment.execution.concurrency,
      maxAttempts: experiment.execution.maxAttempts,
      ...(options.maxJobs === undefined ? {} : { maxJobs: options.maxJobs }),
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.onProgress ? { onProgress: options.onProgress } : {}),
    });
    log.info("Inspect: pnpm bench status {runId} · analyze: pnpm bench score {runId}", {
      event: "run.next_steps",
      runId,
    });
    if (summary.completed < summary.total)
      log.info("Continue: pnpm bench resume {runId}{retryFlags}", {
        event: "run.resume_hint",
        runId,
        retryFlags: summary.failed
          ? " --retry-failed (raise --max-attempts if exhausted)"
          : summary.uncertain
            ? " --retry-uncertain (may repeat billed calls)"
            : "",
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
    adapters?: ReadonlyMap<string, TransportAdapter>;
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
    const jobs = createJobs(snapshot.experiment, questions, configHash, snapshot.datasetManifest);
    state = new RunState(join(directory, "state.sqlite"));
    state.assertJobs(jobs);
    const budgetUsd =
      options.budgetUsd === undefined
        ? state.lastBudget(snapshot.initialBudgetUsd)
        : options.budgetUsd;
    validateBudget(budgetUsd, jobs, state.charged());
    const maxAttempts = options.maxAttempts ?? snapshot.experiment.execution.maxAttempts;
    await options.onReady?.(snapshot.runId, directory);
    const beforeRecovery = state.summary();
    state.recover(options.retryUncertain ?? false, maxAttempts, options.retryFailed ?? false);
    const adapters =
      options.adapters ??
      new Map(
        [...new Set(snapshot.experiment.models.map((model) => model.transport))].map(
          (transport) => [
            transport,
            createAdapter(transport, snapshot.experiment.execution.timeoutMs),
          ],
        ),
      );
    const concurrency = options.concurrency ?? snapshot.experiment.execution.concurrency;
    const log = logger.with({ runId: snapshot.runId, dataset: snapshot.experiment.dataset });
    log.info(
      "Resuming saved experiment · dataset {dataset} · languages {languages} · {completed} already saved",
      {
        event: "run.resumed",
        dataset: snapshot.experiment.dataset,
        languages: snapshot.experiment.languages.join(", "),
        ...state.summary(),
        budgetUsd,
        concurrency,
        maxAttempts,
        retryFailed: options.retryFailed ?? false,
        retryUncertain: options.retryUncertain ?? false,
      },
    );
    if (beforeRecovery.running || beforeRecovery.uncertain || options.retryUncertain)
      log.warning(
        "Crash recovery: {running} interrupted calls · {uncertain} previously uncertain · retry-uncertain={retryUncertain}; earlier calls may have been billed",
        {
          event: "run.recovery",
          running: beforeRecovery.running,
          uncertain: beforeRecovery.uncertain,
          retryUncertain: options.retryUncertain ?? false,
        },
      );
    state.event("resumed", { budgetUsd, concurrency, maxAttempts });
    return {
      runId: snapshot.runId,
      directory,
      ...(await execute({
        state,
        jobs,
        adapters,
        logger: log,
        budgetUsd,
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
