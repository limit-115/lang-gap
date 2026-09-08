import { createHash } from "node:crypto";
import {
  guideModelIdentity,
  guideProfileKey,
  guideSnapshotSchema,
  type GuideModel,
  type GuideScore,
  type SummaryPlan,
} from "@llang-gap/contracts/guide";
import type { Aggregate } from "@llang-gap/contracts";
import type { GuideRelease } from "./guide";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
type Observation = {
  source: GuideRelease;
  row: Aggregate;
  score: Aggregate["scores"][number];
};

/** Published summaries select evidence by recency, then give each available dataset one vote. */
export function buildPublishedSummary(
  plan: SummaryPlan,
  inputs: GuideRelease[],
  id: string,
  createdAt: string,
) {
  const releases = [...inputs].sort(
    (a, b) =>
      (b.evidence?.runCreatedAt ?? b.manifest.createdAt).localeCompare(
        a.evidence?.runCreatedAt ?? a.manifest.createdAt,
      ) ||
      b.manifest.createdAt.localeCompare(a.manifest.createdAt) ||
      b.manifest.id.localeCompare(a.manifest.id),
  );
  const rows = new Map<string, { model: GuideModel; observations: Map<string, Observation> }>();
  const languages = [...new Set(releases.flatMap(({ manifest }) => manifest.languages))].sort();
  for (const source of releases) {
    const seen = new Set<string>();
    for (const row of source.manifest.aggregate) {
      const profile = { transport: row.transport, model: row.model, effort: row.effort };
      const key = guideProfileKey(profile);
      if (seen.has(key)) throw new Error("Duplicate published model condition");
      seen.add(key);
      const entry = rows.get(key) ?? {
        model: {
          id: guideModelIdentity(profile).id,
          reference: { transport: row.transport, model: row.model },
          profile,
          scores: [],
        },
        observations: new Map<string, Observation>(),
      };
      rows.set(key, entry);
      for (const score of row.scores) {
        const observationKey = JSON.stringify([source.manifest.dataset, score.language]);
        if (!entry.observations.has(observationKey)) {
          entry.observations.set(observationKey, { source, row, score });
        }
      }
    }
  }
  const models = [...rows.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, entry]) => {
      entry.model.scores = languages.map((language): GuideScore => {
        const selected = [...entry.observations.values()]
          .filter(({ score }) => score.language === language)
          .sort((a, b) => a.source.manifest.dataset.localeCompare(b.source.manifest.dataset));
        const contributions = selected.map(({ source, row, score }) => ({
          transport: row.transport,
          model: row.model,
          effort: row.effort,
          taskId: source.manifest.dataset,
          releaseId: source.manifest.id,
          accuracy: score.accuracy,
          value: 100 * score.accuracy,
          n: score.n,
          repeats: row.repeats,
        }));
        // Alignment only controls the optional difference between languages; it never hides accuracy.
        const comparison = selected.map(({ source, score }) => {
          const evidence = source.evidence?.languages.find((item) => item.language === language);
          return {
            dataset: source.manifest.dataset,
            revision: source.manifest.datasetRevision,
            manifest: source.manifest.files["dataset-manifest.json"],
            protocol: source.manifest.protocol,
            protocolHash: source.evidence?.protocolHash,
            n: score.n,
            alignment: evidence?.alignmentHash ?? `unverified:${language}`,
          };
        });
        return {
          language,
          value: contributions.length
            ? Math.min(
                100,
                contributions.reduce((total, item) => total + item.value, 0) / contributions.length,
              )
            : null,
          status: contributions.length ? "ready" : "unmeasured",
          required: Math.max(1, contributions.length),
          contributions,
          basis: hash({ aggregation: plan.aggregation, language, contributions }),
          comparisonBasis: hash({ aggregation: plan.aggregation, datasets: comparison }),
        };
      });
      return entry.model;
    });
  return guideSnapshotSchema.parse({
    schemaVersion: 1,
    id,
    createdAt,
    plan,
    languages,
    models,
    sources: inputs
      .map(({ manifest, manifestHash, evidenceHash }) => ({
        releaseId: manifest.id,
        manifestHash,
        evidenceHash,
      }))
      .sort((a, b) => a.releaseId.localeCompare(b.releaseId)),
  });
}
