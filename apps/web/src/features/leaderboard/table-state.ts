import type { Comparison, ModelReference } from "@llang-gap/contracts";
import { guideModelIdentity, type GuideModel } from "@llang-gap/contracts/guide";

export const accuracyColumnId = (language: string) => `score:${language}`;
export const comparisonColumnId = (pair: Comparison) =>
  `difference:${pair.baseline}:${pair.language}`;
export const modelGuideHref = (reference: ModelReference) => {
  const { id, name } = guideModelIdentity(reference);
  return `/models/${encodeURIComponent(id.slice(0, id.length - name.length - 1))}/${encodeURIComponent(name)}`;
};

export function visibleComparison(pair: Comparison | null, languages: readonly string[]) {
  return pair &&
    pair.baseline !== pair.language &&
    languages.includes(pair.baseline) &&
    languages.includes(pair.language)
    ? pair
    : null;
}

export function scoreDifference(model: GuideModel, pair: Comparison) {
  const baseline = model.scores.find((score) => score.language === pair.baseline);
  const candidate = model.scores.find((score) => score.language === pair.language);
  if (
    !baseline ||
    !candidate ||
    baseline.value === null ||
    candidate.value === null ||
    baseline.comparisonBasis !== candidate.comparisonBasis
  )
    return undefined;
  return baseline.value - candidate.value;
}

export function guideLanguages(models: readonly GuideModel[], declared: readonly string[] = []) {
  return [
    ...new Set([
      ...declared,
      ...models.flatMap((model) => model.scores.map((score) => score.language)),
    ]),
  ].sort();
}
