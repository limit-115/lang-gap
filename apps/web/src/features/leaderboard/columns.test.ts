import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useTable } from "@tanstack/react-table";
import { describe, expect, it, vi } from "vitest";
import { useLeaderboardColumns } from "./columns";
import { features } from "./data-table-features";
import { plannedRows } from "./model-catalog";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ number: (value: number) => String(value) }),
}));

describe("leaderboard language visibility", () => {
  it.each([false, true])("keeps core columns visible (hasResults: %s)", (hasResults) => {
    function Harness() {
      const table = useTable({
        features,
        data: plannedRows,
        columns: useLeaderboardColumns(hasResults),
      });
      const visibleIds = () => table.getVisibleLeafColumns().map((column) => column.id);

      for (const id of ["model", "effort", "gapPp", "gapCi95"]) {
        table.getColumn(id)!.toggleVisibility(false);
        expect(visibleIds()).toContain(id);
      }
      table.getColumn("en")!.toggleVisibility(false);
      table.getColumn("enCost")!.toggleVisibility(false);
      expect(visibleIds()).toEqual(["model", "effort", "ru", "ruCost", "gapPp", "gapCi95"]);
      table.getColumn("ru")!.toggleVisibility(false);
      table.getColumn("ruCost")!.toggleVisibility(false);
      expect(visibleIds()).toEqual(["model", "effort", "gapPp", "gapCi95"]);
      table.getColumn("en")!.toggleVisibility(true);
      table.getColumn("ru")!.toggleVisibility(true);
      table.getColumn("enCost")!.toggleVisibility(true);
      table.getColumn("ruCost")!.toggleVisibility(true);
      expect(visibleIds()).toEqual([
        "model",
        "effort",
        "en",
        "enCost",
        "ru",
        "ruCost",
        "gapPp",
        "gapCi95",
      ]);
      return null;
    }
    renderToStaticMarkup(createElement(Harness));
  });
  it.each([false, true])(
    "sorts numeric costs with unknown values last (descending: %s)",
    (desc) => {
      function Harness() {
        const table = useTable({
          features,
          data: [
            { ...plannedRows[0]!, model: "unknown", averageCostUsd: { en: null, ru: 1 } },
            { ...plannedRows[0]!, model: "paid", averageCostUsd: { en: 0.01, ru: 2 } },
            { ...plannedRows[0]!, model: "free", averageCostUsd: { en: 0, ru: 0 } },
            { ...plannedRows[0]!, model: "legacy" },
          ],
          columns: useLeaderboardColumns(true),
          initialState: { sorting: [{ id: "enCost", desc }] },
        });
        expect(table.getRowModel().rows.map((row) => row.original.model)).toEqual([
          ...(desc ? ["paid", "free"] : ["free", "paid"]),
          "unknown",
          "legacy",
        ]);
        return createElement(
          "table",
          null,
          createElement(
            "tbody",
            null,
            table.getRowModel().rows.map((row) =>
              createElement(
                "tr",
                { key: row.id },
                row
                  .getVisibleCells()
                  .filter((cell) => cell.column.id === "enCost")
                  .map((cell) =>
                    createElement(
                      "td",
                      { key: cell.id },
                      createElement(table.FlexRender, { cell }),
                    ),
                  ),
              ),
            ),
          ),
        );
      }
      const html = renderToStaticMarkup(createElement(Harness));
      expect(html).toContain("$0.0100");
      expect(html).toContain("$0.0000");
      expect(html).toContain('aria-label="unknownCost"');
    },
  );
});
