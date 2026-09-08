"use client";

import { useId, useState } from "react";
import { useTable } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Languages,
  ChevronDown,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { effortSchema } from "@llang-gap/contracts";
import { guideRowKey, type GuideModel } from "@llang-gap/contracts/guide";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { initialLanguages } from "./table-state";
import { features } from "./data-table-features";

export function LeaderboardTable({
  rows,
  languages,
  isSummary = false,
}: {
  rows: GuideModel[];
  languages: string[];
  isSummary?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("Leaderboard");
  const pageSizeId = useId();
  const [visible, setVisible] = useState(initialLanguages(languages));
  const [languageSearch, setLanguageSearch] = useState("");
  const columns = useLeaderboardColumns(visible, isSummary);
  const table = useTable({
    features,
    data: rows,
    columns,
    getRowId: guideRowKey,
    initialState: {
      sorting: [{ id: "model", desc: false }],
      pagination: { pageIndex: 0, pageSize: 10 },
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
  const { pageIndex, pageSize } = table.state.pagination;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();
  const visibleRows = table.getRowModel().rows;
  const hasFilters = table.state.columnFilters.length > 0;
  const languageColumns = languages.map((language) => ({
    language,
    label: new Intl.DisplayNames([locale], { type: "language" }).of(language) ?? language,
  }));
  const visibleLanguageCount = visible.length;
  const toggleLanguage = (language: string, checked: boolean) => {
    const next = checked
      ? languages.filter((entry) => entry === language || visible.includes(entry))
      : visible.filter((entry) => entry !== language);
    setVisible(next);
    table.setSorting([{ id: "model", desc: false }]);
  };

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
            table.setPageIndex(0);
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
        {languageColumns.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" className="ml-auto rounded-lg" />}
            >
              <Languages aria-hidden="true" /> {t("languageColumns")}
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
                <span aria-hidden="true">
                  {visibleLanguageCount}/{languageColumns.length}
                </span>
                <span className="sr-only">
                  {t("visibleLanguages", {
                    count: visibleLanguageCount,
                    total: languageColumns.length,
                  })}
                </span>
              </span>
              <ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="max-h-96 w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-border ring-0"
            >
              <Input
                aria-label={t("searchLanguages")}
                placeholder={t("searchLanguages")}
                value={languageSearch}
                onChange={(event) => setLanguageSearch(event.target.value)}
                onKeyDown={(event) => event.stopPropagation()}
                className="mb-2"
              />
              <DropdownMenuItem
                className="cursor-pointer rounded-md"
                disabled={visibleLanguageCount === languages.length}
                closeOnClick={false}
                onClick={() => {
                  setVisible([...languages]);
                  table.setSorting([{ id: "model", desc: false }]);
                }}
              >
                {t("selectAllLanguages")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {languageColumns
                .filter(({ label, language }) =>
                  `${label} ${language}`.toLowerCase().includes(languageSearch.toLowerCase()),
                )
                .map(({ label, language }) => (
                  <DropdownMenuCheckboxItem
                    key={language}
                    indicatorVariant="checkbox"
                    className="cursor-pointer rounded-md"
                    checked={visible.includes(language)}
                    onCheckedChange={(checked) => toggleLanguage(language, checked)}
                    closeOnClick={false}
                  >
                    <span>{label}</span>
                    <span aria-hidden="true" className="ml-auto text-xs text-muted-foreground">
                      {language.toUpperCase()}
                    </span>
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="overflow-hidden rounded-lg border bg-background/96">
        <Table className="[&_td]:h-16 [&_td]:px-4 [&_th]:h-16 [&_th]:px-4">
          <caption className="sr-only">
            {t("tableTitle")} — {t(isSummary ? "meanAccuracy" : "guideScore")}
          </caption>
          <TableHeader className="bg-muted/50">
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
            {visibleRows.length ? (
              visibleRows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="text-center">
                  <div className="flex flex-col items-center gap-2 py-10">
                    <Search aria-hidden="true" className="mb-1 size-5 text-muted-foreground" />
                    <p className="font-medium">
                      {t(rows.length ? "noResults" : "noPublishedResults")}
                    </p>
                    {rows.length > 0 && (
                      <p className="text-sm text-muted-foreground">{t("noResultsDescription")}</p>
                    )}
                    {rows.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 rounded-lg"
                        onClick={() => table.resetColumnFilters()}
                      >
                        {t("resetFilters")}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 text-sm">
        <output className="text-muted-foreground">
          {t("rowRange", {
            from: filteredCount ? pageIndex * pageSize + 1 : 0,
            to: Math.min((pageIndex + 1) * pageSize, filteredCount),
            total: filteredCount,
          })}
        </output>
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <label htmlFor={pageSizeId} className="text-muted-foreground">
              {t("rowsPerPage")}
            </label>
            <Select
              items={[10, 20, 50].map((value) => ({ value, label: String(value) }))}
              value={pageSize}
              onValueChange={(value) => {
                if (value !== null) table.setPageSize(value);
              }}
            >
              <SelectTrigger
                id={pageSizeId}
                size="sm"
                className="min-w-16 rounded-lg border-input bg-background"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  {[10, 20, 50].map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <span className="tabular-nums">
            {t("pageOf", { page: pageCount ? pageIndex + 1 : 0, total: pageCount })}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon-sm"
              className="hidden rounded-lg sm:inline-flex"
              aria-label={t("firstPage")}
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.firstPage()}
            >
              <ChevronsLeft aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              className="rounded-lg"
              aria-label={t("previousPage")}
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              className="rounded-lg"
              aria-label={t("nextPage")}
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              className="hidden rounded-lg sm:inline-flex"
              aria-label={t("lastPage")}
              disabled={!table.getCanNextPage()}
              onClick={() => table.lastPage()}
            >
              <ChevronsRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
