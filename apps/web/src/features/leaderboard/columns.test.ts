import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useTable } from "@tanstack/react-table";
import { describe, expect, it, vi } from "vitest";
import { useLeaderboardColumns } from "./columns";
import { features } from "./data-table-features";
import { plannedRows } from "./model-catalog";

vi.mock("next-intl", () => ({
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
      expect(visibleIds()).toEqual(["model", "effort", "ru", "gapPp", "gapCi95"]);
      table.getColumn("ru")!.toggleVisibility(false);
      expect(visibleIds()).toEqual(["model", "effort", "gapPp", "gapCi95"]);
      table.getColumn("en")!.toggleVisibility(true);
      table.getColumn("ru")!.toggleVisibility(true);
      expect(visibleIds()).toEqual(["model", "effort", "en", "ru", "gapPp", "gapCi95"]);
      return null;
    }
    renderToStaticMarkup(createElement(Harness));
  });
});
