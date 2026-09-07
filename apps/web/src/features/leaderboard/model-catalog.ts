import {
  effortSchema,
  getModelIdentity,
  type Aggregate,
  type ModelReference,
} from "@llang-gap/contracts";
import type { LeaderboardRow } from "./columns";

export const efforts = effortSchema.options;
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
  { transport: "openai", model: "gpt-6-astra", label: "GPT-6 Astra" },
  { transport: "anthropic", model: "claude-fable-5-1", label: "Claude Fable 5.1" },
] as const satisfies readonly (ModelReference & { label: string })[];
const modelNames = new Map(
  plannedModels.map((model) => {
    const { owner, name } = getModelIdentity(model);
    return [`${owner}/${name}`, model.label];
  }),
);

export function getModelPresentation(reference: ModelReference) {
  const { owner, name } = getModelIdentity(reference);
  return {
    ownerId: owner,
    label: modelNames.get(`${owner}/${name}`) ?? name,
    ownerName: owner === null ? "—" : Object.hasOwn(ownerNames, owner) ? ownerNames[owner]! : owner,
  };
}

export const plannedRows: LeaderboardRow[] = plannedModels.flatMap(({ transport, model }) =>
  (["low", "medium", "high"] as const).map((effort) => ({
    model,
    transport,
    effort,
    scores: [],
    comparisons: [],
  })),
);

export function getModelOptions(rows: Pick<Aggregate, "model" | "transport">[]) {
  const unique = new Map<
    string,
    ModelReference & ReturnType<typeof getModelPresentation> & { value: string }
  >();
  for (const row of rows) {
    const value = `${row.transport}/${row.model}`;
    unique.set(value, {
      value,
      model: row.model,
      transport: row.transport,
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
  return `/models/${encodeURIComponent(option.transport)}/${encodeURIComponent(option.model)}`;
}

export function getModelGroups(options: readonly ModelOption[]) {
  const groups = new Map<string, { value: string; label: string; items: ModelOption[] }>();
  for (const option of options) {
    const value = option.ownerId ?? "";
    const group = groups.get(value) ?? { value, label: option.ownerName, items: [] };
    group.items.push(option);
    groups.set(value, group);
  }
  const owners = Object.keys(ownerNames);
  const rank = (owner: string) => {
    const index = owners.indexOf(owner);
    return index === -1 ? owners.length : index;
  };
  return [...groups.values()].sort(
    (a, b) => rank(a.value) - rank(b.value) || a.label.localeCompare(b.label, "en"),
  );
}
