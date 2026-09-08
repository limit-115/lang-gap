import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useTable } from "@tanstack/react-table";
import { describe, expect, it, vi } from "vitest";
import type { GuideModel } from "@llang-gap/contracts/guide";
import { useLeaderboardColumns } from "./columns";
import { features } from "./data-table-features";
import { guideLanguages, scoreDifference, visibleComparison } from "./table-state";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ number: (value: number) => String(value) }),
}));
vi.mock("@/i18n/navigation", () => ({ Link: "a" }));
const model: GuideModel = {
  id: "fixture/model",
  reference: { transport: "openrouter", model: "fixture/model" },
  profile: null,
  scores: [],
};
const score = (language: string, value: number | null, basis = "a".repeat(64)) => ({
  language,
  value,
  basis,
  comparisonBasis: basis,
  status: value === null ? ("unmeasured" as const) : ("ready" as const),
  required: 1,
  contributions: [],
});

describe("model guide table", () => {
  it("has one column per visible language and no implicit comparison, effort or interval", () => {
    function Harness() {
      const table = useTable({
        features,
        data: [model],
        columns: useLeaderboardColumns(["de", "ja"], null),
      });
      expect(table.getVisibleLeafColumns().map((column) => column.id)).toEqual([
        "model",
        "score:de",
        "score:ja",
      ]);
      return null;
    }
    renderToStaticMarkup(createElement(Harness));
  });
  it("shows only an explicitly chosen comparison", () => {
    function Harness() {
      const table = useTable({
        features,
        data: [model],
        columns: useLeaderboardColumns(["de", "fr", "ja"], { baseline: "ja", language: "de" }),
      });
      expect(table.getVisibleLeafColumns().map((column) => column.id)).toEqual([
        "model",
        "score:de",
        "score:fr",
        "score:ja",
        "difference:ja:de",
      ]);
      return null;
    }
    renderToStaticMarkup(createElement(Harness));
  });
  it.each([false, true])("sorts unmeasured scores last (descending: %s)", (desc) => {
    function Harness() {
      const table = useTable({
        features,
        data: [
          { ...model, id: "missing", scores: [] },
          { ...model, id: "zero", scores: [score("ja", 0)] },
          { ...model, id: "high", scores: [score("ja", 80)] },
        ],
        columns: useLeaderboardColumns(["ja"], null),
        initialState: { sorting: [{ id: "score:ja", desc }] },
      });
      expect(table.getSortedRowModel().rows.map((row) => row.original.id)).toEqual(
        desc ? ["high", "zero", "missing"] : ["zero", "high", "missing"],
      );
      return null;
    }
    renderToStaticMarkup(createElement(Harness));
  });
  it("removes a comparison when either participant is hidden", () => {
    const pair = { baseline: "de", language: "ja" };
    expect(visibleComparison(pair, ["de", "ja", "fr"])).toEqual(pair);
    expect(visibleComparison(pair, ["de", "fr"])).toBeNull();
    expect(visibleComparison(pair, ["ja"])).toBeNull();
    expect(visibleComparison(null, ["de", "ja"])).toBeNull();
  });
  it("requires complete scores on the same aligned basis and preserves direction", () => {
    const row = { ...model, scores: [score("de", 80), score("ja", 60)] };
    expect(scoreDifference(row, { baseline: "de", language: "ja" })).toBe(20);
    expect(scoreDifference(row, { baseline: "ja", language: "de" })).toBe(-20);
    expect(scoreDifference(row, { baseline: "de", language: "fr" })).toBeUndefined();
    row.scores[1]!.comparisonBasis = "b".repeat(64);
    expect(scoreDifference(row, { baseline: "de", language: "ja" })).toBeUndefined();
  });
  it("takes a union of benchmark languages independent of the UI locale", () => {
    expect(
      guideLanguages(
        [
          { ...model, scores: [score("ja", 80)] },
          { ...model, scores: [score("de", null)] },
        ],
        ["fr"],
      ),
    ).toEqual(["de", "fr", "ja"]);
  });
});
