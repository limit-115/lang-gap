import { describe, expect, it } from "vitest";
import type { GuideModel } from "@llang-gap/contracts/guide";
import { guideConfigurationHref } from "./table-state";

const model: GuideModel = {
  id: "openai/gpt-oss-120b",
  reference: { transport: "openrouter", model: "openai/gpt-oss-120b" },
  profile: { transport: "openrouter", model: "openai/gpt-oss-120b", effort: "low" },
  scores: [],
};

describe("model result links", () => {
  it("keeps the model in the path and only the effort in the query", () => {
    expect(guideConfigurationHref(model)).toBe("/models/openai/gpt-oss-120b?effort=low");
  });

  it("uses the same URL for native and routed references to the same model", () => {
    const native = { transport: "openai", model: "gpt-6-astra" } as const;
    const routed = { transport: "openrouter", model: "openai/gpt-6-astra" } as const;
    expect(
      guideConfigurationHref({
        ...model,
        reference: native,
        id: "openai/gpt-6-astra",
        profile: { ...native, effort: "low" },
      }),
    ).toBe(
      guideConfigurationHref({
        ...model,
        reference: routed,
        id: "openai/gpt-6-astra",
        profile: { ...routed, effort: "low" },
      }),
    );
  });

  it("preserves the selected benchmark language", () => {
    expect(guideConfigurationHref(model, "pt-BR")).toBe(
      "/models/openai/gpt-oss-120b?effort=low&language=pt-BR",
    );
  });

  it("handles historical rows without a profile or an empty query", () => {
    const historical = { ...model, profile: null };
    expect(guideConfigurationHref(historical)).toBe("/models/openai/gpt-oss-120b");
    expect(guideConfigurationHref(historical, "ja")).toBe(
      "/models/openai/gpt-oss-120b?language=ja",
    );
  });
});
