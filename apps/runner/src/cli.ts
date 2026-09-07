#!/usr/bin/env node
import { join, resolve } from "node:path";
import { stat } from "node:fs/promises";
import { Command } from "@commander-js/extra-typings";
import {
  experimentOptions,
  number,
  positiveInteger,
  concurrencyValue,
  attemptsValue,
} from "./cli-options";
import { prepareDataset, readManifest } from "@llang-gap/datasets";
import { resolveExperiment, type ExperimentSelection } from "./config";
import { hash, json, workspace } from "./files";
import { createJobs, summarizePlan } from "./plan";
import { readCalibration } from "./forecast";
import { createRun, resumeRun, runPath } from "./run";
import { readSnapshot } from "./snapshot";
import { buildRelease, scoreRun, stageRelease, verifyRelease } from "./release";
import { RunState, unlockRun } from "./state";

const program = new Command()
  .name("bench")
  .description("Reproducible LLM language comparisons")
  .version("0.0.0")
  .option("--json", "Machine-readable output on stdout");
const output = (value: unknown) => process.stdout.write(json(value));
const log = (value: string) => process.stderr.write(`${value}\n`);
const progress = (summary: ReturnType<RunState["summary"]>) => {
  if (summary.completed % 20 === 0 || summary.completed === summary.total)
    log(
      `${summary.completed}/${summary.total} complete · $${summary.chargedOrReservedUsd?.toFixed(4) ?? "unknown"} charged/reserved`,
    );
};

async function prepare(
  path: string | undefined,
  offline = false,
  selection: ExperimentSelection = {},
) {
  const experiment = await resolveExperiment(
    path === undefined ? undefined : resolve(path),
    selection,
  );
  const manifest = await readManifest(
    join(workspace, "datasets", experiment.dataset, "manifest.json"),
  );
  if (manifest.id !== experiment.dataset) throw new Error("Experiment / dataset manifest mismatch");
  const dataset = await prepareDataset({
    manifest,
    cacheDir: join(workspace, ".llang-gap/datasets"),
    offline,
    languages: experiment.languages,
  });
  return { experiment, manifest, ...dataset };
}
async function withSignals<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const stop = () => {
    if (!controller.signal.aborted)
      log("Stopping dispatch; waiting for active responses to be saved…");
    controller.abort();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    return await work(controller.signal);
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
}

program
  .command("dataset")
  .description("Manage verified local dataset cache")
  .addCommand(
    experimentOptions()
      .name("prepare")
      .action(async (path, options) => {
        const data = await prepare(path, options.offline, options);
        output({
          dataset: data.manifest.id,
          revision: data.manifest.revision,
          rows: data.questions.length,
          hash: data.hash,
          directory: data.directory,
        });
      }),
  );
program.addCommand(
  experimentOptions()
    .name("plan")
    .description("Validate and expand an experiment without model requests")
    .option(
      "--calibrate-from <directory>",
      "Forecast costs from a completed compatible run with usage",
    )
    .action(async (path, options) => {
      const {
        experiment,
        manifest,
        questions,
        hash: datasetHash,
      } = await prepare(path, options.offline, options);
      const jobs = createJobs(experiment, questions, hash(json(experiment)), manifest);
      const forecast = options.calibrateFrom
        ? await readCalibration(resolve(options.calibrateFrom), experiment, jobs, datasetHash)
        : null;
      output({ ...summarizePlan(experiment, jobs), resolvedExperiment: experiment, forecast });
    }),
);
program.addCommand(
  experimentOptions()
    .name("run")
    .description("Execute an experiment; cost planning and a budget are optional")
    .option(
      "--max-jobs <count>",
      "Pause after this many jobs; preserve the complete experiment",
      positiveInteger,
    )
    .action(async (path, options) => {
      const { experiment, questions, manifest } = await prepare(path, options.offline, options);
      output(
        await withSignals((signal) =>
          createRun({
            experiment,
            questions,
            manifest,
            signal,
            onProgress: progress,
            ...(options.maxJobs === undefined ? {} : { maxJobs: options.maxJobs }),
          }),
        ),
      );
    }),
);
program
  .command("status <run-id>")
  .description("Inspect durable progress without contacting model APIs")
  .action(async (id) => {
    const directory = runPath(id);
    await stat(join(directory, "state.sqlite"));
    const { snapshot } = await readSnapshot(directory);
    const state = new RunState(join(directory, "state.sqlite"));
    try {
      output({ runId: snapshot.runId, experiment: snapshot.experiment.id, ...state.summary() });
    } finally {
      state.close();
    }
  });
program
  .command("resume <run-id>")
  .description("Continue using the original immutable configuration")
  .option("--budget-usd <amount>", "Total budget; omit to retain the previous setting", number)
  .option("--concurrency <count>", "Concurrent requests per transport", concurrencyValue)
  .option("--max-jobs <count>", "Pause after this many additional jobs", positiveInteger)
  .option(
    "--retry-uncertain",
    "Allow reissuing crash-interrupted requests; they may have been billed already",
  )
  .option(
    "--retry-failed",
    "Requeue technical failures below the attempt limit; completed answers are never repeated",
  )
  .option(
    "--max-attempts <count>",
    "Total attempt limit per job, up to 5; recorded as an operational change",
    attemptsValue,
  )
  .action(async (id, options) => {
    output(
      await withSignals((signal) =>
        resumeRun(runPath(id), {
          ...(options.budgetUsd === undefined ? {} : { budgetUsd: options.budgetUsd }),
          signal,
          onProgress: progress,
          ...(options.retryUncertain ? { retryUncertain: true } : {}),
          ...(options.concurrency === undefined ? {} : { concurrency: options.concurrency }),
          ...(options.retryFailed ? { retryFailed: true } : {}),
          ...(options.maxAttempts === undefined ? {} : { maxAttempts: options.maxAttempts }),
          ...(options.maxJobs === undefined ? {} : { maxJobs: options.maxJobs }),
        }),
      ),
    );
  });
program
  .command("unlock <run-id>")
  .description("Remove a lock only after verifying that its local owner exited")
  .action(async (id) => {
    await unlockRun(runPath(id));
    output({ unlocked: id });
  });
program
  .command("score <run-id>")
  .description("Independently recompute scores from saved visible outputs")
  .action(async (id) => {
    output(await scoreRun(runPath(id)));
  });
const release = program
  .command("release")
  .description("Build, verify and stage immutable release artifacts");
release
  .command("build <run-id>")
  .requiredOption("--id <id>", "Immutable release ID")
  .option("--test", "Build a clearly marked nonpublic test artifact")
  .action(async (id, options) => {
    output(await buildRelease(runPath(id), options.id, options.test ? "test" : "benchmark"));
  });
release
  .command("verify <directory>")
  .description("Check every hash and recompute scores without API calls")
  .action(async (directory) => {
    const verified = await verifyRelease(resolve(directory));
    output({ valid: true, id: verified.id, kind: verified.kind, rows: verified.aggregate.length });
  });
release
  .command("stage <directory>")
  .description("Add a verified benchmark to the local website index; no remote upload")
  .requiredOption("--assets-url <url>", "HTTPS directory containing uploaded release files")
  .action(async (directory, options) => {
    output(await stageRelease(resolve(directory), options.assetsUrl));
  });

try {
  await program.parseAsync();
} catch (error) {
  const message = error instanceof Error ? error.message : "Unexpected failure";
  if (program.opts().json) output({ error: message });
  else log(`Error: ${message}`);
  process.exitCode = 1;
}
