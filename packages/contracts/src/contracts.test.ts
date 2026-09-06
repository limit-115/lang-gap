import { describe, expect, it } from "vitest";
import { experimentSchema, questionSchema, usageSchema } from "./index";
import { experiment, questions } from "@tests/fixtures";

describe("public contracts", () => {
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
  it("accepts only the exact supported v1 and v2 protocol IDs", () => {
    for (const protocol of [
      "mmluprox-lite-5shot-native-reasoning-v1",
      "mmluprox-lite-5shot-native-reasoning-v2",
    ]) {
      expect(experimentSchema.parse({ ...experiment, protocol }).protocol).toBe(protocol);
    }
    for (const protocol of [
      "",
      "mmluprox-lite-5shot-native-reasoning-v3",
      "mmluprox-lite-5shot-native-reasoning-v2 ",
    ]) {
      expect(experimentSchema.safeParse({ ...experiment, protocol }).success).toBe(false);
    }
  });
  it("requires a positive integer per-category limit and forbids combining subset selectors", () => {
    const perCategory = { ...experiment, questionsPerCategory: 2 };
    expect(() => experimentSchema.parse(perCategory)).toThrow(
      "Choose either questionLimit or questionsPerCategory, not both",
    );
    delete perCategory.questionLimit;
    expect(experimentSchema.parse(perCategory).questionsPerCategory).toBe(2);
    for (const questionsPerCategory of [0, -1, 1.5, 589, "2"]) {
      expect(experimentSchema.safeParse({ ...perCategory, questionsPerCategory }).success).toBe(
        false,
      );
    }
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
