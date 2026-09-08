"use client";

import { useMemo } from "react";
import { createColumnHelper, type Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { effortSchema, type Aggregate } from "@llang-gap/contracts";
import type { GuideModel } from "@llang-gap/contracts/guide";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getModelPresentation } from "./model-catalog";
import { ModelOwnerLogo } from "./model-owner-logo";
import { accuracyColumnId, guideConfigurationHref, englishScoreDifference } from "./table-state";
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

export function useLeaderboardColumns(languages: readonly string[]) {
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
            <span className="font-medium">
              {row.original.profile ? t(row.original.profile.effort) : t("unspecifiedEffort")}
            </span>
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
                const difference = englishScoreDifference(row.original, language);
                return (
                  <Link
                    href={`${guideConfigurationHref(row.original)}&language=${encodeURIComponent(language)}`}
                    className="group flex min-h-12 flex-col items-end justify-center gap-1 text-right tabular-nums"
                    title={
                      getValue() === undefined
                        ? t(score?.status === "incomplete" ? "incompleteScore" : "unmeasuredScore")
                        : t("scoreDetails")
                    }
                  >
                    <span className="font-mono text-base font-medium group-hover:underline">
                      {getValue() === undefined
                        ? "—"
                        : f.number(getValue()!, {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}
                    </span>
                    {language === "en" && getValue() !== undefined && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {t("baseline")}
                      </span>
                    )}
                    {difference !== undefined && (
                      <span
                        className={`font-mono text-xs ${Math.round(difference * 10) === 0 ? "text-muted-foreground" : difference > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}
                        title={t("differenceHelp")}
                      >
                        {t("differencePp", {
                          value: f.number(Math.round(difference * 10) / 10 || 0, {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                            signDisplay: "exceptZero",
                          }),
                        })}
                        <span className="sr-only"> {t("versusEnglish")}</span>
                      </span>
                    )}
                  </Link>
                );
              },
              sortFn: "basic",
              sortUndefined: "last",
              sortDescFirst: true,
            },
          ),
        ),
      ]),
    [f, t, locale, languages],
  );
}
