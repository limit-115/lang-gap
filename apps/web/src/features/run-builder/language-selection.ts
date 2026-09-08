import type { RunDataset } from "@llang-gap/contracts/run-catalog";

export function getLanguageChoices(
  dataset: RunDataset | undefined,
  protocolId: string,
  selected: readonly string[],
) {
  const protocol = dataset?.protocols.find((entry) => entry.id === protocolId);
  const tags = (dataset?.languages ?? [])
    .filter(({ tag }) => protocol?.languages.includes(tag))
    .map(({ tag }) => tag);
  return { tags, allSelected: tags.length > 0 && tags.every((tag) => selected.includes(tag)) };
}

export function getQuestionRange(languages: RunDataset["languages"]) {
  if (!languages.length) return null;
  const counts = languages.map(({ questions }) => questions);
  return { min: Math.min(...counts), max: Math.max(...counts) };
}
