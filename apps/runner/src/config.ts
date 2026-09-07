import { readFile } from "node:fs/promises";
import { parseDocument } from "yaml";
import { z } from "zod";
import { experimentSchema, type Experiment } from "@llang-gap/contracts";
import { validateModel } from "@llang-gap/providers";
import { getMaxOutputTokens } from "@llang-gap/evaluation";

function readYaml(text: string): unknown {
  const document = parseDocument(text, { uniqueKeys: true, strict: true });
  if (document.errors.length || document.warnings.length)
    throw new Error(
      `Invalid YAML: ${[...document.errors, ...document.warnings].map((e) => e.message).join("; ")}`,
    );
  return document.toJS({ maxAliasCount: 0 });
}
function validateExperiment(input: unknown): Experiment {
  const experiment = experimentSchema.parse(input);
  for (const model of experiment.models) validateModel(model);
  if (
    experiment.models.some((m) => m.transport === "fake") &&
    experiment.models.some((m) => m.transport !== "fake")
  )
    throw new Error("Synthetic and live providers cannot be mixed");
  return experiment;
}
export function parseExperiment(text: string): Experiment {
  return validateExperiment(readYaml(text));
}
export async function loadExperiment(path: string): Promise<Experiment> {
  return parseExperiment(await readFile(path, "utf8"));
}

export function splitList(values: readonly string[]): string[] {
  const result = values.flatMap((value) =>
    value.split(",").flatMap((part) => {
      if (!part.trim()) throw new Error("Lists must not contain empty entries");
      return part.trim().split(/\s+/);
    }),
  );
  if (!result.length) throw new Error("Expected a nonempty list");
  return result;
}
export function parseComparisons(values: readonly string[]) {
  return splitList(values).map((value) => {
    const parts = value.split(":");
    if (parts.length !== 2) throw new Error("Comparison must be baseline:language");
    return { baseline: parts[0], language: parts[1] };
  });
}

export interface ExperimentSelection {
  id?: string;
  dataset?: string;
  language?: string;
  languages?: string[];
  compare?: string[];
  protocol?: string;
  transport?: string;
  models?: string[];
  efforts?: string[];
  maxOutputTokens?: number;
  repeats?: number;
  seed?: number;
  questionLimit?: number;
  allQuestions?: boolean;
  concurrency?: number;
  maxAttempts?: number;
  timeoutMs?: number;
  budgetUsd?: number;
  budget?: boolean;
  pricing?: boolean;
  pricingAsOf?: string;
  pricingSource?: string;
  inputPerMillion?: number;
  cachedInputPerMillion?: number;
  cacheWritePerMillion?: number;
  cacheWrite1hPerMillion?: number;
  outputPerMillion?: number;
}
const objectSchema = z.record(z.string(), z.unknown());
const defined = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));

function resolveInput(input: unknown, options: ExperimentSelection): Experiment {
  const base = objectSchema.parse(input);
  if (options.language !== undefined && options.languages !== undefined)
    throw new Error("Use --language or --languages, not both");
  if (options.allQuestions && options.questionLimit !== undefined)
    throw new Error("Use --all-questions or --question-limit, not both");
  if (options.budget === false && options.budgetUsd !== undefined)
    throw new Error("Use --no-budget or --budget-usd, not both");
  const pricingOverrides = defined({
    asOf: options.pricingAsOf,
    source: options.pricingSource,
    inputPerMillion: options.inputPerMillion,
    cachedInputPerMillion: options.cachedInputPerMillion,
    cacheWritePerMillion: options.cacheWritePerMillion,
    cacheWrite1hPerMillion: options.cacheWrite1hPerMillion,
    outputPerMillion: options.outputPerMillion,
  });
  if (options.pricing === false && Object.keys(pricingOverrides).length)
    throw new Error("Use --no-pricing or price flags, not both");
  const languages =
    options.language !== undefined
      ? [options.language]
      : options.languages !== undefined
        ? splitList(options.languages)
        : undefined;
  const inheritedModels =
    options.models === undefined
      ? base.models === undefined
        ? []
        : z.array(objectSchema).parse(base.models)
      : Array.isArray(base.models)
        ? base.models.flatMap((model: unknown) => {
            const parsed = objectSchema.safeParse(model);
            return parsed.success ? [parsed.data] : [];
          })
        : [];
  const executionOverrides = defined({
    concurrency: options.concurrency,
    maxAttempts: options.maxAttempts,
    timeoutMs: options.timeoutMs,
    budgetUsd: options.budgetUsd,
    ...(options.budget === false ? { budgetUsd: null } : {}),
  });
  const inheritedExecution = Object.keys(executionOverrides).length
    ? (objectSchema.safeParse(base.execution).data ?? {})
    : base.execution === undefined
      ? {}
      : objectSchema.parse(base.execution);
  const transports = new Set(inheritedModels.map((model) => model.transport));
  const transport = options.transport ?? (transports.size === 1 ? [...transports][0] : undefined);
  const models =
    options.models === undefined
      ? inheritedModels
      : splitList(options.models).map((id) => {
          const matches = inheritedModels.filter(
            (model) =>
              model.model === id && (transport === undefined || model.transport === transport),
          );
          if (matches.length > 1) throw new Error(`Ambiguous model ${id}; specify --transport`);
          return matches[0] ?? { model: id, transport };
        });
  const protocol = options.protocol ?? base.protocol;
  const cap =
    typeof protocol === "string"
      ? (getMaxOutputTokens(experimentSchema.shape.protocol.parse(protocol)) ?? 2048)
      : 2048;
  const resolved = {
    schemaVersion: 3,
    id: "cli",
    repeats: 1,
    seed: 42,
    comparisons: [],
    ...base,
    ...defined({
      id: options.id,
      dataset: options.dataset,
      protocol,
      languages,
      repeats: options.repeats,
      seed: options.seed,
      questionLimit: options.questionLimit,
    }),
    ...(options.allQuestions ? { questionLimit: undefined } : {}),
    ...(languages ? { comparisons: [] } : {}),
    ...(options.compare !== undefined ? { comparisons: parseComparisons(options.compare) } : {}),
    models: models.map((model) => {
      // A transport override changes billing identity. Never reuse another transport's rates.
      const pricing =
        options.transport && options.transport !== model.transport ? undefined : model.pricing;
      return {
        efforts: ["medium"],
        maxOutputTokens: cap,
        ...model,
        ...defined({
          transport: options.transport,
          efforts: options.efforts === undefined ? undefined : splitList(options.efforts),
          maxOutputTokens: options.maxOutputTokens,
        }),
        pricing:
          options.pricing === false
            ? undefined
            : Object.keys(pricingOverrides).length
              ? {
                  ...objectSchema.safeParse(pricing).data,
                  ...pricingOverrides,
                }
              : pricing,
      };
    }),
    execution: {
      concurrency: 1,
      maxAttempts: 3,
      timeoutMs: 120_000,
      ...inheritedExecution,
      ...executionOverrides,
    },
  };
  return validateExperiment(resolved);
}

export function selectExperiment(experiment: Experiment, options: ExperimentSelection): Experiment {
  return resolveInput(experiment, options);
}
export async function resolveExperiment(
  path: string | undefined,
  options: ExperimentSelection = {},
): Promise<Experiment> {
  return resolveInput(path === undefined ? {} : readYaml(await readFile(path, "utf8")), options);
}
