"use client";

import { useMemo } from "react";
import { createColumnHelper, type Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { Aggregate, Comparison } from "@llang-gap/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { efforts, getModelPresentation } from "./model-catalog";
import { ProviderLogo } from "./provider-logo";
import type { LeaderboardFeatures } from "./data-table-features";

export type LeaderboardRow = Pick<
  Aggregate,
  "model" | "transport" | "effort" | "scores" | "comparisons"
>;

export const accuracyColumnId = (language: string) => `accuracy:${language}`;
export const comparisonColumnId = (pair: Comparison) => `gap:${pair.baseline}:${pair.language}`;

const columnHelper = createColumnHelper<LeaderboardFeatures, LeaderboardRow>();

function ColumnHeader<TValue>({
  column,
  title,
  description,
  numeric = false,
}: {
  column: Column<LeaderboardFeatures, LeaderboardRow, TValue>;
  title: string;
  description?: string;
  numeric?: boolean;
}) {
  const t = useTranslations("Leaderboard");
  const sort = column.getIsSorted();
  const Icon = sort === "asc" ? ArrowUp : sort === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <div className={`flex flex-col gap-0.5 ${numeric ? "items-end" : "items-start"}`}>
      {column.getCanSort() ? (
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 gap-1.5 rounded-md px-2 ${numeric ? "-mr-2" : "-ml-2"}`}
          onClick={() => column.toggleSorting()}
          aria-label={t("sort", { column: title })}
        >
          {title}
          <Icon
            aria-hidden="true"
            className={sort ? "size-3.5" : "size-3.5 text-muted-foreground"}
          />
        </Button>
      ) : (
        <span className="flex h-7 items-center">{title}</span>
      )}
      {description && (
        <span className="text-xs font-normal text-muted-foreground">{description}</span>
      )}
    </div>
  );
}

export function useLeaderboardColumns(
  hasResults: boolean,
  languages: readonly string[],
  comparisons: readonly Comparison[],
) {
  const t = useTranslations("Leaderboard");
  const f = useFormatter();
  const locale = useLocale();
  return useMemo(() => {
    const percent = (value: number) =>
      f.number(value, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const pp = (value: number) =>
      f.number(value, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
        signDisplay: "exceptZero",
      });
    return columnHelper.columns([
      columnHelper.accessor(
        (row) => {
          const { label, ownerName } = getModelPresentation(row);
          return `${label} ${row.model} ${ownerName}`;
        },
        {
          id: "model",
          header: ({ column }) => <ColumnHeader column={column} title={t("model")} />,
          cell: ({ row }) => {
            const { label, ownerName, ownerId } = getModelPresentation(row.original);
            return (
              <div className="flex items-center gap-3">
                <span
                  className="flex size-8 shrink-0 items-center justify-center"
                  aria-hidden="true"
                >
                  <ProviderLogo ownerId={ownerId} />
                </span>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{label}</span>
                  <span className="text-xs text-muted-foreground">{ownerName}</span>
                </div>
              </div>
            );
          },
          filterFn: "includesString",
          sortFn: "text",
          sortDescFirst: false,
          enableHiding: false,
        },
      ),
      columnHelper.accessor("effort", {
        header: ({ column }) => <ColumnHeader column={column} title={t("effort")} />,
        cell: ({ getValue }) => (
          <Badge variant="secondary" className="rounded-md font-normal">
            {t(getValue())}
          </Badge>
        ),
        filterFn: "equalsString",
        sortFn: (a, b) => efforts.indexOf(a.original.effort) - efforts.indexOf(b.original.effort),
        sortDescFirst: false,
        enableHiding: false,
      }),
      ...languages.map((language) =>
        columnHelper.accessor(
          (row) => row.scores.find((score) => score.language === language)?.accuracy ?? null,
          {
            id: accuracyColumnId(language),
            header: ({ column }) => (
              <ColumnHeader
                column={column}
                title={
                  new Intl.DisplayNames([locale], { type: "language" }).of(language) ?? language
                }
                description={t("accuracy")}
                numeric
              />
            ),
            cell: ({ getValue }) => (
              <div className="text-right font-mono tabular-nums">
                {getValue() === null ? "—" : percent(getValue()!)}
              </div>
            ),
            sortFn: "basic",
            sortDescFirst: true,
            enableSorting: hasResults,
            enableHiding: true,
          },
        ),
      ),
      ...comparisons.flatMap((pair) => [
        columnHelper.accessor(
          (row) =>
            row.comparisons.find(
              (value) => value.baseline === pair.baseline && value.language === pair.language,
            )?.gapPp ?? null,
          {
            id: comparisonColumnId(pair),
            header: ({ column }) => (
              <ColumnHeader
                column={column}
                title={`${pair.baseline.toUpperCase()} − ${pair.language.toUpperCase()}`}
                description={t("gapUnit")}
                numeric
              />
            ),
            cell: ({ getValue }) => (
              <div className="text-right font-mono font-medium tabular-nums">
                {getValue() === null ? "—" : pp(getValue()!)}
              </div>
            ),
            sortFn: "basic",
            sortDescFirst: true,
            enableSorting: hasResults,
            enableHiding: false,
          },
        ),
        columnHelper.accessor(
          (row) =>
            row.comparisons.find(
              (value) => value.baseline === pair.baseline && value.language === pair.language,
            )?.gapCi95 ?? null,
          {
            id: `interval:${pair.baseline}:${pair.language}`,
            header: () => (
              <div className="text-right">{`${pair.baseline.toUpperCase()} − ${pair.language.toUpperCase()} · ${t("confidence")}`}</div>
            ),
            cell: ({ getValue }) => {
              const interval = getValue();
              return (
                <div
                  className="text-right font-mono text-xs tabular-nums text-muted-foreground"
                  title={
                    interval && interval[0] <= 0 && interval[1] >= 0 ? t("neutral") : undefined
                  }
                >
                  {interval ? `[${pp(interval[0])}, ${pp(interval[1])}]` : "—"}
                </div>
              );
            },
            enableSorting: false,
            enableHiding: false,
          },
        ),
      ]),
      ...(!hasResults
        ? [
            columnHelper.display({
              id: "status",
              header: () => t("status"),
              cell: () => (
                <Badge variant="outline" className="font-normal text-muted-foreground">
                  {t("planned")}
                </Badge>
              ),
              enableSorting: false,
              enableHiding: false,
            }),
          ]
        : []),
    ]);
  }, [f, t, locale, hasResults, languages, comparisons]);
}
