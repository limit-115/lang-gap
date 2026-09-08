import { guideRowKey, type GuideModel, type GuideSnapshot } from "@llang-gap/contracts/guide";
import { getModelPresentation } from "@/features/leaderboard/model-catalog";
import { guideLanguages } from "@/features/leaderboard/table-state";

const colors = ["#267659", "#8273be", "#b47793", "#618fa1", "#ba795b", "#b49b40"];

export type LanguageModel = GuideModel & {
  key: string;
  name: string;
  owner: string | null;
  developer: string;
  color: string;
};

export function languageData(guide: GuideSnapshot | null) {
  // Historical normalized scores are not percentages of correct answers.
  const models: LanguageModel[] =
    guide?.plan.schemaVersion === 2
      ? guide.models.map((model, index) => {
          const presentation = getModelPresentation(model.reference);
          return {
            ...model,
            key: guideRowKey(model),
            name: presentation.label,
            owner: presentation.ownerId,
            developer: presentation.ownerName,
            color: colors[index % colors.length]!,
          };
        })
      : [];
  return {
    models,
    languages: guideLanguages(models, guide?.languages),
    createdAt: guide?.createdAt ?? null,
  };
}

export function scoreValue(model: GuideModel, language: string, dataset?: string): number | null {
  const score = model.scores.find((entry) => entry.language === language);
  if (!score) return null;
  if (dataset) {
    const contribution = score.contributions.find((entry) => entry.taskId === dataset);
    return contribution ? contribution.accuracy * 100 : null;
  }
  return score.status === "ready" ? score.value : null;
}

export function languageDatasets(models: readonly GuideModel[], language: string) {
  return [
    ...new Set(
      models.flatMap((model) =>
        model.scores
          .filter((score) => score.language === language)
          .flatMap((score) => score.contributions.map((entry) => entry.taskId)),
      ),
    ),
  ].sort();
}

// Ignore arithmetic noise in published averages when assigning shared ranks.
export function scoreDifference(a: number, b: number) {
  return Math.abs(a - b) < 1e-9 ? 0 : a - b;
}

export function rankedModels(models: readonly LanguageModel[], language: string, dataset?: string) {
  const rows = models
    .flatMap((model) => {
      const score = scoreValue(model, language, dataset);
      return score === null ? [] : [{ model, score }];
    })
    .sort(
      (a, b) =>
        scoreDifference(b.score, a.score) ||
        a.model.name.localeCompare(b.model.name) ||
        a.model.key.localeCompare(b.model.key),
    );
  return rows.map((row) => ({
    ...row,
    rank: rows.findIndex((other) => scoreDifference(other.score, row.score) === 0) + 1,
  }));
}
