import { z } from "zod";

export const languageSchema = z.enum(["en", "ru"]);
export const effortSchema = z.enum(["low", "medium", "high"]);
export const providerSchema = z.enum(["openai", "anthropic", "fake"]);
export const safeIdSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]{0,99}$/);
export const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export type Language = z.infer<typeof languageSchema>;
export type Effort = z.infer<typeof effortSchema>;
export type Provider = z.infer<typeof providerSchema>;

export const questionSchema = z
  .strictObject({
    id: z.string().min(1),
    sourceId: z.number().int(),
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
export const modelSchema = z.strictObject({
  provider: providerSchema,
  model: safeIdSchema,
  efforts: z
    .array(effortSchema)
    .min(1)
    .refine((v) => new Set(v).size === v.length, "Duplicate effort"),
  maxOutputTokens: z.number().int().min(256).max(128_000),
  pricing: pricingSchema,
});
export type ModelConfig = z.infer<typeof modelSchema>;

export const experimentSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    id: safeIdSchema,
    dataset: z.literal("mmlu-prox-lite"),
    protocol: z.enum([
      "mmluprox-lite-5shot-native-reasoning-v1",
      "mmluprox-lite-5shot-native-reasoning-v2",
    ]),
    languages: z.tuple([z.literal("en"), z.literal("ru")]),
    repeats: z.number().int().min(1).max(10),
    seed: z.number().int().min(1).max(2_147_483_647),
    models: z
      .array(modelSchema)
      .min(1)
      .refine(
        (models) => new Set(models.map((m) => `${m.provider}/${m.model}`)).size === models.length,
        "Duplicate model",
      ),
    execution: z.strictObject({
      concurrency: z.number().int().min(1).max(32),
      maxAttempts: z.number().int().min(1).max(5),
      timeoutMs: z.number().int().min(1000).max(3_600_000),
    }),
    // A fixed subset supports technical pilots; releases require the entire test split.
    questionLimit: z.number().int().min(1).max(588).optional(),
    questionsPerCategory: z.number().int().min(1).max(588).optional(),
  })
  .refine(
    (value) => value.questionLimit === undefined || value.questionsPerCategory === undefined,
    "Choose either questionLimit or questionsPerCategory, not both",
  );
export type Experiment = z.infer<typeof experimentSchema>;
export const experimentJsonSchema = () =>
  z.toJSONSchema(experimentSchema, { target: "draft-2020-12" });

export const datasetManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.literal("mmlu-prox-lite"),
  repository: z.literal("li-lab/MMLU-ProX-Lite"),
  revision: z.string().regex(/^[a-f0-9]{40}$/),
  normalizerVersion: z.literal(1),
  license: z.string(),
  source: z.url(),
  files: z
    .array(
      z.strictObject({
        path: z.string().regex(/^(en|ru)\/(test|validation)-00000-of-00001\.parquet$/),
        language: languageSchema,
        split: z.enum(["test", "validation"]),
        rows: z.number().int().positive(),
        sha256: hashSchema,
      }),
    )
    .length(4),
});
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
}
export interface GenerationResponse {
  model: string;
  requestId: string | null;
  text: string;
  outcome: "completed" | "refusal" | "truncated";
  usage: Usage | null;
  raw: unknown;
}
export interface ProviderAdapter {
  readonly name: Provider;
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
  provider: providerSchema,
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
export const aggregateSchema = z.strictObject({
  provider: providerSchema,
  model: z.string(),
  effort: effortSchema,
  n: z.number().int().positive(),
  repeats: z.number().int().positive(),
  en: z.number().min(0).max(1),
  ru: z.number().min(0).max(1),
  gapPp: z.number().min(-100).max(100),
  gapCi95: z.tuple([z.number(), z.number()]),
  repeatAccuracy: z.strictObject({ en: z.array(z.number()), ru: z.array(z.number()) }),
  unparseable: z.number().int().nonnegative(),
  refusals: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative().nullable(),
});
export type Aggregate = z.infer<typeof aggregateSchema>;
export const releaseManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: safeIdSchema,
  runId: safeIdSchema,
  createdAt: z.iso.datetime(),
  kind: z.enum(["benchmark", "test"]),
  dataset: z.string(),
  datasetRevision: z.string(),
  protocol: z.string(),
  configHash: hashSchema,
  files: z.record(z.string(), hashSchema),
  aggregate: z.array(aggregateSchema).min(1),
});
export type ReleaseManifest = z.infer<typeof releaseManifestSchema>;
