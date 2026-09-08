import { createHash } from "node:crypto";
import { releaseManifestSchema, type ReleaseManifest } from "@llang-gap/contracts";
import {
  guideModelIdentity,
  guideProfileKey,
  guidePlanSchema,
  guideSnapshotSchema,
  releaseEvidenceSchema,
  type GuidePlan,
  type PublishedGuidePlan,
  type SummaryPlan,
  type GuideScore,
  type ReleaseEvidence,
} from "@llang-gap/contracts/guide";

import { buildPublishedSummary } from "./summary";

export type GuideRelease = {
  manifest: ReleaseManifest;
  evidence: ReleaseEvidence | null;
  manifestHash: string;
  evidenceHash: string | null;
};
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const mean = (values: { value: number; weight: number }[]) => {
  const scale = values.reduce((maximum, entry) => Math.max(maximum, entry.weight), 0);
  const total = values.reduce((sum, entry) => sum + entry.weight / scale, 0);
  return Math.min(
    100,
    Math.max(
      0,
      values.reduce((sum, entry) => sum + entry.value * (entry.weight / scale), 0) / total,
    ),
  );
};

type TaskCondition = Pick<
  GuidePlan["suite"]["tasks"][number],
  | "dataset"
  | "datasetRevision"
  | "datasetManifestHash"
  | "protocol"
  | "protocolHash"
  | "maxOutputTokens"
  | "repeats"
>;
const conditionKey = (
  task: TaskCondition,
  profile: GuidePlan["profiles"][number],
  language: ReleaseEvidence["languages"][number],
) =>
  JSON.stringify([
    task.dataset,
    task.datasetRevision,
    task.datasetManifestHash,
    task.protocol,
    task.protocolHash,
    task.maxOutputTokens,
    task.repeats,
    profile.transport,
    profile.model,
    profile.effort,
    language.language,
    language.n,
    language.inputHash,
    language.alignmentHash,
    language.randomBaseline,
  ]);

/** Resolve the publication inventory without inferring new tasks or scientific weights. */
export function reconcileGuidePlan(planInput: GuidePlan, inputs: GuideRelease[]): GuidePlan;
export function reconcileGuidePlan(planInput: SummaryPlan, inputs: GuideRelease[]): SummaryPlan;
export function reconcileGuidePlan(
  planInput: PublishedGuidePlan,
  inputs: GuideRelease[],
): PublishedGuidePlan;
export function reconcileGuidePlan(
  planInput: PublishedGuidePlan,
  inputs: GuideRelease[],
): PublishedGuidePlan {
  const plan = guidePlanSchema.parse(planInput);
  if (plan.schemaVersion === 2) {
    plan.releases = inputs.map(({ manifest }) => manifest.id).sort();
    validateGuideReleases(plan, inputs);
    return plan;
  }
  if (!plan.configurationRows)
    throw new Error(
      "Automatic publication requires configurationRows: true; migrate the suite explicitly",
    );
  plan.releases = inputs.map(({ manifest }) => manifest.id).sort();
  // Reuse the scoring boundary's provenance and source validation before discovering inputs.
  const releases = validateGuideReleases(plan, inputs);
  const pinnedLanguages = new Set(
    plan.suite.tasks.flatMap((task) => task.languages.map((entry) => entry.language)),
  );
  const candidates = new Map<string, Map<string, ReleaseEvidence["languages"][number]>>();
  const originalSuite = JSON.stringify(plan.suite);
  const profiles = new Map(plan.profiles.map((profile) => [guideProfileKey(profile), profile]));
  for (const { manifest, evidence } of releases.sort((a, b) =>
    a.manifest.id.localeCompare(b.manifest.id),
  )) {
    for (const row of manifest.aggregate) {
      const profile = { transport: row.transport, model: row.model, effort: row.effort };
      profiles.set(guideProfileKey(profile), profile);
      const configuration = evidence?.configurations.find(
        (entry) => entry.transport === row.transport && entry.model === row.model,
      );
      if (!evidence || !configuration) continue;
      for (const task of plan.suite.tasks) {
        if (
          task.dataset !== manifest.dataset ||
          task.datasetRevision !== manifest.datasetRevision ||
          task.datasetManifestHash !== evidence.datasetManifestHash ||
          task.protocol !== manifest.protocol ||
          task.protocolHash !== evidence.protocolHash ||
          task.maxOutputTokens !== configuration.maxOutputTokens ||
          task.repeats !== row.repeats
        )
          continue;
        for (const language of evidence.languages) {
          if (
            !row.scores.some(
              (score) => score.language === language.language && score.n === language.n,
            )
          )
            continue;
          if (pinnedLanguages.has(language.language)) continue;
          const tasks = candidates.get(language.language) ?? new Map();
          const existing = tasks.get(task.id);
          if (existing && JSON.stringify(existing) !== JSON.stringify(language))
            throw new Error(
              `Conflicting new language inputs for ${task.id}/${language.language}; pin the intended basis explicitly`,
            );
          tasks.set(task.id, language);
          candidates.set(language.language, tasks);
        }
      }
    }
  }
  // A newly discovered column must have a complete declared task basis. Otherwise
  // publishing only one dataset would silently average a subset of the suite.
  for (const [language, tasks] of candidates) {
    if (!plan.suite.tasks.every((task) => tasks.has(task.id))) continue;
    for (const task of plan.suite.tasks) task.languages.push({ ...tasks.get(task.id)!, language });
  }
  plan.profiles = [...profiles.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, profile]) => profile);
  if (JSON.stringify(plan.suite) !== originalSuite) {
    for (const task of plan.suite.tasks)
      task.languages.sort((a, b) => a.language.localeCompare(b.language));
    const { id: _id, ...basis } = plan.suite;
    plan.suite.id = `published-${digest(basis).slice(0, 20)}`;
  }
  return guidePlanSchema.parse(plan);
}

