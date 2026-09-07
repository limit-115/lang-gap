import { z } from "zod";

// Benchmark language tags are independent of website UI locales.
export const languageSchema = z
  .string()
  .regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/)
  .refine((tag) => {
    try {
      return Intl.getCanonicalLocales(tag)[0] === tag;
    } catch {
      return false;
    }
  }, "Use a canonical language tag (for example de, ja, or zh-Hant)");
export const languagesSchema = z
  .array(languageSchema)
  .min(1)
  .refine((values) => new Set(values).size === values.length, "Duplicate language");
export const comparisonSchema = z
  .strictObject({ baseline: languageSchema, language: languageSchema })
  .refine((pair) => pair.baseline !== pair.language, "Cannot compare a language with itself");
export const comparisonsSchema = z
  .array(comparisonSchema)
  .refine(
    (pairs) =>
      new Set(pairs.map((pair) => `${pair.baseline}/${pair.language}`)).size === pairs.length,
    "Duplicate comparison",
  );
export type Comparison = z.infer<typeof comparisonSchema>;
export const promptLabelsSchema = z.strictObject({
  instruction: z.string().min(1),
  question: z.string().min(1),
  options: z.string().min(1),
});
export type PromptLabels = z.infer<typeof promptLabelsSchema>;
export const effortSchema = z.enum(["low", "medium", "high", "xhigh", "max"]);
export const transportSchema = z.enum(["openai", "anthropic", "openrouter", "fake"]);
export const safeIdSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]{0,99}$/);
export const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const protocolIdSchema = z.enum([
  "multiple-choice-v1",
  "mmluprox-lite-5shot-native-reasoning-v1",
  "mmluprox-lite-5shot-author-api-v3",
]);
export type ProtocolId = z.infer<typeof protocolIdSchema>;
export type Language = z.infer<typeof languageSchema>;
export type Effort = z.infer<typeof effortSchema>;
export type Transport = z.infer<typeof transportSchema>;

export const questionSchema = z
  .strictObject({
    id: z.string().min(1),
    sourceId: z.union([z.number().int(), z.string().min(1)]),
    language: languageSchema,
    split: z.enum(["test", "validation"]),
    category: z.string().min(1),
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(10),
    answer: z.string().regex(/^[A-J]$/),
    cot: z.string(),
  })
  .refine((q) => q.answer.charCodeAt(0) - 65 < q.options.length, "Answer exceeds options");
export type Question = z.infer<typeof questionSchema>;
export type PromptQuestion = Pick<
  Question,
  "id" | "language" | "category" | "question" | "options"
>;

export const pricingSchema = z.strictObject({
  asOf: z.iso.date(),
  source: z.url(),
  inputPerMillion: z.number().nonnegative(),
  cachedInputPerMillion: z.number().nonnegative(),
  cacheWritePerMillion: z.number().nonnegative(),
  cacheWrite1hPerMillion: z.number().nonnegative(),
  outputPerMillion: z.number().nonnegative(),
});
const modelSettings = {
  efforts: z
    .array(effortSchema)
    .min(1)
    .refine((v) => new Set(v).size === v.length, "Duplicate effort"),
  maxOutputTokens: z.number().int().min(256).max(128_000),
  pricing: pricingSchema.optional(),
};
export const modelSchema = z.discriminatedUnion("transport", [
  z.strictObject({
    ...modelSettings,
    transport: transportSchema.exclude(["openrouter"]),
    model: safeIdSchema,
  }),
  z.strictObject({
    ...modelSettings,
    transport: z.literal("openrouter"),
    model: z
      .string()
      .regex(/^(?!openrouter\/)[a-z0-9][a-z0-9._-]{0,99}\/[a-z0-9][a-z0-9._-]{0,99}(?::free)?$/),
  }),
]);
export type ModelConfig = z.infer<typeof modelSchema>;
export type ModelReference = Pick<ModelConfig, "transport" | "model">;

