import { describe, expect, it } from "vitest";
import type { GuideModel, GuideScore, GuideSnapshot } from "@llang-gap/contracts/guide";
import { languageData, languageDatasets, rankedModels, scoreValue } from "./data";

const profile = { transport: "fake", model: "example", effort: "high" } as const;
const score = (
  language: string,
  value: number | null,
  overrides: Partial<GuideScore> = {},
): GuideScore => ({
  language,
  value,
  status: value === null ? "unmeasured" : "ready",
  basis: "a".repeat(64),
  comparisonBasis: "b".repeat(64),
  required: 1,
  contributions:
    value === null
      ? []
      : [
          {
            ...profile,
            taskId: "fixture-a",
            releaseId: "fixture",
            accuracy: value / 100,
            value,
            n: 5,
            repeats: 1,
          },
        ],
  ...overrides,
});
const model = (scores: GuideScore[], effort: "high" | "low" = "high"): GuideModel => ({
  id: "fake/example",
  reference: { transport: "fake", model: "example" },
  profile: { ...profile, effort },
  scores,
});
const snapshot = (models: GuideModel[]): GuideSnapshot => ({
  schemaVersion: 1,
  id: "fixture-summary",
  createdAt: "2026-09-08T00:00:00.000Z",
  plan: { schemaVersion: 2, aggregation: "mean-dataset-accuracy-v1", releases: ["fixture"] },
  languages: ["sw", "fi"],
  models,
  sources: [{ releaseId: "fixture", manifestHash: "c".repeat(64), evidenceHash: null }],
});

describe("published language results", () => {
  it("keeps published dataset averages and separate reasoning levels, without pooling question counts", () => {
    const published = score("sw", 85, {
      required: 2,
      contributions: [
        {
          ...profile,
          taskId: "fixture-a",
          releaseId: "fixture",
          accuracy: 0.8,
          value: 80,
          n: 5,
          repeats: 1,
        },
        {
          ...profile,
          taskId: "fixture-b",
          releaseId: "fixture",
          accuracy: 0.9,
          value: 90,
          n: 500,
          repeats: 3,
        },
      ],
    });
    const data = languageData(snapshot([model([published]), model([score("sw", 72)], "low")]));
    expect(new Set(data.models.map((entry) => entry.key)).size).toBe(2);
    expect(rankedModels(data.models, "sw").map((row) => row.score)).toEqual([85, 72]);
    expect(scoreValue(data.models[0]!, "sw", "fixture-a")).toBe(80);
    expect(scoreValue(data.models[0]!, "sw", "fixture-b")).toBe(90);
    expect(languageDatasets(data.models, "sw")).toEqual(["fixture-a", "fixture-b"]);
  });

  it("preserves measured zero, missing scores and incomplete coverage", () => {
    const candidate = model([
      score("sw", 0),
      score("fi", null, {
        status: "incomplete",
        required: 2,
        contributions: [
          {
            ...profile,
            taskId: "fixture-a",
            releaseId: "fixture",
            accuracy: 0.8,
            value: 80,
            n: 5,
            repeats: 1,
          },
        ],
      }),
    ]);
    expect(scoreValue(candidate, "sw")).toBe(0);
    expect(scoreValue(candidate, "fi")).toBeNull();
    expect(scoreValue(candidate, "fi", "fixture-a")).toBe(80);
    expect(scoreValue(candidate, "fi", "fixture-b")).toBeNull();
    expect(scoreValue(candidate, "cy")).toBeNull();
  });

  it("changes ranking with the selected dataset and assigns shared ranks to tied scores", () => {
    const high = score("sw", 80, {
      contributions: [
        {
          ...profile,
          taskId: "fixture-a",
          releaseId: "fixture",
          accuracy: 0.7,
          value: 70,
          n: 5,
          repeats: 1,
        },
      ],
    });
    const data = languageData(snapshot([model([high]), model([score("sw", 80 + 1e-12)], "low")]));
    expect(rankedModels(data.models, "sw").map((row) => row.rank)).toEqual([1, 1]);
    expect(rankedModels(data.models, "sw", "fixture-a")[0]?.model.profile?.effort).toBe("low");
  });

  it("supports a single non-default language and empty publication", () => {
    const single = { ...snapshot([model([score("sw", 0)])]), languages: ["sw"] };
    const data = languageData(single);
    expect(data.languages).toEqual(["sw"]);
    expect(rankedModels(data.models, "sw")[0]?.score).toBe(0);
    expect(languageData(null)).toEqual({ models: [], languages: [], createdAt: null });
  });

  it("does not present historical normalized guide scores as accuracy", () => {
    const legacy: GuideSnapshot = {
      ...snapshot([model([score("sw", 88)])]),
      plan: {
        schemaVersion: 1,
        profiles: [],
        releases: ["fixture"],
        suite: { id: "legacy", families: [], tasks: [] },
      },
    };
    expect(languageData(legacy).models).toEqual([]);
  });
});
