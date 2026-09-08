"use client";

import { useMemo } from "react";
import { createColumnHelper, type Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { effortSchema, type Aggregate, type Comparison } from "@llang-gap/contracts";
import type { GuideModel } from "@llang-gap/contracts/guide";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getModelPresentation } from "./model-catalog";
import { ModelOwnerLogo } from "./model-owner-logo";
import {
  accuracyColumnId,
  comparisonColumnId,
  guideConfigurationHref,
  scoreDifference,
} from "./table-state";
import type { LeaderboardFeatures } from "./data-table-features";

export type LeaderboardRow = Pick<
  Aggregate,
  "model" | "transport" | "effort" | "scores" | "comparisons"
>;
const helper = createColumnHelper<LeaderboardFeatures, GuideModel>();

function ColumnHeader<T>({
  column,
  title,
  description,
  numeric = false,
}: {
  column: Column<LeaderboardFeatures, GuideModel, T>;
  title: string;
  description?: string;
  numeric?: boolean;
}) {
  const t = useTranslations("Leaderboard");
  const sort = column.getIsSorted();
  const Icon = sort === "asc" ? ArrowUp : sort === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <div className={`flex flex-col gap-0.5 ${numeric ? "items-end" : "items-start"}`}>
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 gap-1.5 rounded-md px-2 ${numeric ? "-mr-2" : "-ml-2"}`}
        onClick={() => column.toggleSorting()}
        aria-label={t("sort", { column: title })}
      >
        {title}
        <Icon aria-hidden="true" className={sort ? "size-3.5" : "size-3.5 text-muted-foreground"} />
      </Button>
      {description && (
        <span className="text-sm font-normal text-muted-foreground">{description}</span>
      )}
    </div>
  );
}

export function useLeaderboardColumns(languages: readonly string[], comparison: Comparison | null) {
  const t = useTranslations("Leaderboard");
  const f = useFormatter();
  const locale = useLocale();
  return useMemo(
    () =>
      helper.columns([
        helper.accessor(
          (row) => {
            const { label, ownerName } = getModelPresentation(row.reference);
            return `${label} ${row.reference.model} ${ownerName}`;
          },
          {
            id: "model",
            header: ({ column }) => <ColumnHeader column={column} title={t("model")} />,
            cell: ({ row }) => {
              const { label, ownerName, ownerId } = getModelPresentation(row.original.reference);
              return (
                <Link
                  href={guideConfigurationHref(row.original)}
                  className="group flex min-w-44 items-center gap-3"
                >
                  <span
                    className="flex size-8 shrink-0 items-center justify-center"
                    aria-hidden="true"
                  >
                    <ModelOwnerLogo ownerId={ownerId} />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="font-medium group-hover:underline">{label}</span>
                    <span className="text-sm text-muted-foreground">{ownerName}</span>
                  </span>
                </Link>
              );
            },
            filterFn: "includesString",
            sortFn: "text",
            sortDescFirst: false,
            enableHiding: false,
          },
        ),
        helper.accessor((row) => row.profile?.effort ?? "unknown", {
          id: "effort",
          header: ({ column }) => <ColumnHeader column={column} title={t("effort")} />,
          cell: ({ row }) => (
            <div className="flex flex-col gap-1">
              <span className="font-medium">
                {row.original.profile ? t(row.original.profile.effort) : t("unspecifiedEffort")}
              </span>
              <span className="text-sm text-muted-foreground">
                {row.original.profile?.transport ?? row.original.reference.transport}
              </span>
            </div>
          ),
          filterFn: "equalsString",
          sortFn: (a, b) =>
            effortSchema.options.indexOf(a.original.profile?.effort ?? "low") -
            effortSchema.options.indexOf(b.original.profile?.effort ?? "low"),
          sortDescFirst: false,
          enableHiding: false,
        }),
        ...languages.map((language) =>
          helper.accessor(
            (row) => row.scores.find((score) => score.language === language)?.value ?? undefined,
            {
              id: accuracyColumnId(language),
              header: ({ column }) => (
                <ColumnHeader
                  column={column}
                  title={
                    new Intl.DisplayNames([locale], { type: "language" }).of(language) ?? language
                  }
                  description={t("guideScore")}
                  numeric
                />
              ),
              cell: ({ row, getValue }) => {
                const score = row.original.scores.find((entry) => entry.language === language);
                return (
                  <Link
                    href={`${guideConfigurationHref(row.original)}&language=${encodeURIComponent(language)}`}
                    className="block text-right font-mono tabular-nums hover:underline"
                    title={
                      getValue() === undefined
                        ? t(score?.status === "incomplete" ? "incompleteScore" : "unmeasuredScore")
                        : t("scoreDetails")
                    }
                  >
                    {getValue() === undefined
                      ? "—"
                      : f.number(getValue()!, {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                  </Link>
                );
              },
              sortFn: "basic",
              sortUndefined: "last",
              sortDescFirst: true,
            },
          ),
        ),
        ...(comparison
          ? [
              helper.accessor((row) => scoreDifference(row, comparison), {
                id: comparisonColumnId(comparison),
                header: ({ column }) => (
                  <ColumnHeader
                    column={column}
                    title={`${comparison.baseline.toUpperCase()} − ${comparison.language.toUpperCase()}`}
                    description={t("indexDifference")}
                    numeric
                  />
                ),
                cell: ({ getValue }) => (
                  <div
                    className="text-right font-mono tabular-nums"
                    title={t(getValue() === undefined ? "incomparableScores" : "differenceHelp")}
                  >
                    {getValue() === undefined
                      ? "—"
                      : f.number(getValue()!, {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                          signDisplay: "exceptZero",
                        })}
                  </div>
                ),
                sortFn: "basic",
                sortUndefined: "last",
                sortDescFirst: true,
              }),
            ]
          : []),
      ]),
    [f, t, locale, languages, comparison],
  );
}
