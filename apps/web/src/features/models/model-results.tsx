"use client";

import { useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { ReleaseManifest } from "@llang-gap/contracts";
import type { GuideModel } from "@llang-gap/contracts/guide";
import { Link } from "@/i18n/navigation";
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

export function ModelResults({
  model,
  releases,
  name,
  suiteId,
  taskCount,
  initialLanguage,
}: {
  model: GuideModel | null;
  releases: ReleaseManifest[];
  name: string;
  suiteId: string | null;
  taskCount: number;
  initialLanguage: string | null;
}) {
  const t = useTranslations("Models");
  const l = useTranslations("Leaderboard");
  const r = useTranslations("Releases");
  const locale = useLocale();
  const f = useFormatter();
  const languages = [
    ...new Set([
      ...releases.flatMap((release) => release.languages),
      ...(model?.scores.map((score) => score.language) ?? []),
    ]),
  ].sort();
  const [language, setLanguage] = useState(
    initialLanguage && languages.includes(initialLanguage)
      ? initialLanguage
      : (languages[0] ?? null),
  );
  const label = (tag: string) =>
    new Intl.DisplayNames([locale], { type: "language" }).of(tag) ?? tag;
  const score = model?.scores.find((entry) => entry.language === language);
  const rows = releases.flatMap((release) =>
    release.aggregate.flatMap((row) => {
      const result = row.scores.find((entry) => entry.language === language);
      return result ? [{ release, row, result }] : [];
    }),
  );
  const percent = (value: number) =>
    f.number(value, { style: "percent", maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const points = (value: number) =>
    f.number(value, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      signDisplay: "exceptZero",
    });
  const items = languages.map((tag) => ({ value: tag, label: label(tag) }));
  return (
    <div className="space-y-10">
      <section className="space-y-5" aria-labelledby="model-overview">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="model-overview" className="text-xl font-semibold">
            {t("overview")}
          </h2>
          {items.length > 0 && (
            <Select items={items} value={language} onValueChange={setLanguage}>
              <SelectTrigger
                aria-label={t("language")}
                className="min-w-48 rounded-lg bg-background"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  {items.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="rounded-xl border bg-background p-6 sm:p-8">
          <p className="text-xl font-medium leading-8">
            {score?.value !== null && score?.value !== undefined && language
              ? t("scoreSummary", {
                  model: name,
                  score: f.number(score.value, {
                    maximumFractionDigits: 1,
                    minimumFractionDigits: 1,
                  }),
                  language: label(language),
                })
              : t("noScore")}
          </p>
          {taskCount === 1 && <p className="mt-3 text-muted-foreground">{t("limited")}</p>}
          <p className="mt-3 max-w-3xl text-muted-foreground">{t("scope")}</p>
          <Link href="/methodology#model-guide" className="text-link mt-4">
            {t("methodology")} ↗
          </Link>
        </div>
      </section>
      <section className="space-y-4" aria-labelledby="model-history">
        <h2 id="model-history" className="text-xl font-semibold">
          {t("details")}
        </h2>
        {rows.length ? (
          <div className="overflow-hidden rounded-xl border bg-background">
            <Table>
              <caption className="sr-only">{t("history")}</caption>
              <TableHeader>
                <TableRow>
                  {[t("dataset"), t("accuracy"), t("configuration"), t("source")].map((title) => (
                    <TableHead key={title} scope="col">
                      {title}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ release, row, result }) => {
                  const used = score?.contributions.some(
                    (entry) =>
                      entry.releaseId === release.id &&
                      entry.transport === row.transport &&
                      entry.model === row.model &&
                      entry.effort === row.effort,
                  );
                  return (
                    <TableRow key={`${release.id}/${row.transport}/${row.model}/${row.effort}`}>
                      <TableCell>
                        <div className="font-medium">{release.dataset}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{release.protocol}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono">{percent(result.accuracy)}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {r("sample", { count: result.n, repeats: row.repeats })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          {l(row.effort)} · {row.transport}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {used ? t("used") : t("additional")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link href={`/releases/${release.id}`} className="text-link">
                          {t("release")} ↗
                        </Link>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {f.dateTime(new Date(release.createdAt), {
                            dateStyle: "medium",
                            timeZone: "UTC",
                          })}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-muted-foreground">{t("noLanguageResults")}</p>
        )}
        <p className="text-sm text-muted-foreground">
          {t("historyCount", { count: releases.length })}
        </p>
      </section>
      {rows.some(({ row }) =>
        row.comparisons.some((pair) => pair.baseline === language || pair.language === language),
      ) && (
        <details className="rounded-xl border bg-background p-5">
          <summary className="cursor-pointer font-medium">{t("paired")}</summary>
          <p className="mt-4 max-w-3xl text-muted-foreground">{t("pairedScope")}</p>
          <div className="mt-5 space-y-5">
            {rows.flatMap(({ release, row }) =>
              row.comparisons
                .filter((pair) => pair.baseline === language || pair.language === language)
                .map((pair) => (
                  <div
                    key={`${release.id}/${row.transport}/${row.model}/${row.effort}/${pair.baseline}/${pair.language}`}
                  >
                    <p className="font-medium">
                      {release.dataset} · {l(row.effort)} · {label(pair.baseline)} −{" "}
                      {label(pair.language)}
                    </p>
                    <p className="font-mono">
                      {points(pair.gapPp)} {l("gapUnit")} · {l("confidence")}: [
                      {pair.gapCi95.map(points).join(", ")}]
                    </p>
                    {pair.gapCi95[0] <= 0 && pair.gapCi95[1] >= 0 && (
                      <p className="text-sm text-muted-foreground">{l("neutral")}</p>
                    )}
                    <Link href={`/releases/${release.id}`} className="text-link">
                      {t("release")} ↗
                    </Link>
                  </div>
                )),
            )}
          </div>
        </details>
      )}
      <div className="space-y-2 text-sm text-muted-foreground">
        {suiteId && <p>{t("suite", { id: suiteId })}</p>}
        <p>
          {model?.profile
            ? t("profile", { ...model.profile, effort: l(model.profile.effort) })
            : t("noProfile")}
        </p>
      </div>
    </div>
  );
}
