import { describe, expect, it } from "vitest";
import { aggregateSchema, experimentSchema, questionSchema, usageSchema } from "./index";
import { experiment, questions } from "@tests/fixtures";

describe("public contracts", () => {
  it("validates both language costs without defaulting absent historical values", () => {
    const costs = aggregateSchema.shape.averageCostUsd;
    expect(costs.parse(undefined)).toBeUndefined();
    expect(costs.parse({ en: 0, ru: null })).toEqual({ en: 0, ru: null });
    for (const value of [{ en: -1, ru: 0 }, { en: 0 }, { en: Infinity, ru: 0 }]) {
      expect(costs.safeParse(value).success).toBe(false);
    }
  });
  it("rejects misspelled settings rather than silently using defaults", () => {
    expect(experimentSchema.safeParse({ ...experiment, repeat: 3 }).success).toBe(false);
    expect(
      experimentSchema.safeParse({
        ...experiment,
        models: [{ ...experiment.models[0], temperature: 0 }],
      }).success,
    ).toBe(false);
  });
  it("rejects duplicate conditions, unsupported efforts and reversed language tuples", () => {
    expect(
      experimentSchema.safeParse({
        ...experiment,
        models: [...experiment.models, ...experiment.models],
      }).success,
    ).toBe(false);
    expect(experimentSchema.safeParse({ ...experiment, languages: ["ru", "en"] }).success).toBe(
      false,
    );
    expect(
      experimentSchema.safeParse({
        ...experiment,
        models: [{ ...experiment.models[0], efforts: ["low", "low"] }],
      }).success,
    ).toBe(false);
  });
  it("rejects a gold label outside the available answers", () => {
    expect(questionSchema.safeParse({ ...questions[0], answer: "J" }).success).toBe(false);
  });
  it("rejects invalid cache accounting", () => {
    expect(
      usageSchema.safeParse({
        inputTokens: 10,
        cachedInputTokens: 5,
        cacheWriteTokens: 6,
        cacheWrite1hTokens: 0,
        outputTokens: 10,
        reasoningTokens: 0,
      }).success,
    ).toBe(false);
  });
});
