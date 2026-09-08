import { z } from "zod";
import {
  effortSchema,
  getModelIdentity,
  hashSchema,
  languageSchema,
  languagesSchema,
  safeIdSchema,
  transportSchema,
  type ModelReference,
} from "./index";

const referenceSchema = z.strictObject({ transport: transportSchema, model: z.string().min(1) });
const positive = z.number().positive();
const unique = <T>(values: T[], key: (value: T) => string) =>
  new Set(values.map(key)).size === values.length;

// An identity groups history, never execution settings or provider results for scoring.
export function guideModelIdentity(reference: ModelReference) {
  const { owner, name } = getModelIdentity(reference);
  return { id: `${owner ?? `api-${reference.transport}`}/${name}`, owner, name };
}

export const evidenceLanguageSchema = z.strictObject({
  language: languageSchema,
  n: z.number().int().positive(),
  inputHash: hashSchema,
  alignmentHash: hashSchema,
  randomBaseline: z.number().min(0).max(0.5),
});
export const releaseEvidenceSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    releaseId: safeIdSchema,
    runCreatedAt: z.iso.datetime(),
    configHash: hashSchema,
    datasetManifestHash: hashSchema,
    protocolHash: hashSchema,
    languages: z.array(evidenceLanguageSchema).min(1),
    configurations: z
      .array(referenceSchema.extend({ maxOutputTokens: z.number().int().positive().nullable() }))
      .min(1),
  })
  .refine(
    (value) =>
      unique(value.languages, (entry) => entry.language) &&
      unique(value.configurations, (entry) => `${entry.transport}/${entry.model}`),
    "Duplicate evidence condition",
  );
export type ReleaseEvidence = z.infer<typeof releaseEvidenceSchema>;

export const guideSuiteSchema = z
  .strictObject({
    id: safeIdSchema,
    families: z.array(z.strictObject({ id: safeIdSchema, weight: positive })).min(1),
    tasks: z
      .array(
        z.strictObject({
          id: safeIdSchema,
          family: safeIdSchema,
          weight: positive,
          dataset: safeIdSchema,
          datasetRevision: z.string().min(1),
          datasetManifestHash: hashSchema,
          protocol: z.string().min(1),
          protocolHash: hashSchema,
          maxOutputTokens: z.number().int().positive().nullable(),
          repeats: z.number().int().positive(),
          languages: z.array(evidenceLanguageSchema).min(1),
        }),
      )
      .min(1),
  })
  .refine(
    (suite) =>
      unique(suite.families, (family) => family.id) &&
      unique(suite.tasks, (task) => task.id) &&
      unique(
        suite.tasks,
        (task) =>
          `${task.dataset}/${task.datasetManifestHash}/${task.protocolHash}/${task.maxOutputTokens}/${task.repeats}`,
      ) &&
      suite.tasks.every(
        (task) =>
          suite.families.some((family) => family.id === task.family) &&
          unique(task.languages, (entry) => entry.language),
      ) &&
      suite.families.every((family) => suite.tasks.some((task) => task.family === family.id)),
    "Duplicate task, language or family, or unknown/unused family",
  );

export const guideProfileSchema = referenceSchema.extend({ effort: effortSchema });
export const guidePlanSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    suite: guideSuiteSchema,
    configurationRows: z.literal(true).optional(),
    profiles: z.array(guideProfileSchema),
    releases: z.array(safeIdSchema),
  })
  .refine(
    (plan) =>
      unique(plan.profiles, (profile) =>
        plan.configurationRows ? guideProfileKey(profile) : guideModelIdentity(profile).id,
      ) && unique(plan.releases, (id) => id),
    "Duplicate model profile or release",
  );
export type GuidePlan = z.infer<typeof guidePlanSchema>;

export const guideContributionSchema = guideProfileSchema.extend({
  taskId: safeIdSchema,
  releaseId: safeIdSchema,
  accuracy: z.number().min(0).max(1),
  value: z.number().min(0).max(100),
  n: z.number().int().positive(),
  repeats: z.number().int().positive(),
});
export const guideScoreSchema = z
  .strictObject({
    language: languageSchema,
    value: z.number().min(0).max(100).nullable(),
    status: z.enum(["ready", "incomplete", "unmeasured"]),
    basis: hashSchema,
    comparisonBasis: hashSchema,
    contributions: z.array(guideContributionSchema),
    required: z.number().int().positive(),
  })
  .refine(
    (score) =>
      (score.status === "ready") === (score.value !== null) &&
      (score.status === "ready"
        ? score.contributions.length === score.required
        : score.contributions.length < score.required) &&
      unique(score.contributions, (entry) => entry.taskId),
    "Invalid score coverage",
  );
export type GuideScore = z.infer<typeof guideScoreSchema>;
export const guideModelSchema = z
  .strictObject({
    id: z.string().min(1),
    reference: referenceSchema,
    profile: guideProfileSchema.nullable(),
    scores: z.array(guideScoreSchema),
  })
  .refine(
    (model) =>
      model.id === guideModelIdentity(model.reference).id &&
      (model.profile === null || model.id === guideModelIdentity(model.profile).id) &&
      unique(model.scores, (score) => score.language),
    "Invalid model identity or duplicate score",
  );
export type GuideModel = z.infer<typeof guideModelSchema>;

export const guideSnapshotSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    id: safeIdSchema,
    createdAt: z.iso.datetime(),
    plan: guidePlanSchema,
    languages: languagesSchema,
    models: z.array(guideModelSchema),
    sources: z.array(
      z.strictObject({
        releaseId: safeIdSchema,
        manifestHash: hashSchema,
        evidenceHash: hashSchema.nullable(),
      }),
    ),
  })
  .refine(
    (snapshot) =>
      unique(snapshot.models, (model) =>
        snapshot.plan.configurationRows ? guideRowKey(model) : model.id,
      ) &&
      unique(snapshot.sources, (source) => source.releaseId) &&
      snapshot.sources.length === snapshot.plan.releases.length &&
      snapshot.sources.every((source) => snapshot.plan.releases.includes(source.releaseId)),
    "Invalid guide sources or duplicate model",
  );
export type GuideSnapshot = z.infer<typeof guideSnapshotSchema>;
export const guideIndexSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    latest: safeIdSchema.nullable(),
    snapshots: z.array(z.strictObject({ id: safeIdSchema, sha256: hashSchema })),
  })
  .refine(
    (index) =>
      unique(index.snapshots, (entry) => entry.id) &&
      (index.latest === null || index.snapshots.some((entry) => entry.id === index.latest)),
    "Invalid guide index",
  );

export const guideProfileKey = (profile: z.infer<typeof guideProfileSchema>) =>
  JSON.stringify([profile.transport, profile.model, profile.effort]);
export const guideRowKey = (model: GuideModel) =>
  model.profile ? guideProfileKey(model.profile) : model.id;
