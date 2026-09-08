"use client";

import { useState } from "react";
import { useTable } from "@tanstack/react-table";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { effortSchema } from "@llang-gap/contracts";
import { guideRowKey, type GuideModel } from "@llang-gap/contracts/guide";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLeaderboardColumns } from "./columns";
import { initialLanguages, withEnglishFirst } from "./table-state";
import { features } from "./data-table-features";
import { LanguageSelector } from "./language-selector";

export function LeaderboardTable({
  rows,
  languages,
  isSummary = false,
}: {
  rows: GuideModel[];
  languages: string[];
  isSummary?: boolean;
}) {
  const t = useTranslations("Leaderboard");
  const [visible, setVisible] = useState(() => withEnglishFirst(initialLanguages(languages)));
  const columns = useLeaderboardColumns(visible);
  const table = useTable({
    features,
    data: rows,
    columns,
    getRowId: guideRowKey,
    initialState: {
      sorting: [{ id: "model", desc: false }],
    },
    enableSortingRemoval: false,
  });
  const effortItems = [
    { value: "all", label: t("allEfforts") },
    ...effortSchema.options
      .filter((effort) => rows.some((row) => row.profile?.effort === effort))
      .map((effort) => ({ value: effort, label: t(effort) })),
    ...(rows.some((row) => !row.profile)
      ? [{ value: "unknown", label: t("unspecifiedEffort") }]
      : []),
  ];
  const visibleRows = table.getRowModel().rows;
  const hasFilters = table.state.columnFilters.length > 0;

  return (
    <div className="min-w-0 pb-4 sm:pb-5">
      <div className="flex flex-wrap items-center gap-2 pb-4">
        <div className="relative w-full sm:max-w-72">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label={t("searchModels")}
            placeholder={t("searchModels")}
            value={(table.getColumn("model")?.getFilterValue() as string) ?? ""}
            onChange={(event) => table.getColumn("model")?.setFilterValue(event.target.value)}
            className="rounded-lg border-input bg-background pl-9"
          />
        </div>
        <Select
          items={effortItems}
          value={(table.getColumn("effort")?.getFilterValue() as string) ?? "all"}
          onValueChange={(value) => {
            table.getColumn("effort")?.setFilterValue(value === "all" ? undefined : value);
          }}
        >
          <SelectTrigger
            aria-label={t("filterEffort")}
            className="min-w-44 rounded-lg border-input bg-background"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {effortItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-lg"
            onClick={() => table.resetColumnFilters()}
          >
            {t("resetFilters")} <X aria-hidden="true" />
          </Button>
        )}
        <LanguageSelector
          languages={languages}
          visible={visible}
          onChange={(next) => {
            setVisible(next);
            table.setSorting([{ id: "model", desc: false }]);
          }}
        />
      </div>
      <div className="overflow-hidden rounded-lg border bg-background/96">
        <Table className="[&_td]:h-11 [&_td]:px-3 [&_td]:py-1.5 [&_th]:h-11 [&_th]:px-3 [&_tr>*:not(:last-child)]:border-r [&_tr>*:nth-child(even)]:bg-black/[0.02] dark:[&_tr>*:nth-child(even)]:bg-white/[0.025]">
          <caption className="sr-only">
            {t("tableTitle")} — {t(isSummary ? "meanAccuracy" : "guideScore")}
          </caption>
          <TableHeader className="bg-muted/20">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  const sort = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      scope="col"
                      aria-sort={
                        header.column.getCanSort()
                          ? sort === "asc"
                            ? "ascending"
                            : sort === "desc"
                              ? "descending"
                              : "none"
                          : undefined
                      }
                    >
                      {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {visibleRows.map((row) => (
              <TableRow key={row.id} className="hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {visibleRows.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm">
            <Search aria-hidden="true" className="mb-1 size-5 text-muted-foreground" />
            <p className="font-medium">{t(rows.length ? "noResults" : "noPublishedResults")}</p>
            {rows.length > 0 && (
              <>
                <p className="text-muted-foreground">{t("noResultsDescription")}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 rounded-lg"
                  onClick={() => table.resetColumnFilters()}
                >
                  {t("resetFilters")}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
