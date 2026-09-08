import type { ModelReference } from "@llang-gap/contracts";
import { guideModelIdentity, type GuideModel } from "@llang-gap/contracts/guide";

export const accuracyColumnId = (language: string) => `score:${language}`;
export const modelGuideHref = (reference: ModelReference) => {
  const { id, name } = guideModelIdentity(reference);
  return `/models/${encodeURIComponent(id.slice(0, id.length - name.length - 1))}/${encodeURIComponent(name)}`;
};

// Display preferences only; available benchmark languages still come from published inputs.
export function initialLanguages(languages: readonly string[]) {
  const preferred = ["en", "ru", "kk", "es", "zh"].filter((language) =>
    languages.includes(language),
  );
  return preferred.length ? preferred : [...languages].slice(0, 3);
}

export function englishScoreDifference(model: GuideModel, language: string) {
  if (language === "en") return undefined;
  const baseline = model.scores.find((score) => score.language === "en");
  const candidate = model.scores.find((score) => score.language === language);
  if (
    !baseline ||
    !candidate ||
    baseline.status !== "ready" ||
    candidate.status !== "ready" ||
    baseline.value === null ||
    candidate.value === null ||
    baseline.comparisonBasis !== candidate.comparisonBasis
  )
    return undefined;
  return candidate.value - baseline.value;
}

export function guideLanguages(models: readonly GuideModel[], declared: readonly string[] = []) {
  return [
    ...new Set([
      ...declared,
      ...models.flatMap((model) => model.scores.map((score) => score.language)),
    ]),
  ].sort();
}

export function guideConfigurationHref(model: GuideModel) {
  const query = new URLSearchParams();
  if (model.profile) {
    query.set("effort", model.profile.effort);
    query.set("transport", model.profile.transport);
    query.set("model", model.profile.model);
  }
  return `${modelGuideHref(model.reference)}?${query}`;
}
