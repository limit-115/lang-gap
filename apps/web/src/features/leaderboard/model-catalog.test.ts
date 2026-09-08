import { describe, expect, it } from "vitest";
import {
  getModelHref,
  getModelOptions,
  getModelGroups,
  getModelPresentation,
  matchesModel,
  plannedRows,
} from "./model-catalog";

describe("model shortcuts", () => {
  it("offers each provider model once across effort levels", () => {
    const options = getModelOptions([
      { model: "openai/test-model", transport: "openai" },
      { model: "openai/test-model", transport: "openai" },
      { model: "anthropic/test-model", transport: "anthropic" },
    ]);
    expect(options.map((option) => option.value)).toEqual([
      "anthropic/test-model",
      "openai/test-model",
    ]);
    expect(options.map((option) => option.label)).toEqual(["test-model", "test-model"]);
    expect(getModelOptions(plannedRows)).toHaveLength(2);
    expect(getModelOptions([])).toEqual([]);
  });

  it("finds models by display name, API ID, owner, or a combination", () => {
    const option = getModelOptions([{ transport: "openai", model: "gpt-6-astra" }])[0]!;
    for (const query of ["  GPT-6   Astra ", "gpt-6-astra", "OPENAI", "astra openai", ""]) {
      expect(matchesModel(option, query)).toBe(true);
    }
    expect(matchesModel(option, "claude")).toBe(false);
    expect(matchesModel(option, "astra anthropic")).toBe(false);
  });

  it("links to a separate model page and escapes model IDs", () => {
    const option = getModelOptions([
      { transport: "openai", model: "openai/model/snapshot?version=2" },
    ])[0]!;
    expect(getModelHref(option)).toBe("/models/openai/model%2Fsnapshot%3Fversion%3D2");
  });
});

it("keeps namespaced API IDs searchable with provider URLs", () => {
  const option = getModelOptions([{ transport: "openrouter", model: "openai/gpt-5-nano" }])[0]!;
  expect(matchesModel(option, "OpenAI nano")).toBe(true);
  expect(matchesModel(option, "openai/gpt-5-nano")).toBe(true);
  expect(matchesModel(option, "OpenRouter")).toBe(false);
  expect(getModelHref(option)).toBe("/models/openai/gpt-5-nano");
});

it.each([
  ["openai", "gpt-6-astra", "GPT-6 Astra", "OpenAI"],
  ["anthropic", "claude-fable-5-1", "Claude Fable 5.1", "Anthropic"],
] as const)(
  "presents native and routed %s models identically with a single shortcut",
  (transport, model, label, ownerName) => {
    const native = { transport, model };
    const routed = { transport: "openrouter" as const, model: `${transport}/${model}` };
    expect(getModelPresentation(native)).toMatchObject({ label, ownerName });
    expect(getModelPresentation(routed)).toEqual(getModelPresentation(native));
    const options = getModelOptions([native, routed]);
    expect(options).toHaveLength(1);
    expect(new Set(options.map(getModelHref)).size).toBe(1);
    expect(options.every((option) => matchesModel(option, `${ownerName} ${label}`))).toBe(true);
  },
);
it.each([
  ["google/gemini-test", "gemini-test", "Google"],
  ["new-owner/new-model", "new-model", "new-owner"],
  ["unnamespaced", "unnamespaced", "—"],
])("presents model namespace %s without inventing its owner", (model, label, ownerName) => {
  expect(getModelPresentation({ transport: "openrouter", model })).toMatchObject({
    label,
    ownerName,
  });
});

it("groups by model owner across transports and retains unregistered owners", () => {
  const options = getModelOptions([
    { transport: "openai", model: "gpt-6-astra" },
    { transport: "openrouter", model: "openai/gpt-6-astra" },
    { transport: "openrouter", model: "anthropic/claude-fable-5-1" },
    { transport: "openrouter", model: "new-owner/new-model" },
  ]);
  const groups = getModelGroups(options);
  expect(groups.map((group) => group.label)).toEqual(["OpenAI", "Anthropic", "new-owner"]);
  expect(groups.map((group) => group.items.length)).toEqual([1, 1, 1]);
  expect(groups[0]!.items.every((option) => option.ownerId === "openai")).toBe(true);
  expect(new Set(groups.flatMap((group) => group.items.map((item) => item.value))).size).toBe(3);
});

it("uses the provider namespace for Ling regardless of transport", () => {
  const rows = (["openai", "openrouter", "anthropic"] as const).map((transport) => ({
    transport,
    model: "inclusionai/ling-3.0-flash",
  }));
  for (const row of rows) {
    expect(getModelHref(getModelOptions([row])[0]!)).toBe("/models/inclusionai/ling-3.0-flash");
  }
  expect(getModelOptions(rows)).toHaveLength(1);
  expect(getModelOptions([...rows].reverse())).toEqual(getModelOptions(rows));
});

it("does not invent a provider from the transport for unknown native IDs", () => {
  expect(getModelOptions([{ transport: "openai", model: "unregistered-model" }])).toEqual([]);
});
