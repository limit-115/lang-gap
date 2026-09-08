import {
  experimentSchema,
  type Experiment,
  type Effort,
  type Transport,
} from "@llang-gap/contracts";
import type { RunDataset } from "@llang-gap/contracts/run-catalog";

export const initialSettings = {
  dataset: "",
  protocol: "",
  languages: [] as string[],
  transport: "" as Transport | "",
  models: "",
  efforts: ["medium"] as Effort[],
  scope: "sample",
  questionLimit: "10",
  maxOutputTokens: "",
  repeats: "1",
  id: "cli",
  seed: "42",
  concurrency: "1",
  maxAttempts: "3",
  timeoutMs: "120000",
  maxJobs: "",
  budgetUsd: "",
  offline: false,
  comparisons: "",
  pricing: false,
  pricingAsOf: "",
  pricingSource: "",
  inputPerMillion: "",
  cachedInputPerMillion: "",
  cacheWritePerMillion: "",
  cacheWrite1hPerMillion: "",
  outputPerMillion: "",
};
export type RunSettings = typeof initialSettings;
export type Setting = keyof RunSettings;
export type ErrorKey =
  | "required"
  | "invalid"
  | "languagesInvalid"
  | "protocolInvalid"
  | "capRequired"
  | "capFixed"
  | "modelsInvalid"
  | "comparisonsInvalid"
  | "pricingInvalid"
  | "budgetNeedsRates";
export const pricingFields = [
  "inputPerMillion",
  "cachedInputPerMillion",
  "cacheWritePerMillion",
  "cacheWrite1hPerMillion",
  "outputPerMillion",
] as const;

