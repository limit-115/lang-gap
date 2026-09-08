import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useTable } from "@tanstack/react-table";
import { describe, expect, it, vi } from "vitest";
import type { GuideModel } from "@llang-gap/contracts/guide";
import { useLeaderboardColumns } from "./columns";
import { LeaderboardTable } from "./leaderboard-table";
import { features } from "./data-table-features";
import { guideLanguages, englishScoreDifference, initialLanguages } from "./table-state";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: { value?: string }) =>
    key === "differencePp" ? `${values?.value} pp` : key,
  useFormatter: () => ({
    number: (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat("en", options).format(value),
  }),
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
  it("shows only available preferred languages initially and one row per model", () => {
    const languages = [
      "ar",
      "az",
      "bg",
      "bs",
      "ca",
      "cs",
      "da",
      "de",
      "el",
      "es",
      "et",
      "eu",
      "fi",
      "fr",
      "he",
      "hi",
      "hr",
      "hu",
      "id",
      "it",
      "ja",
      "ka",
      "kk",
      "ko",
      "lt",
    ];
    const rows = [
      {
        ...model,
        id: "fixture/five",
        scores: languages.slice(0, 5).map((language) => score(language, 80)),
      },
      {
        ...model,
        id: "fixture/twenty-five",
        scores: languages.map((language) => score(language, 90)),
      },
    ];
    const html = renderToStaticMarkup(createElement(LeaderboardTable, { rows, languages }));
    expect(html.match(/<th[ >]/g)).toHaveLength(4);
    expect(html.match(/<td[ >]/g)).toHaveLength(8);
  });
  it("has one column per visible language and an explicit effort column and no implicit comparison or interval", () => {
    function Harness() {
      const table = useTable({
        features,
        data: [model],
        columns: useLeaderboardColumns(["de", "ja"]),
      });
      expect(table.getVisibleLeafColumns().map((column) => column.id)).toEqual([
        "model",
        "effort",
        "score:de",
        "score:ja",
      ]);
      return null;
    }
    renderToStaticMarkup(createElement(Harness));
  });
  it("renders inline differences and an English baseline without comparison controls or columns", () => {
    const html = renderToStaticMarkup(
      createElement(LeaderboardTable, {
        rows: [{ ...model, scores: [score("en", 80), score("ru", 75.8), score("kk", 85)] }],
        languages: ["en", "ru", "kk"],
      }),
    );
    expect(html).toContain("baseline");
    expect(html).toContain("-4.2 pp");
    expect(html).toContain("+5.0 pp");
    expect(html).not.toContain("compareLanguages");
    expect(html).not.toContain("closeComparison");
    expect(html.match(/<th[ >]/g)).toHaveLength(5);
  });
  it("keeps the English reference when its column is hidden", () => {
    function Harness() {
      const table = useTable({
        features,
        data: [{ ...model, scores: [score("en", 80), score("ja", 75)] }],
        columns: useLeaderboardColumns(["ja"]),
      });
      return createElement(
        "div",
        null,
        table
          .getRowModel()
          .rows[0]!.getVisibleCells()
          .map((cell) => createElement(table.FlexRender, { key: cell.id, cell })),
      );
    }
    expect(renderToStaticMarkup(createElement(Harness))).toContain("-5.0 pp");
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
        columns: useLeaderboardColumns(["ja"]),
        initialState: { sorting: [{ id: "score:ja", desc }] },
      });
      expect(table.getSortedRowModel().rows.map((row) => row.original.id)).toEqual(
        desc ? ["high", "zero", "missing"] : ["zero", "high", "missing"],
      );
      return null;
    }
    renderToStaticMarkup(createElement(Harness));
  });
  it("selects preferred display languages without inventing unavailable languages", () => {
    expect(initialLanguages(["cs", "de", "en", "es", "kk", "ru", "zh"])).toEqual([
      "en",
      "ru",
      "kk",
      "es",
      "zh",
    ]);
    expect(initialLanguages(["ar", "de", "en", "ja"])).toEqual(["en"]);
    expect(initialLanguages(["es", "kk"])).toEqual(["kk", "es"]);
    expect(initialLanguages(["ar", "de", "fr", "ja"])).toEqual(["ar", "de", "fr"]);
    expect(initialLanguages(["ja"])).toEqual(["ja"]);
    expect(initialLanguages([])).toEqual([]);
  });
  it("requires complete aligned scores within the row and preserves candidate-minus-English direction", () => {
    const row = { ...model, scores: [score("en", 80), score("de", 60), score("ja", 90)] };
    expect(englishScoreDifference(row, "de")).toBe(-20);
    expect(englishScoreDifference(row, "ja")).toBe(10);
    expect(englishScoreDifference(row, "en")).toBeUndefined();
    expect(englishScoreDifference(row, "fr")).toBeUndefined();
    row.scores[1]!.comparisonBasis = "b".repeat(64);
    expect(englishScoreDifference(row, "de")).toBeUndefined();
    expect(englishScoreDifference({ ...model, scores: [score("ja", 90)] }, "ja")).toBeUndefined();
    expect(
      englishScoreDifference({ ...model, scores: [score("en", null), score("ja", 90)] }, "ja"),
    ).toBeUndefined();
    expect(
      englishScoreDifference({ ...model, scores: [score("en", 80), score("ja", null)] }, "ja"),
    ).toBeUndefined();
    expect(
      englishScoreDifference({ ...model, scores: [score("en", 0), score("ja", 0)] }, "ja"),
    ).toBe(0);
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

it("filters separate configurations of the same model by exact effort", () => {
  function Harness() {
    const rows = (["low", "max"] as const).map((effort) => ({
      ...model,
      profile: { ...model.reference, effort },
      scores: [score("ja", effort === "max" ? 90 : 40)],
    }));
    const table = useTable({
      features,
      data: rows,
      columns: useLeaderboardColumns(["ja"]),
      initialState: { columnFilters: [{ id: "effort", value: "max" }] },
    });
    expect(table.getFilteredRowModel().rows.map((row) => row.original.scores[0]!.value)).toEqual([
      90,
    ]);
    return null;
  }
  renderToStaticMarkup(createElement(Harness));
});
