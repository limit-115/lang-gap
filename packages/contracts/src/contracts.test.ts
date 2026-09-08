import { describe, expect, it } from "vitest";
import { datasetManifestSchema, experimentSchema, questionSchema, usageSchema } from "./index";
import { experiment, questions } from "@tests/fixtures";

describe("public contracts", () => {
  it.each([1, 2])(
    "preserves schema-v%s manifest serialization used by saved identities",
    (schemaVersion) => {
      const original = {
        id: "fixture",
        repository: "fixtures/questions",
        revision: "a".repeat(40),
        license: "Synthetic",
        source: "https://example.org/questions",
        files: [
          { path: "kk/test.jsonl", language: "kk", split: "test", rows: 2, sha256: "b".repeat(64) },
        ],
        schemaVersion,
        normalizerVersion: 1,
        ...(schemaVersion === 2 ? { format: "normalized-jsonl", prompts: {} } : {}),
      };
      expect(JSON.stringify(datasetManifestSchema.parse(original))).toBe(JSON.stringify(original));
    },
  );
  it("rejects misspelled settings rather than silently using defaults", () => {
    expect(experimentSchema.safeParse({ ...experiment, repeat: 3 }).success).toBe(false);
    expect(
      experimentSchema.safeParse({
        ...experiment,
        models: [{ ...experiment.models[0], temperature: 0 }],
      }).success,
    ).toBe(false);
  });
  it("rejects duplicate conditions, unsupported efforts and duplicate languages", () => {
    expect(
      experimentSchema.safeParse({
        ...experiment,
        models: [...experiment.models, ...experiment.models],
      }).success,
    ).toBe(false);
    expect(experimentSchema.safeParse({ ...experiment, languages: ["ru", "ru"] }).success).toBe(
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