// Native API IDs have no owner namespace; their registered metadata supplies it.
const nativeModelOwners = new Map([
  ["gpt-6-astra", "openai"],
  ["claude-fable-5-1", "anthropic"],
  ["fake-v1", "fake"],
]);
export function getModelIdentity({ model }: Pick<ModelReference, "model">) {
  const separator = model.indexOf("/");
  return separator > 0
    ? { owner: model.slice(0, separator), name: model.slice(separator + 1) }
    : { owner: nativeModelOwners.get(model) ?? null, name: model };
}

export const experimentSchema = z
  .strictObject({
    schemaVersion: z.literal(3),
    id: safeIdSchema,
    dataset: safeIdSchema,
    protocol: protocolIdSchema,
    languages: languagesSchema,
    comparisons: comparisonsSchema,
    repeats: z.number().int().min(1).max(10),
    seed: z.number().int().min(1).max(2_147_483_647),
    models: z
      .array(modelSchema)
      .min(1)
      .refine(
        (models) => new Set(models.map((m) => `${m.transport}/${m.model}`)).size === models.length,
        "Duplicate model",
      ),
    execution: z.strictObject({
      concurrency: z.number().int().min(1).max(32),
      maxAttempts: z.number().int().min(1).max(5),
      timeoutMs: z.number().int().min(1000).max(3_600_000),
    }),
    // A fixed subset supports technical pilots; releases require the entire test split.
    questionLimit: z.number().int().positive().optional(),
  })
  .refine(
    (value) =>
      value.comparisons.every(
        (pair) =>
          value.languages.includes(pair.baseline) && value.languages.includes(pair.language),
      ),
    "Comparison languages must be selected",
  )
  .refine(
    (value) =>
      new Set(value.comparisons.map((pair) => `${pair.baseline}/${pair.language}`)).size ===
      value.comparisons.length,
    "Duplicate comparison",
  );
export type Experiment = z.infer<typeof experimentSchema>;
export const experimentJsonSchema = () =>
  z.toJSONSchema(experimentSchema, { target: "draft-2020-12" });

const datasetFileSchema = z.strictObject({
  // Relative source paths only, including sharded files; never allow cache traversal.
  path: z
    .string()
    .regex(/^[a-zA-Z0-9_-][a-zA-Z0-9._/-]*$/)
    .refine(
      (path) => path.split("/").every((part) => part !== ".." && part !== "." && part !== ""),
      "Invalid dataset path",
    ),
  language: languageSchema,
  split: z.enum(["test", "validation"]),
  rows: z.number().int().positive(),
  sha256: hashSchema,
});
const manifestFields = {
  id: safeIdSchema,
  repository: z.string().regex(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/),
  revision: z.string().regex(/^[a-f0-9]{40}$/),
  license: z.string().min(1),
  source: z.url(),
  files: z
    .array(datasetFileSchema)
    .min(1)
    .refine(
      (files) => new Set(files.map((file) => file.path)).size === files.length,
      "Duplicate source path",
    ),
};
export const datasetManifestSchema = z.discriminatedUnion("schemaVersion", [
  // The original pinned Parquet manifest remains byte-for-byte unchanged.
  z.strictObject({
    ...manifestFields,
    schemaVersion: z.literal(1),
    normalizerVersion: z.literal(1),
  }),
  z.strictObject({
    ...manifestFields,
    schemaVersion: z.literal(2),
    normalizerVersion: z.literal(1),
    format: z.enum(["mmluprox-parquet", "normalized-jsonl"]),
    prompts: z.record(languageSchema, promptLabelsSchema),
  }),
]);
export type DatasetManifest = z.infer<typeof datasetManifestSchema>;

export const usageSchema = z
  .strictObject({
    inputTokens: z.number().int().nonnegative(),
    cachedInputTokens: z.number().int().nonnegative(),
    cacheWriteTokens: z.number().int().nonnegative(),
    cacheWrite1hTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    reasoningTokens: z.number().int().nonnegative().nullable(),
  })
  .refine(
    (v) => v.cachedInputTokens + v.cacheWriteTokens + v.cacheWrite1hTokens <= v.inputTokens,
    "Cache cannot exceed total input",
  );
export type Usage = z.infer<typeof usageSchema>;

