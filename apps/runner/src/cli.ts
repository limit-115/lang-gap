#!/usr/bin/env node
import { join, resolve } from "node:path";
import { readdir, stat } from "node:fs/promises";
import { Command, CommanderError } from "@commander-js/extra-typings";
import type { CommandUnknownOpts } from "@commander-js/extra-typings";
import {
  experimentOptions,
  number,
  positiveInteger,
  concurrencyValue,
  attemptsValue,
} from "./cli-options";
import { analysisSelectionSchema } from "@llang-gap/contracts";
import { compareRuns } from "./compare";
import { prepareDataset, readManifest } from "@llang-gap/datasets";
import { resolveExperiment, parseComparisons, splitList, type ExperimentSelection } from "./config";
import { hash, json, workspace } from "./files";
import {
  describeRunDataset,
  readDatasetProtocols,
  readRunDataset,
} from "@llang-gap/evaluation/run-catalog";
import { createJobs, summarizePlan } from "./plan";
import { readCalibration } from "./forecast";
import { createRun, resumeRun, runPath } from "./run";
import { readSnapshot } from "./snapshot";
import { buildRelease, scoreRun, stageRelease, verifyRelease } from "./release";
import { RunState, unlockRun } from "./state";
import { loadEnvironment } from "./env";
import { configureLogging, logger } from "./logging";
import { diagnosticError, diagnosticMessage, redactDiagnostic } from "@llang-gap/transports";
import { reportConditions } from "./progress";
import { publishGuide, stageGuideEvidence, verifyAllGuides, verifyGuide } from "./guide";

const program = new Command()
  .name("bench")
  .description("Reproducible LLM language comparisons")
  .version("0.0.0")
  .option("--json", "Machine-readable output on stdout");
const output = (value: unknown) => process.stdout.write(json(value));
let logging: Awaited<ReturnType<typeof configureLogging>> | undefined;
const executionOutput = (result: Awaited<ReturnType<typeof createRun | typeof resumeRun>>) => {
  output(result);
  if (
    result.failed > 0 ||
    result.uncertain > 0 ||
    ["execution-error", "transport-error", "failed", "uncertain", "attempt-limit"].includes(
      result.stopReason,
    )
  )
    process.exitCode ||= 1;
};

async function prepare(
  path: string | undefined,
  offline = false,
  selection: ExperimentSelection = {},
) {
  logger.info("Resolving experiment configuration", { event: "config.resolving" });
  const experiment = await resolveExperiment(
    path === undefined ? undefined : resolve(path),
    selection,
  );
  const manifest = await readManifest(
    join(workspace, "datasets", experiment.dataset, "manifest.json"),
  );
  if (manifest.id !== experiment.dataset) throw new Error("Experiment / dataset manifest mismatch");
  const catalog = describeRunDataset(
    manifest,
    await readDatasetProtocols(join(workspace, "datasets", experiment.dataset)),
  );
  const protocol = catalog.protocols.find((entry) => entry.id === experiment.protocol);
  if (!protocol)
    throw new Error(
      `Protocol ${experiment.protocol} is not available for dataset ${experiment.dataset}`,
    );
  for (const language of experiment.languages)
    if (!protocol.languages.includes(language))
      throw new Error(
        `Protocol ${protocol.id} does not support ${language} for dataset ${experiment.dataset}`,
      );
  const started = performance.now();
  logger.info("Preparing verified dataset {dataset} · languages {languages} · {mode}", {
    event: "dataset.preparing",
    dataset: experiment.dataset,
    languages: experiment.languages.join(", "),
    mode: offline ? "offline cache only" : "verified cache or pinned download",
  });
  const dataset = await prepareDataset({
    manifest,
    cacheDir: join(workspace, ".llang-gap/datasets"),
    offline,
    languages: experiment.languages,
  });
  logger.info("Dataset ready · {rows} rows · {elapsedMs}ms", {
    event: "dataset.ready",
    dataset: manifest.id,
    rows: dataset.questions.length,
    elapsedMs: Math.round(performance.now() - started),
  });
  return { experiment, manifest, ...dataset };
}
async function withSignals<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const stop = (signal: "SIGINT" | "SIGTERM") => {
    if (!controller.signal.aborted)
      logger.warning("{signal}: stopping dispatch; waiting for active responses to be saved", {
        event: "run.signal",
        signal,
      });
    process.exitCode = signal === "SIGINT" ? 130 : 143;
    controller.abort();
  };
  const interrupt = () => stop("SIGINT");
  const terminate = () => stop("SIGTERM");
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  try {
    return await work(controller.signal);
  } finally {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
  }
}