function validateGuideReleases(plan: Pick<GuidePlan, "releases">, inputs: GuideRelease[]) {
  const releases = inputs.map((entry) => ({
    ...entry,
    manifest: releaseManifestSchema.parse(entry.manifest),
    evidence: entry.evidence === null ? null : releaseEvidenceSchema.parse(entry.evidence),
  }));
  if (
    new Set(releases.map((entry) => entry.manifest.id)).size !== releases.length ||
    releases.length !== plan.releases.length ||
    releases.some(({ manifest }) => !plan.releases.includes(manifest.id))
  )
    throw new Error("Guide release set differs from plan");
  for (const { manifest, evidence } of releases) {
    if (manifest.kind !== "benchmark" || manifest.aggregate.some((row) => row.transport === "fake"))
      throw new Error("Only published benchmark results can enter a guide");
    if (
      evidence &&
      (evidence.releaseId !== manifest.id ||
        evidence.configHash !== manifest.configHash ||
        evidence.datasetManifestHash !== manifest.files["dataset-manifest.json"])
    )
      throw new Error(`Evidence provenance mismatch: ${manifest.id}`);
  }
  return releases;
}

export function buildGuide(
  planInput: PublishedGuidePlan,
  inputs: GuideRelease[],
  id: string,
  createdAt: string,
) {
  const plan = guidePlanSchema.parse(planInput);
  const releases = validateGuideReleases(plan, inputs);
  if (plan.schemaVersion === 2) return buildPublishedSummary(plan, releases, id, createdAt);
  // Selection is chronological, never dependent on accuracy, n, number of runs or index order.
  releases.sort(
    (a, b) =>
      (b.evidence?.runCreatedAt ?? b.manifest.createdAt).localeCompare(
        a.evidence?.runCreatedAt ?? a.manifest.createdAt,
      ) ||
      b.manifest.createdAt.localeCompare(a.manifest.createdAt) ||
      b.manifest.id.localeCompare(a.manifest.id),
  );
  const models = new Map<string, ReleaseManifest["aggregate"][number]>();
  const measured = new Set<string>();
  const observations = new Map<
    string,
    {
      releaseId: string;
      score: ReleaseManifest["aggregate"][number]["scores"][number];
      repeats: number;
    }
  >();
  for (const { manifest, evidence } of releases) {
    const rowKeys = new Set<string>();
    for (const row of [...manifest.aggregate].sort((a, b) =>
      `${a.transport}/${a.model}`.localeCompare(`${b.transport}/${b.model}`),
    )) {
      const rowKey = JSON.stringify([row.transport, row.model, row.effort]);
      if (rowKeys.has(rowKey)) throw new Error("Duplicate published model condition");
      rowKeys.add(rowKey);
      const modelKey = plan.configurationRows ? guideProfileKey(row) : guideModelIdentity(row).id;
      if (!models.has(modelKey)) models.set(modelKey, row);
      const configuration = evidence?.configurations.find(
        (entry) => entry.transport === row.transport && entry.model === row.model,
      );
      for (const score of row.scores) {
        measured.add(JSON.stringify([modelKey, score.language]));
        const language = evidence?.languages.find((entry) => entry.language === score.language);
        if (!evidence || !configuration || !language || language.n !== score.n) continue;
        const key = conditionKey(
          {
            dataset: manifest.dataset,
            datasetRevision: manifest.datasetRevision,
            datasetManifestHash: evidence.datasetManifestHash,
            protocol: manifest.protocol,
            protocolHash: evidence.protocolHash,
            maxOutputTokens: configuration.maxOutputTokens,
            repeats: row.repeats,
          },
          row,
          language,
        );
        if (!observations.has(key))
          observations.set(key, { releaseId: manifest.id, score, repeats: row.repeats });
      }
    }
  }
  const languages = [
    ...new Set([
      ...plan.suite.tasks.flatMap((task) => task.languages.map((entry) => entry.language)),
      ...releases.flatMap(({ manifest }) => manifest.languages),
    ]),
  ].sort();
  const output = [...models.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, reference]) => {
      const profile =
        plan.profiles.find(
          (entry) =>
            (plan.configurationRows ? guideProfileKey(entry) : guideModelIdentity(entry).id) ===
            key,
        ) ?? null;
      const scores = languages.flatMap((language): GuideScore[] => {
        const tasks = plan.suite.tasks
          .filter((task) => task.languages.some((entry) => entry.language === language))
          .sort((a, b) => a.id.localeCompare(b.id));
        if (!tasks.length) return [];
        const basisEntries = tasks.map((task) => {
          const condition = task.languages.find((entry) => entry.language === language)!;
          const family = plan.suite.families.find((entry) => entry.id === task.family)!;
          return {
            id: task.id,
            family: task.family,
            familyWeight: family.weight,
            weight: task.weight,
            dataset: task.dataset,
            datasetRevision: task.datasetRevision,
            datasetManifestHash: task.datasetManifestHash,
            protocolHash: task.protocolHash,
            cap: task.maxOutputTokens,
            repeats: task.repeats,
            n: condition.n,
            baseline: condition.randomBaseline,
            alignmentHash: condition.alignmentHash,
            inputHash: condition.inputHash,
          };
        });
        const contributions = tasks.flatMap((task) => {
          if (!profile) return [];
          const expected = task.languages.find((entry) => entry.language === language)!;
          const observation = observations.get(conditionKey(task, profile, expected));
          if (!observation) return [];
          return [
            {
              ...profile,
              taskId: task.id,
              releaseId: observation.releaseId,
              accuracy: observation.score.accuracy,
              value:
                100 *
                Math.max(
                  0,
                  (observation.score.accuracy - expected.randomBaseline) /
                    (1 - expected.randomBaseline),
                ),
              n: observation.score.n,
              repeats: observation.repeats,
            },
          ];
        });
        const ready = contributions.length === tasks.length;
        const families = plan.suite.families.filter((family) =>
          tasks.some((task) => task.family === family.id),
        );
        const hasMeasurement = measured.has(JSON.stringify([key, language]));
        return [
          {
            language,
            status: ready ? "ready" : hasMeasurement ? "incomplete" : "unmeasured",
            value: ready
              ? mean(
                  families.map((family) => ({
                    weight: family.weight,
                    value: mean(
                      tasks
                        .filter((task) => task.family === family.id)
                        .map((task) => ({
                          weight: task.weight,
                          value: contributions.find((entry) => entry.taskId === task.id)!.value,
                        })),
                    ),
                  })),
                )
              : null,
            required: tasks.length,
            contributions,
            basis: digest(basisEntries),
            comparisonBasis: digest(
              basisEntries.map(({ inputHash: _inputHash, ...entry }) => entry),
            ),
          },
        ];
      });
      return {
        id: guideModelIdentity(reference).id,
        reference: { transport: reference.transport, model: reference.model },
        profile:
          profile ??
          (plan.configurationRows
            ? { transport: reference.transport, model: reference.model, effort: reference.effort }
            : null),
        scores,
      };
    });
  return guideSnapshotSchema.parse({
    schemaVersion: 1,
    id,
    createdAt,
    plan,
    languages,
    models: output,
    sources: releases
      .map(({ manifest, manifestHash, evidenceHash }) => ({
        releaseId: manifest.id,
        manifestHash,
        evidenceHash,
      }))
      .sort((a, b) => a.releaseId.localeCompare(b.releaseId)),
  });
}
