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
        columns: useLeaderboardColumns(
          hasResults,
          ["de", "fr", "ja"],
          [{ baseline: "de", language: "ja" }],
        ),
      });
      const visibleIds = () => table.getVisibleLeafColumns().map((column) => column.id);

      const core = [
        "model",
        "effort",
        "gap:de:ja",
        "interval:de:ja",
        ...(!hasResults ? ["status"] : []),
      ];
      for (const id of core) {
        table.getColumn(id)!.toggleVisibility(false);
        expect(visibleIds()).toContain(id);
      }
      for (const language of ["de", "fr", "ja"])
        table.getColumn(`accuracy:${language}`)!.toggleVisibility(false);
      expect(visibleIds()).toEqual(core);
      table.getColumn("accuracy:fr")!.toggleVisibility(true);
      expect(visibleIds()).toContain("accuracy:fr");
      expect(visibleIds()).not.toContain("accuracy:de");
      expect(visibleIds()).not.toContain("accuracy:ja");
      return null;
    }
    renderToStaticMarkup(createElement(Harness));
  });
});