program
  .command("dataset")
  .description("Discover dataset protocols and manage verified local dataset cache")
  .addCommand(
    new Command("list")
      .description(
        "List datasets, recommended protocols and supported languages without downloading data",
      )
      .action(async () => {
        const directory = join(workspace, "datasets");
        const entries = await readdir(directory, { withFileTypes: true });
        output(
          await Promise.all(
            entries
              .filter((entry) => entry.isDirectory())
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((entry) => readRunDataset(join(directory, entry.name))),
          ),
        );
      }),
  )
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
      executionOutput(
        await withSignals((signal) =>
          createRun({
            experiment,
            questions,
            manifest,
            signal,
            onReady: (runId, directory) => logging!.openRun(runId, directory),
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
      const log = logger.with({ runId: snapshot.runId, dataset: snapshot.experiment.dataset });
      const summary = state.summary();
      const recentFailures = state.recentFailures().map((failure) => ({
        ...failure,
        error: diagnosticMessage(new Error(failure.error)),
        requestId: failure.requestId === null ? null : redactDiagnostic(failure.requestId),
      }));
      log.info(
        "{runId} · {completed}/{total} saved · {running} running · {pending} pending · {failed} failed · {uncertain} uncertain",
        { event: "run.status", runId: snapshot.runId, ...summary },
      );
      for (const failure of recentFailures)
        log.warning(
          "Recent attempt: {transport}/{model} · {effort} · {language} · attempt {attempt}: {error}",
          { event: "run.recent_failure", ...failure },
        );
      reportConditions(state, log);
      output({
        runId: snapshot.runId,
        experiment: snapshot.experiment.id,
        ...summary,
        conditions: state.conditionSummary(),
        recentFailures,
      });
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
    "Requeue technical failures below the total attempt limit; does not reset attempts or repeat completed answers",
  )
  .option(
    "--max-attempts <count>",
    "Total attempt limit per job, up to 5; recorded as an operational change",
    attemptsValue,
  )
  .action(async (id, options) => {
    executionOutput(
      await withSignals((signal) =>
        resumeRun(runPath(id), {
          ...(options.budgetUsd === undefined ? {} : { budgetUsd: options.budgetUsd }),
          signal,
          onReady: (runId, directory) => logging!.openRun(runId, directory),
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
  .option("--compare <pairs...>", "Post-run baseline:language pairs; commas or spaces")
  .action(async (id, options) => {
    output(
      await scoreRun(
        runPath(id),
        options.compare === undefined ? undefined : parseComparisons(options.compare),
      ),
    );
  });
program
  .command("compare <run-ids...>")
  .description("Compare compatible saved model/effort/language conditions; no model calls")
  .option("--id <id>", "Immutable analysis artifact ID")
  .option("--models <ids...>", "Filter saved model IDs; commas or spaces")
  .option("--transports <names...>", "Filter saved transports; commas or spaces")
  .option("--efforts <levels...>", "Filter saved efforts; commas or spaces")
  .option("--languages <tags...>", "Filter saved benchmark languages; commas or spaces")
  .option("--seed <number>", "Paired bootstrap seed (default: 42)", positiveInteger)
  .action(async (ids, options) => {
    const selection = analysisSelectionSchema.parse(
      Object.fromEntries(
        (["models", "transports", "efforts", "languages"] as const).flatMap((key) =>
          options[key] === undefined ? [] : [[key, splitList(options[key])]],
        ),
      ),
    );
    output(
      await compareRuns(splitList(ids).map(runPath), {
        selection,
        ...(options.id === undefined ? {} : { id: options.id }),
        ...(options.seed === undefined ? {} : { seed: options.seed }),
      }),
    );
  });
const release = program
  .command("release")
  .description("Build, verify and stage immutable release artifacts");
release
  .command("build <run-id>")
  .requiredOption("--id <id>", "Immutable release ID")
  .option("--test", "Build a clearly marked nonpublic test artifact")
  .option("--compare <pairs...>", "Post-run baseline:language pairs saved in release analysis.json")
  .action(async (id, options) => {
    output(
      await buildRelease(
        runPath(id),
        options.id,
        options.test ? "test" : "benchmark",
        undefined,
        options.compare === undefined ? undefined : parseComparisons(options.compare),
      ),
    );
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

const guide = program
  .command("guide")
  .description("Build the public model guide from staged releases; no model requests");
guide
  .command("evidence <directory>")
  .description("Add verified-input metadata to an already staged historical release")
  .action(async (directory) => {
    output(await stageGuideEvidence(resolve(directory)));
  });
guide
  .command("build <plan>")
  .requiredOption("--id <id>", "New immutable guide snapshot ID")
  .action(async (plan, options) => {
    output(await publishGuide(resolve(plan), options.id));
  });
guide.command("verify [id]").action(async (id) => {
  output(id ? await verifyGuide(id) : await verifyAllGuides());
});

function configureCommand(command: CommandUnknownOpts) {
  command.exitOverride();
  command.configureOutput({
    writeErr: (message) =>
      logger.error("{message}", {
        event: "cli.usage_error",
        message: diagnosticMessage(new Error(message.trim())),
      }),
  });
  command.commands.forEach(configureCommand);
}
configureCommand(program);
program.hook("preAction", (_command, action) => {
  logger.info("{command}", { event: "command.started", command: action.name() });
});
program.hook("postAction", (_command, action) => {
  logger.debug("Command finished: {command}", {
    event: "command.finished",
    command: action.name(),
  });
});

try {
  loadEnvironment();
  logging = await configureLogging();
  await program.parseAsync();
} catch (error) {
  if (error instanceof CommanderError) {
    process.exitCode = error.exitCode;
    if (error.exitCode !== 0 && program.opts().json) output({ error: diagnosticMessage(error) });
  } else {
    const message = diagnosticMessage(error);
    if (program.opts().json) output({ error: message });
    if (logging) {
      logger.error("{message}", { event: "command.failed", message });
      logger.debug("Failure details", {
        event: "command.error_details",
        ...diagnosticError(error),
      });
    } else process.stderr.write(`ERROR ${message}\n`);
    process.exitCode = 1;
  }
} finally {
  await logging?.close();
}
