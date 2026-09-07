import { describe, expect, it } from "vitest";
import {
  getModelHref,
  getModelOptions,
  getModelPresentation,
  matchesModel,
  plannedRows,
} from "./model-catalog";

describe("model shortcuts", () => {
  it("offers each model once across effort levels and keeps providers distinct", () => {
    const options = getModelOptions([
      { model: "test-model", provider: "openai" },
      { model: "test-model", provider: "openai" },
      { model: "test-model", provider: "anthropic" },
    ]);
    expect(options.map((option) => option.value)).toEqual([
      "anthropic/test-model",
      "openai/test-model",
    ]);
    expect(options.map((option) => option.label)).toEqual(["test-model", "test-model"]);
    expect(getModelOptions(plannedRows)).toHaveLength(2);
    expect(getModelOptions([])).toEqual([]);
  });

  it("finds models by display name, API ID, provider, or a combination", () => {
    const option = getModelOptions([{ provider: "openai", model: "gpt-6-astra" }])[0]!;
    for (const query of ["  GPT-6   Astra ", "gpt-6-astra", "OPENAI", "astra openai", ""]) {
      expect(matchesModel(option, query)).toBe(true);
    }
    expect(matchesModel(option, "claude")).toBe(false);
    expect(matchesModel(option, "astra anthropic")).toBe(false);
  });

  it("links to a separate model page and escapes model IDs", () => {
    const option = getModelOptions([{ provider: "openai", model: "model/snapshot?version=2" }])[0]!;
    expect(getModelHref(option)).toBe("/models/openai/model%2Fsnapshot%3Fversion%3D2");
  });
});

it("keeps OpenRouter namespaced models searchable and links escaped", () => {
  const option = getModelOptions([{ provider: "openrouter", model: "openai/gpt-5-nano" }])[0]!;
  expect(matchesModel(option, "OpenAI nano")).toBe(true);
  expect(matchesModel(option, "OpenRouter")).toBe(false);
  expect(getModelHref(option)).toBe("/models/openrouter/openai%2Fgpt-5-nano");
});

it.each([
  ["openai", "gpt-6-astra", "GPT-6 Astra", "OpenAI"],
  ["anthropic", "claude-fable-5-1", "Claude Fable 5.1", "Anthropic"],
] as const)(
  "presents native and routed %s models identically without merging their runs",
  (provider, model, label, ownerName) => {
    const native = { provider, model };
    const routed = { provider: "openrouter" as const, model: `${provider}/${model}` };
    expect(getModelPresentation(native)).toEqual({ label, ownerName });
    expect(getModelPresentation(routed)).toEqual(getModelPresentation(native));
    const options = getModelOptions([native, routed]);
    expect(options).toHaveLength(2);
    expect(new Set(options.map(getModelHref)).size).toBe(2);
    expect(options.every((option) => matchesModel(option, `${ownerName} ${label}`))).toBe(true);
  },
);
it.each([
  ["google/gemini-test", "gemini-test", "Google"],
  ["new-owner/new-model", "new-model", "new-owner"],
  ["unnamespaced", "unnamespaced", "—"],
])("presents model namespace %s without inventing its owner", (model, label, ownerName) => {
  expect(getModelPresentation({ provider: "openrouter", model })).toEqual({ label, ownerName });
});