export interface GenerationRequest {
  model: string;
  effort: Effort;
  maxOutputTokens: number;
  prompt: string;
  language: Language;
  stopSequences?: readonly string[];
  // Protocol output-format hint for the synthetic adapter; never a target answer.
  answerFormat?: { prefix: string; suffix: string };
}
export interface GenerationResponse {
  model: string;
  requestId: string | null;
  text: string;
  outcome: "completed" | "refusal" | "truncated";
  usage: Usage | null;
  raw: unknown;
}
export interface TransportAdapter {
  readonly transport: Transport;
  readonly sdkVersion: string;
  readonly endpoint: string;
  generate(this: void, request: GenerationRequest): Promise<GenerationResponse>;
}

export const itemResultSchema = z.strictObject({
  jobId: z.string(),
  questionId: z.string(),
  category: z.string(),
  language: languageSchema,
  repeat: z.number().int().nonnegative(),
  transport: transportSchema,
  model: z.string(),
  returnedModel: z.string(),
  effort: effortSchema,
  prompt: z.string(),
  output: z.string(),
  expected: z.string().regex(/^[A-J]$/),
  answer: z
    .string()
    .regex(/^[A-J]$/)
    .nullable(),
  correct: z.boolean(),
  outcome: z.enum(["completed", "refusal", "truncated"]),
  usage: usageSchema.nullable(),
  costUsd: z.number().nonnegative().nullable(),
  latencyMs: z.number().nonnegative(),
  requestId: z.string().nullable(),
});
export type ItemResult = z.infer<typeof itemResultSchema>;
const accuracySchema = z.number().min(0).max(1);
export const languageScoreSchema = z.strictObject({
  language: languageSchema,
  n: z.number().int().positive(),
  accuracy: accuracySchema,
  repeatAccuracy: z.array(accuracySchema).min(1),
});
export const comparisonResultSchema = z
  .strictObject({
    ...comparisonSchema.shape,
    n: z.number().int().positive(),
    gapPp: z.number().min(-100).max(100),
    gapCi95: z.tuple([z.number().min(-100).max(100), z.number().min(-100).max(100)]),
  })
  .refine(
    (row) => row.baseline !== row.language && row.gapCi95[0] <= row.gapCi95[1],
    "Invalid comparison",
  );
export const aggregateSchema = z
  .strictObject({
    transport: transportSchema,
    model: z.string(),
    effort: effortSchema,
    repeats: z.number().int().positive(),
    scores: z.array(languageScoreSchema).min(1),
    comparisons: z.array(comparisonResultSchema),
    unparseable: z.number().int().nonnegative(),
    refusals: z.number().int().nonnegative(),
    costUsd: z.number().nonnegative().nullable(),
  })
  .refine(
    (row) => new Set(row.scores.map((score) => score.language)).size === row.scores.length,
    "Duplicate language score",
  )
  .refine(
    (row) => row.scores.every((score) => score.repeatAccuracy.length === row.repeats),
    "Incomplete per-repeat scores",
  )
  .refine(
    (row) =>
      row.comparisons.every((pair) =>
        [pair.baseline, pair.language].every((language) =>
          row.scores.some((score) => score.language === language && score.n === pair.n),
        ),
      ),
    "Missing comparison score",
  );
export type Aggregate = z.infer<typeof aggregateSchema>;
export const releaseManifestSchema = z
  .strictObject({
    schemaVersion: z.literal(3),
    id: safeIdSchema,
    runId: safeIdSchema,
    createdAt: z.iso.datetime(),
    kind: z.enum(["benchmark", "test"]),
    dataset: z.string(),
    datasetRevision: z.string(),
    languages: languagesSchema,
    comparisons: comparisonsSchema,
    protocol: z.string(),
    configHash: hashSchema,
    files: z.record(z.string(), hashSchema),
    aggregate: z.array(aggregateSchema).min(1),
  })
  .refine(
    (release) =>
      release.aggregate.every(
        (row) =>
          JSON.stringify(row.scores.map((score) => score.language)) ===
            JSON.stringify(release.languages) &&
          JSON.stringify(
            row.comparisons.map(({ baseline, language }) => ({ baseline, language })),
          ) === JSON.stringify(release.comparisons),
      ),
    "Aggregate conditions differ from release",
  );
export type ReleaseManifest = z.infer<typeof releaseManifestSchema>;