function list(value: string) {
  return value
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
}
function numeric(value: string) {
  return value.trim() ? Number(value) : Number.NaN;
}
export function shellQuote(value: string) {
  return /^[a-zA-Z0-9_./,:=-]+$/.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`;
}

export function buildRun(settings: RunSettings, datasets: readonly RunDataset[]) {
  const errors: Partial<Record<Setting, ErrorKey>> = {};
  const dataset = datasets.find((entry) => entry.id === settings.dataset);
  const protocol = dataset?.protocols.find((entry) => entry.id === settings.protocol);
  if (!dataset) errors.dataset = "required";
  if (!protocol) errors.protocol = "protocolInvalid";
  if (!settings.languages.length) errors.languages = "required";
  else if (!settings.languages.every((tag) => protocol?.languages.includes(tag)))
    errors.languages = "languagesInvalid";
  const cap = settings.maxOutputTokens.trim() ? numeric(settings.maxOutputTokens) : null;
  if ((protocol?.requiresTokenCap || settings.transport === "anthropic") && cap === null)
    errors.maxOutputTokens = "capRequired";
  if (protocol?.tokenCap !== null && protocol?.tokenCap !== undefined && cap !== protocol.tokenCap)
    errors.maxOutputTokens = "capFixed";
  const models = list(settings.models);
  const comparisons = list(settings.comparisons).map((pair) => {
    const parts = pair.split(":");
    if (parts.length !== 2) errors.comparisons = "comparisonsInvalid";
    return { baseline: parts[0], language: parts[1] };
  });
  const pricing = settings.pricing
    ? {
        asOf: settings.pricingAsOf,
        source: settings.pricingSource,
        ...Object.fromEntries(pricingFields.map((key) => [key, numeric(settings[key])])),
      }
    : undefined;
  if (
    settings.budgetUsd.trim() &&
    (!settings.pricing || (cap === null && numeric(settings.outputPerMillion) > 0))
  )
    errors.budgetUsd = "budgetNeedsRates";
  if (!settings.transport) errors.transport = "required";
  const parsed = experimentSchema.safeParse({
    schemaVersion: 3,
    id: settings.id,
    dataset: settings.dataset,
    protocol: settings.protocol,
    languages: settings.languages,
    comparisons,
    repeats: numeric(settings.repeats),
    seed: numeric(settings.seed),
    models: models.map((model) => ({
      transport: settings.transport,
      model,
      efforts: settings.efforts,
      maxOutputTokens: cap,
      ...(pricing ? { pricing } : {}),
    })),
    execution: {
      concurrency: numeric(settings.concurrency),
      maxAttempts: numeric(settings.maxAttempts),
      timeoutMs: numeric(settings.timeoutMs),
      ...(settings.budgetUsd.trim() ? { budgetUsd: numeric(settings.budgetUsd) } : {}),
    },
    ...(settings.scope === "sample" ? { questionLimit: numeric(settings.questionLimit) } : {}),
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const path = issue.path;
      let field: Setting = "comparisons";
      let message: ErrorKey = "invalid";
      if (path[0] === "models") {
        field =
          path[2] === "efforts"
            ? "efforts"
            : path[2] === "maxOutputTokens"
              ? "maxOutputTokens"
              : path[2] === "pricing"
                ? "pricing"
                : "models";
        message =
          field === "pricing" ? "pricingInvalid" : field === "models" ? "modelsInvalid" : "invalid";
      } else if (path[0] === "execution") field = path[1] as Setting;
      else if (path[0]) field = path[0] as Setting;
      errors[field] ??= message;
    }
  }
  if (
    settings.maxJobs.trim() &&
    (!Number.isSafeInteger(numeric(settings.maxJobs)) || numeric(settings.maxJobs) < 1)
  )
    errors.maxJobs = "invalid";
  if (!parsed.success || Object.keys(errors).length)
    return { errors, experiment: null, command: null, plan: null, requests: null };
  const experiment = parsed.data;
  const args = experimentArguments(experiment);
  const suffix = [...args, ...(settings.offline ? ["--offline"] : [])];
  const command = [
    "pnpm bench run",
    ...suffix,
    ...(settings.maxJobs.trim() ? [`--max-jobs=${numeric(settings.maxJobs)}`] : []),
  ].join(" \\\n  ");
  const plan = ["pnpm bench plan", ...suffix].join(" \\\n  ");
  const questions = dataset!.languages
    .filter(({ tag }) => experiment.languages.includes(tag))
    .reduce(
      (sum, language) =>
        sum + Math.min(language.questions, experiment.questionLimit ?? language.questions),
      0,
    );
  const conditions = experiment.models.reduce((sum, model) => sum + model.efforts.length, 0);
  return {
    errors,
    experiment,
    command,
    plan,
    requests: questions * conditions * experiment.repeats,
  };
}

export function experimentArguments(experiment: Experiment): string[] {
  const first = experiment.models[0]!;
  const args: [string, string | number][] = [
    ["dataset", experiment.dataset],
    ["protocol", experiment.protocol],
    ["languages", experiment.languages.join(",")],
    ["transport", first.transport],
    ["models", experiment.models.map((model) => model.model).join(",")],
    ["efforts", first.efforts.join(",")],
  ];
  if (first.maxOutputTokens !== null) args.push(["max-output-tokens", first.maxOutputTokens]);
  if (experiment.questionLimit !== undefined)
    args.push(["question-limit", experiment.questionLimit]);
  args.push(["repeats", experiment.repeats]);
  if (experiment.id !== "cli") args.push(["id", experiment.id]);
  if (experiment.comparisons.length)
    args.push([
      "compare",
      experiment.comparisons.map((pair) => `${pair.baseline}:${pair.language}`).join(","),
    ]);
  if (experiment.seed !== 42) args.push(["seed", experiment.seed]);
  if (experiment.execution.concurrency !== 1)
    args.push(["concurrency", experiment.execution.concurrency]);
  if (experiment.execution.maxAttempts !== 3)
    args.push(["max-attempts", experiment.execution.maxAttempts]);
  if (experiment.execution.timeoutMs !== 120000)
    args.push(["timeout-ms", experiment.execution.timeoutMs]);
  if (experiment.execution.budgetUsd !== undefined && experiment.execution.budgetUsd !== null)
    args.push(["budget-usd", experiment.execution.budgetUsd]);
  if (first.pricing) {
    args.push(["pricing-as-of", first.pricing.asOf], ["pricing-source", first.pricing.source]);
    for (const key of pricingFields)
      args.push([
        key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
        first.pricing[key],
      ]);
  }
  return args.map(([flag, value]) => `--${flag}=${shellQuote(String(value))}`);
}
