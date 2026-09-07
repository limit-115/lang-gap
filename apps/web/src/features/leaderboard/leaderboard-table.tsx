"use client";

import { useId } from "react";
import { useTable } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { Aggregate } from "@llang-gap/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
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
import { efforts, plannedRows } from "./model-catalog";
import { features } from "./data-table-features";

export function LeaderboardTable({ rows }: { rows: Aggregate[] }) {
  const t = useTranslations("Leaderboard");
  const pageSizeId = useId();
  const columns = useLeaderboardColumns(rows.length > 0);
  const table = useTable({
    features,
    data: rows.length ? rows : plannedRows,
    columns,
    getRowId: (row) => `${row.provider}/${row.model}/${row.effort}`,
    initialState: {
      sorting: [
        { id: "model", desc: false },
        { id: "effort", desc: false },
      ],
      pagination: { pageIndex: 0, pageSize: 10 },
    },
    enableSortingRemoval: false,
  });
  const { pageIndex, pageSize } = table.state.pagination;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();
  const visibleRows = table.getRowModel().rows;
  const hasFilters = table.state.columnFilters.length > 0;
  const labels: Record<string, string> = {
    en: t("en"),
    ru: t("ru"),
    gapPp: t("gap"),
    gapCi95: t("confidence"),
  };
  const effortItems = [
    { value: "all", label: t("allEfforts") },
    ...efforts.map((value) => ({ value, label: t(value) })),
  ];

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
          onValueChange={(value) =>
            table.getColumn("effort")?.setFilterValue(value === "all" ? undefined : value)
          }
        >
          <SelectTrigger
            aria-label={t("filterEffort")}
            className="min-w-36 rounded-lg border-input bg-background"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start" alignItemWithTrigger={false}>
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
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" className="ml-auto rounded-lg" />}>
            <Settings2 aria-hidden="true" /> {t("columns")}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllLeafColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(checked) => column.toggleVisibility(checked)}
                  closeOnClick={false}
                >
                  {labels[column.id]}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="overflow-hidden rounded-lg border bg-background/96">
        <Table className="[&_td]:h-16 [&_td]:px-4 [&_th]:h-16 [&_th]:px-4">
          <caption className="sr-only">
            {t("tableTitle")} — {t("tableDescription")}
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
                    <p className="font-medium">{t("noResults")}</p>
                    <p className="text-sm text-muted-foreground">{t("noResultsDescription")}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 rounded-lg"
                      onClick={() => table.resetColumnFilters()}
                    >
                      {t("resetFilters")}
                    </Button>
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
