import { getModelIdentity, type Aggregate, type ModelReference } from "@llang-gap/contracts";
import type { LeaderboardRow } from "./columns";

export const efforts = ["low", "medium", "high"] as const;
const ownerNames: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  "meta-llama": "Meta",
  "x-ai": "xAI",
  mistralai: "Mistral AI",
  deepseek: "DeepSeek",
  qwen: "Qwen",
  fake: "fake",
};
const plannedModels = [
  { provider: "openai", model: "gpt-6-astra", label: "GPT-6 Astra" },
  { provider: "anthropic", model: "claude-fable-5-1", label: "Claude Fable 5.1" },
] as const satisfies readonly (ModelReference & { label: string })[];
const modelNames = new Map(
  plannedModels.map(({ provider, model, label }) => [`${provider}/${model}`, label]),
);

export function getModelPresentation(reference: ModelReference) {
  const { owner, name } = getModelIdentity(reference);
  return {
    label: modelNames.get(`${owner}/${name}`) ?? name,
    ownerName: owner === null ? "—" : (ownerNames[owner] ?? owner),
  };
}

export const plannedRows: LeaderboardRow[] = plannedModels.flatMap(({ provider, model }) =>
  efforts.map((effort) => ({
    model,
    provider,
    effort,
    en: null,
    ru: null,
    gapPp: null,
    gapCi95: null,
  })),
);

export function getModelOptions(rows: Pick<Aggregate, "model" | "provider">[]) {
  const unique = new Map<
    string,
    ModelReference & ReturnType<typeof getModelPresentation> & { value: string }
  >();
  for (const row of rows) {
    const value = `${row.provider}/${row.model}`;
    unique.set(value, {
      value,
      model: row.model,
      provider: row.provider,
      ...getModelPresentation(row),
    });
  }
  return [...unique.values()].sort(
    (a, b) => a.label.localeCompare(b.label, "en") || a.value.localeCompare(b.value, "en"),
  );
}
export type ModelOption = ReturnType<typeof getModelOptions>[number];

export function matchesModel(item: ModelOption, query: string) {
  const haystack = `${item.label} ${item.model} ${item.ownerName}`.toLowerCase();
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

export function getModelHref(option: ModelOption) {
  return `/models/${encodeURIComponent(option.provider)}/${encodeURIComponent(option.model)}`;
}
