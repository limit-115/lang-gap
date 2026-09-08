import { describe, expect, it } from "vitest";
import type { GuideModel, GuideScore } from "@llang-gap/contracts/guide";
import {
  filterModelLanguages,
  getModelOverviewProfiles,
  selectModelOverview,
  summarizeModelScores,
} from "./overview-data";

describe("model language search", () => {
  const rows = [
    { language: "ja", label: "Japanese", native: "日本語" },
    { language: "en", label: "English", native: "English" },
    { language: "sw", label: "Swahili", native: "Kiswahili" },
  ];
  it("keeps English beside a matching language without changing score order", () => {
    expect(filterModelLanguages(rows, "  日本語  ", "en")).toEqual([rows[0], rows[1]]);
    expect(filterModelLanguages(rows, "SWAHILI", "en")).toEqual([rows[1], rows[2]]);
  });
  it("does not show English for a search with no matching languages", () => {
    expect(filterModelLanguages(rows, "not-a-language", "en")).toEqual([]);
  });
  it("does not duplicate English or add unpublished language rows", () => {
    expect(filterModelLanguages(rows, "English", "en")).toEqual([rows[1]]);
    expect(filterModelLanguages([rows[0]!, rows[2]!], "sw", "en")).toEqual([rows[2]]);
    expect(filterModelLanguages(rows, "", "en")).toEqual(rows);
  });
  it("uses benchmark language tags independently of the interface locale", () => {
    const localized = [
      { language: "en-GB", label: "английский", native: "British English" },
      { language: "ar", label: "арабский", native: "العربية" },
    ];
    expect(filterModelLanguages(localized, "АРАБ", "ru")).toEqual(localized);
  });
});

const score = (
  language: string,
  value: number | null,
  comparisonBasis = "a".repeat(64),
): GuideScore => ({
  language,
  value,
  status: value === null ? "unmeasured" : "ready",
  basis: "b".repeat(64),
  comparisonBasis,
  contributions:
    value === null
      ? []
      : [
          {
            taskId: "dataset-a",
            releaseId: "release-a",
            transport: "fake",
            model: "fixture",
            effort: "low",
            accuracy: value / 100,
            value,
            n: 5,
            repeats: 1,
          },
          {
            taskId: "dataset-b",
            releaseId: "release-b",
            transport: "fake",
            model: "fixture",
            effort: "low",
            accuracy: value / 100,
            value,
            n: 500,
            repeats: 1,
          },
        ],
  required: 2,
});
const model = (effort: "low" | "high", scores: GuideScore[], id = "fake/fixture"): GuideModel => ({
  id,
  reference: { transport: "fake", model: id.slice(5) },
  profile: { transport: "fake", model: id.slice(5), effort },
  scores,
});

describe("model page published result selection", () => {
  const low = model("low", [score("ja", 60), score("ar", 50)]);
  const high = model("high", [score("ja", 90), score("ar", 80)]);
  const other = model("high", [score("sw", 100)], "fake/other");
  it("keeps the published row order instead of choosing the best-scoring setting", () => {
    expect(selectModelOverview([low, high, other], low.id, {})).toBe(low);
  });
  it("selects the model from its path and the effort from the query", () => {
    expect(selectModelOverview([low, high, other], low.id, { effort: "high" })).toBe(high);
    expect(selectModelOverview([low, high, other], other.id, { effort: "high" })).toBe(other);
  });
  it("ignores runner details in old links, including conflicting values", () => {
    const legacyQuery = { effort: "high", model: "other", transport: "openai" };
    expect(selectModelOverview([low, high, other], low.id, legacyQuery)).toBe(high);
  });
  it("offers each effort once across transports, keeping the first published row and its scores", () => {
    const routed = {
      ...low,
      profile: { ...low.profile!, transport: "openrouter" as const },
      scores: [score("sw", 100)],
    };
    const rows = [low, routed, high, other];
    expect(getModelOverviewProfiles(rows, low.id)).toEqual([low, high]);
    expect(selectModelOverview(rows, low.id, { effort: "low" })).toBe(low);
    expect(getModelOverviewProfiles([routed, low, high], low.id)).toEqual([routed, high]);
    expect(rows).toEqual([low, routed, high, other]);
  });
  it("never silently substitutes a different result for an unavailable selection", () => {
    expect(selectModelOverview([low, high], low.id, { effort: "medium" })).toBeNull();
    expect(selectModelOverview([low, high], other.id, { effort: "low" })).toBeNull();
  });
});

describe("model page score summaries", () => {
  it("uses saved multilingual scores across datasets and preserves a measured zero", () => {
    const entry = model("low", [score("ar", 0), score("sw", null), score("ja", 85)]);
    const summary = summarizeModelScores(entry);
    expect(summary.highest).toBe(85);
    expect(summary.lowest).toBe(0);
    expect(summary.spread).toBe(85);
    expect(summary.measured.map((value) => value.language)).toEqual(["ja", "ar"]);
    expect(entry.scores.map((value) => value.language)).toEqual(["ar", "sw", "ja"]);
  });
  it("includes every language tied at an extreme", () => {
    const summary = summarizeModelScores(
      model("high", [score("ja", 90), score("ar", 90), score("sw", 60)]),
    );
    expect(summary.highestLanguages).toEqual(["ar", "ja"]);
    expect(summary.lowestLanguages).toEqual(["sw"]);
  });
  it("does not infer a gap from mismatched evidence or a single language", () => {
    expect(
      summarizeModelScores(model("low", [score("ja", 90), score("ar", 70, "c".repeat(64))])).spread,
    ).toBeNull();
    expect(summarizeModelScores(model("low", [score("sw", 90)])).spread).toBeNull();
  });
  it("keeps missing evidence empty rather than reporting zero performance", () => {
    expect(summarizeModelScores(model("low", [score("sw", null)]))).toMatchObject({
      highest: null,
      lowest: null,
      spread: null,
      measured: [],
    });
    expect(summarizeModelScores(null).scores).toEqual([]);
  });
});
