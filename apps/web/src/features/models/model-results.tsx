"use client";

import { useRef, useState } from "react";
import { ArrowUpRight, Globe2, Search, X } from "lucide-react";
import type { ModelReference } from "@llang-gap/contracts";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { guideRowKey, type GuideModel } from "@llang-gap/contracts/guide";
import { Link, useRouter } from "@/i18n/navigation";
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
import { ModelOwnerLogo } from "@/features/leaderboard/model-owner-logo";
import { getLanguageHref } from "@/features/leaderboard/language-catalog";
import { ModelFinder } from "@/features/leaderboard/model-finder";
import { guideConfigurationHref } from "@/features/leaderboard/table-state";
import { filterModelLanguages, summarizeModelScores } from "./overview-data";
import styles from "./model-results.module.css";

export function ModelResults({
  model,
  profiles,
  name,
  ownerId,
  ownerName,
  updatedAt,
  initialLanguage,
  isSummary,
  sourceHref,
  sourceCount,
  languageNames,
  modelOptions,
}: {
  model: GuideModel | null;
  profiles: GuideModel[];
  name: string;
  ownerId: string | null;
  ownerName: string;
  updatedAt: string | null;
  initialLanguage: string | null;
  isSummary: boolean;
  sourceHref: string;
  sourceCount: number;
  languageNames: Record<string, { local: string; native: string }>;
  modelOptions: ModelReference[];
}) {
  const t = useTranslations("Models");
  const l = useTranslations("Leaderboard");
  const f = useFormatter();
  const locale = useLocale();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const overview = summarizeModelScores(model);
  const label = (tag: string) => languageNames[tag]?.local ?? tag;
  const scoreLabel = (value: number) =>
    isSummary
      ? f.number(value / 100, {
          style: "percent",
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })
      : f.number(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const languageList = (tags: string[]) => {
    const names = tags.slice(0, 2).map(label);
    const list = new Intl.ListFormat(locale, { style: "short", type: "conjunction" }).format(names);
    return tags.length > 2 ? `${list} · ${t("moreLanguages", { count: tags.length - 2 })}` : list;
  };
  const rows = filterModelLanguages(
    overview.scores
      .map((score) => ({
        ...score,
        label: label(score.language),
        native: languageNames[score.language]?.native ?? score.language,
      }))
      .sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || a.label.localeCompare(b.label, locale)),
    search,
    locale,
  );
  const clearSearch = () => {
    setSearch("");
    input.current?.focus();
  };
  const profileItems = profiles.map((entry) => ({
    value: guideRowKey(entry),
    label: entry.profile
      ? `${l(entry.profile.effort)}${profiles.some((other) => other.profile?.effort === entry.profile?.effort && other.profile?.transport !== entry.profile?.transport) ? ` · ${entry.profile.transport}` : ""}`
      : t("publishedResults"),
  }));

  return (
    <article className={styles.page}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <div className={styles.modelIcon}>
            <ModelOwnerLogo ownerId={ownerId} size={34} />
          </div>
          <h1>{name}</h1>
          <p className={styles.provider}>{ownerName}</p>
          <div className={styles.meta}>
            <span>
              <Globe2 size={15} aria-hidden="true" />
              {t("languageCount", { count: overview.measured.length })}
            </span>
            {updatedAt && (
              <time dateTime={updatedAt}>
                {t("updated")}{" "}
                {f.dateTime(new Date(updatedAt), { dateStyle: "medium", timeZone: "UTC" })}
              </time>
            )}
          </div>
        </div>
        <div className={styles.modelPicker}>
          <ModelFinder rows={modelOptions} compact language={initialLanguage} />
        </div>
      </header>
      {overview.measured.length > 0 && (
        <div className={styles.stats}>
          <div>
            <span>{t("highest")}</span>
            <p>{scoreLabel(overview.highest!)}</p>
            <small>{languageList(overview.highestLanguages)}</small>
          </div>
          <div>
            <span>{t("lowest")}</span>
            <p>{scoreLabel(overview.lowest!)}</p>
            <small>{languageList(overview.lowestLanguages)}</small>
          </div>
          <div>
            <span>{t("languageGap")}</span>
            <p>
              {overview.spread === null ? (
                "—"
              ) : (
                <>
                  {f.number(overview.spread, {
                    maximumFractionDigits: 1,
                    minimumFractionDigits: 1,
                  })}
                  <abbr title={t(isSummary ? "percentagePoints" : "scorePoints")}>
                    {t(isSummary ? "pp" : "points")}
                  </abbr>
                </>
              )}
            </p>
            <small>{t(overview.spread === null ? "gapUnavailable" : "highestToLowest")}</small>
          </div>
        </div>
      )}
      <section className={styles.chart} aria-labelledby="model-language-chart">
        <div className={styles.chartHeader}>
          <div>
            <h2 id="model-language-chart">{t("languageChart")}</h2>
            <p>{t(isSummary ? "chartDescription" : "legacyDescription")}</p>
          </div>
        </div>
        {(overview.scores.length > 0 || profiles.length > 1) && (
          <div className={styles.toolbar}>
            {overview.scores.length > 0 && (
              <div className={styles.search}>
                <Search size={16} aria-hidden="true" />
                <Input
                  ref={input}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("searchLanguage")}
                  aria-label={t("searchLanguage")}
                />
                {search && (
                  <button type="button" aria-label={t("clearSearch")} onClick={clearSearch}>
                    <X size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
            {profiles.length > 1 && (
              <div className={styles.profileSelect}>
                <Select
                  items={profileItems}
                  value={model ? guideRowKey(model) : null}
                  onValueChange={(value) => {
                    const next = profiles.find((entry) => guideRowKey(entry) === value);
                    if (next)
                      router.push(
                        `${guideConfigurationHref(next)}${initialLanguage ? `&language=${encodeURIComponent(initialLanguage)}` : ""}`,
                        { scroll: false },
                      );
                  }}
                >
                  <SelectTrigger className={styles.picker} aria-label={l("effort")}>
                    <SelectValue placeholder={t("chooseResult")} />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {profileItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
        {overview.scores.length > 0 ? (
          <>
            <div className={styles.axis} aria-hidden="true">
              <span>{t("languageLabel")}</span>
              <div>
                {[0, 25, 50, 75, 100].map((tick) => (
                  <span key={tick}>
                    {tick}
                    {isSummary ? "%" : ""}
                  </span>
                ))}
              </div>
              <span>{t(isSummary ? "accuracy" : "score")}</span>
            </div>
            <ul className={styles.rows} aria-label={t("languageChart")}>
              {rows.map((score) => (
                <li
                  key={score.language}
                  className={styles.row}
                  data-language={score.language}
                  data-highlighted={score.language === initialLanguage}
                >
                  <Link
                    className={styles.language}
                    href={getLanguageHref({ value: score.language })}
                  >
                    <span>{score.label}</span>
                    {score.native.toLocaleLowerCase(locale) !==
                      score.label.toLocaleLowerCase(locale) && (
                      <small lang={score.language}>{score.native}</small>
                    )}
                  </Link>
                  <div className={styles.track} aria-hidden="true">
                    {score.value === null ? (
                      <span className={styles.missing} />
                    ) : (
                      <span className={styles.bar} style={{ width: `${score.value}%` }} />
                    )}
                  </div>
                  <span className={styles.value}>
                    {score.value === null ? (
                      <>
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">{t("missingScore")}</span>
                      </>
                    ) : (
                      scoreLabel(score.value)
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {!rows.length && (
              <div className={styles.empty}>
                <Search size={24} aria-hidden="true" />
                <h3>{t("noSearch")}</h3>
                <Button variant="outline" onClick={clearSearch}>
                  {t("clearSearch")}
                </Button>
              </div>
            )}
            {overview.scores.some((score) => score.value === null) && (
              <p className={styles.chartNote}>— {t("missingScore")}</p>
            )}
          </>
        ) : (
          <div className={styles.empty}>
            <h3>{t("noOverview")}</h3>
          </div>
        )}
      </section>
      <footer className={styles.sources}>
        <Link href={sourceHref}>
          {t("seeExperiments")}
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
        <span>{t("historyCount", { count: sourceCount })}</span>
      </footer>
    </article>
  );
}
