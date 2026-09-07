import type { Aggregate } from "@llang-gap/contracts";
import type { LeaderboardRow } from "./columns";

export const efforts = ["low", "medium", "high"] as const;
export const modelNames: Record<string, string> = {
  "gpt-6-astra": "GPT-6 Astra",
  "claude-fable-5-1": "Claude Fable 5.1",
};
export const providerNames: Record<Aggregate["provider"], string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  openrouter: "OpenRouter",
  fake: "fake",
};

export const plannedRows: LeaderboardRow[] = Object.keys(modelNames).flatMap((model) =>
  efforts.map((effort) => ({
    model,
    effort,
    provider: model.startsWith("gpt") ? "openai" : "anthropic",
    en: null,
    ru: null,
    gapPp: null,
    gapCi95: null,
  })),
);

export function getModelOptions(rows: Pick<Aggregate, "model" | "provider">[]) {
  const unique = new Map<
    string,
    { value: string; model: string; provider: Aggregate["provider"]; label: string }
  >();
  for (const row of rows) {
    const value = `${row.provider}/${row.model}`;
    unique.set(value, {
      value,
      model: row.model,
      provider: row.provider,
      label: modelNames[row.model] ?? row.model,
    });
  }
  return [...unique.values()].sort(
    (a, b) => a.label.localeCompare(b.label, "en") || a.value.localeCompare(b.value, "en"),
  );
}
export type ModelOption = ReturnType<typeof getModelOptions>[number];

export function matchesModel(item: ModelOption, query: string) {
  const haystack = `${item.label} ${item.model} ${providerNames[item.provider]}`.toLowerCase();
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

export function getModelHref(option: ModelOption) {
  return `/models/${encodeURIComponent(option.provider)}/${encodeURIComponent(option.model)}`;
}
