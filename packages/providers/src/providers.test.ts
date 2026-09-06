import { describe, expect, it } from "vitest";
import { calculateCost, reserveCost, normalizeError, ProviderError, validateModel } from "./index";
import { experiment } from "../../../tests/fixtures";

describe("provider accounting", () => {
  it("bills all input categories once and includes reasoning within output", () => {
    const cost = calculateCost(
      {
        inputTokens: 1000,
        cachedInputTokens: 100,
        cacheWriteTokens: 100,
        cacheWrite1hTokens: 100,
        outputTokens: 200,
        reasoningTokens: 150,
      },
      {
        asOf: "2026-09-06",
        source: "https://example.com",
        inputPerMillion: 10,
        cachedInputPerMillion: 1,
        cacheWritePerMillion: 12.5,
        cacheWrite1hPerMillion: 20,
        outputPerMillion: 50,
      },
    );
    expect(cost).toBeCloseTo(0.02035);
  });
  it("rejects prompts outside the pricing regime before calls", () => {
    expect(() =>
      reserveCost(
        {
          model: "fake-v1",
          effort: "low",
          maxOutputTokens: 1024,
          language: "ru",
          prompt: "я".repeat(110_000),
        },
        experiment.models[0]!.pricing,
      ),
    ).toThrow("short-context");
  });
  it("distinguishes retryable, fatal and billing-uncertain failures", () => {
    expect(normalizeError(Object.assign(new Error("rate limit"), { status: 429 }))).toMatchObject({
      retryable: true,
      uncertain: false,
    });
    expect(normalizeError(Object.assign(new Error("unauthorized"), { status: 401 }))).toMatchObject(
      { retryable: false, uncertain: false },
    );
    expect(normalizeError(new Error("timeout"))).toMatchObject({
      retryable: true,
      uncertain: true,
    });
    const known = new ProviderError("incomplete", true, true, "request-1");
    expect(normalizeError(known)).toBe(known);
  });
  it("fails fast for unregistered model capabilities", () => {
    expect(() => validateModel({ ...experiment.models[0]!, model: "imaginary-model" })).toThrow(
      "not registered",
    );
  });
});
