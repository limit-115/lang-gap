"use client";

import { useState, type CSSProperties } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Globe2,
  Info,
  Search,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LanguageFinder } from "@/features/leaderboard/language-finder";
import { guideConfigurationHref } from "@/features/leaderboard/table-state";
import { ModelOwnerLogo } from "@/features/leaderboard/model-owner-logo";
import {
  languageDatasets,
  rankedModels,
  scoreDifference,
  scoreValue,
  type LanguageModel,
  type languageData,
} from "./data";
import styles from "./language-concepts.module.css";

type Version = "shortlist" | "compare";
type Translate = ReturnType<typeof useTranslations<"Languages">>;

function ScoreHelp({ label, children }: { label: string; children: string }) {
  return (
    <Tooltip>
      <TooltipTrigger aria-label={label} className={styles.infoButton}>
        <Info size={13} aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
}

function Identity({ model, compact = false }: { model: LanguageModel; compact?: boolean }) {
  const t = useTranslations("Languages");
  return (
    <span className={styles.identity}>
      <span className={styles.logo}>
        <ModelOwnerLogo ownerId={model.owner} size={compact ? 20 : 24} />
      </span>
      <span>
        <strong>{model.name}</strong>
        <small>
          {!compact && `${model.developer} · `}
          {t("effort", { effort: model.profile?.effort ?? "unknown" })}
        </small>
      </span>
    </span>
  );
}

function AccuracyBar({ value, color, label }: { value: number; color?: string; label: string }) {
  return (
    <svg className={styles.bar} viewBox="0 0 100 7" preserveAspectRatio="none" aria-label={label}>
      <title>{label}</title>
      <rect width={value} height="7" rx="1" style={{ fill: color ?? "var(--green)" }} />
    </svg>
  );
}

export function LanguageConcepts({
  language,
  version,
  data,
  languageNames,
  nativeName,
}: {
  language: string;
  version: Version;
  data: ReturnType<typeof languageData>;
  languageNames: Record<string, string>;
  nativeName: string;
}) {
  const { models: publishedModels, languages, createdAt } = data;
  const datasets = languageDatasets(publishedModels, language);
  const t = useTranslations("Languages");
  const locale = useLocale();
  const label = (tag: string) => languageNames[tag] ?? tag;
  const name = label(language);
  const number = (value: number) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
      value,
    );
  const ranked = rankedModels(publishedModels, language);
  const modelHref = (model: LanguageModel) =>
    `${guideConfigurationHref(model)}&language=${encodeURIComponent(language)}`;
  const href = (view: Version) => `/languages/${encodeURIComponent(language)}?view=${view}`;
  const context = {
    language,
    name,
    number,
    label,
    t,
    modelHref,
    publishedModels,
    languages,
    datasets,
  };

  return (
    <article className={styles.page} data-concept={version}>
      <header className={styles.header}>
        <div className={styles.headerTitleRow}>
          <div className={styles.languageTitle}>
            <h1>{name}</h1>
            {nativeName !== name && <span lang={language}>{nativeName}</span>}
          </div>
          <div className={styles.headerLanguageFinder}>
            <LanguageFinder languages={languages} compact />
          </div>
        </div>
        {version === "compare" && <p>{t("workspaceIntro")}</p>}
        {ranked.length > 0 && (
          <div className={styles.metadata}>
            <span>
              {t("coverage", {
                models: new Set(ranked.map(({ model }) => model.id)).size,
                tests: datasets.length,
              })}
            </span>
            <span>·</span>
            {createdAt && (
              <span>
                {t("updated", {
                  date: new Intl.DateTimeFormat(locale, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(createdAt)),
                })}
              </span>
            )}
          </div>
        )}
      </header>
      {ranked.length === 0 ? (
        <section className={styles.empty}>
          <h2>{t("unsupported")}</h2>
          <p>{t("unsupportedBody")}</p>
        </section>
      ) : version === "shortlist" ? (
        <Shortlist {...context} href={href} />
      ) : (
        <>
          <Link className={styles.compareLink} href={href("shortlist")}>
            {t("backToLanguage", { language: name })}
          </Link>
          <Comparison {...context} />
        </>
      )}
      <footer className={styles.evidence}>
        <div>
          <BookOpen size={22} aria-hidden="true" />
          <div>
            <h2>{t("evidenceTitle")}</h2>
            <p>{t("evidenceBody")}</p>
          </div>
        </div>
        <Link href="/releases">
          {t("evidenceLink")}
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </footer>
    </article>
  );
}

type Context = {
  publishedModels: LanguageModel[];
  languages: string[];
  datasets: string[];
  language: string;
  name: string;
  number: (value: number) => string;
  label: (tag: string) => string;
  t: Translate;
  modelHref: (model: LanguageModel) => string;
};

function Shortlist({
  language,
  name,
  number,
  t,
  modelHref,
  href,
  publishedModels,
  datasets,
}: Context & { href: (view: Version) => string }) {
  const [dataset, setDataset] = useState("");
  const [search, setSearch] = useState("");
  const overall = rankedModels(publishedModels, language);
  const first = overall[0]!;
  const second = overall.find((row) => row.model.id !== first.model.id);
  const last = overall.at(-1)!;
  const jointTop = overall.filter((row) => row.rank === 1).length;
  const ranking = rankedModels(publishedModels, language, dataset || undefined);
  const top = ranking[0]?.score ?? 0;
  const filtered = ranking.filter(({ model }) =>
    `${model.name} ${model.developer}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <>
      <div className={styles.shortlistCards} data-single-model={!second}>
        <section className={styles.winner}>
          <div className={styles.cardLabel}>
            <span className={styles.liveDot} />
            {t(jointTop > 1 ? "jointHighest" : "highest")}
          </div>
          <Link className={styles.modelButton} href={modelHref(first.model)}>
            <Identity model={first.model} />
          </Link>
          <div className={styles.heroScore}>
            {number(first.score)}
            <span>%</span>
          </div>
          <p>
            {jointTop > 1
              ? t("tiedTop", { count: jointTop })
              : second
                ? t("pointsAhead", { points: number(scoreDifference(first.score, second.score)) })
                : t("correct")}
          </p>
          <Link
            href={modelHref(first.model)}
            className={`${buttonVariants()} ${styles.winnerButton}`}
          >
            {t("viewModel")}
            <ArrowRight aria-hidden="true" />
          </Link>
        </section>
        {second && (
          <section className={styles.pick}>
            <div className={styles.cardLabel}>{t("closest")}</div>
            <Link className={styles.modelButton} href={modelHref(second.model)}>
              <Identity model={second.model} />
            </Link>
            <div className={styles.pickScore}>
              {number(second.score)}
              <span>%</span>
            </div>
            <p>
              {scoreDifference(first.score, second.score) === 0
                ? t("sameTop")
                : t("behind", { points: number(scoreDifference(first.score, second.score)) })}
            </p>
            <Link
              href={modelHref(second.model)}
              className={`${buttonVariants({ variant: "ghost" })} ${styles.pickButton}`}
            >
              {t("viewModel")}
              <ArrowRight aria-hidden="true" />
            </Link>
          </section>
        )}
        <section className={`${styles.pick} ${styles.rangeCard}`}>
          <div className={styles.cardLabel}>{t("scoreRange")}</div>
          <div className={styles.rangeEndpoints}>
            <span>
              {t("low")}
              <strong>{number(last.score)}%</strong>
            </span>
            <span>
              {t("high")}
              <strong>{number(first.score)}%</strong>
            </span>
          </div>
          <div className={styles.rangeTrack} aria-hidden="true">
            <span
              style={{
                left: `${last.score}%`,
                width: `${scoreDifference(first.score, last.score)}%`,
              }}
            />
          </div>
          <div className={styles.pickScore}>
            {number(scoreDifference(first.score, last.score))}
            <span>{t("pp")}</span>
          </div>
          <p>{t("rangeBody", { count: overall.length })}</p>
        </section>
      </div>
      <section className={styles.rankingSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>{t("ranking")}</h2>
            <p>{t("rankingIntro")}</p>
          </div>
          <Link className={styles.compareLink} href={href("compare")}>
            {t("compareCta")}
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
        {datasets.length > 1 && (
          <fieldset className={styles.testTabs}>
            <legend className="sr-only">{t("test")}</legend>
            {[
              { value: "", label: t("allTests") },
              ...datasets.map((test) => ({ value: test, label: test })),
            ].map((item) => (
              <Button
                key={item.value}
                variant="ghost"
                aria-pressed={dataset === item.value}
                onClick={() => setDataset(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </fieldset>
        )}
        <div className={styles.tableControls}>
          <div className={styles.search}>
            <Search size={16} aria-hidden="true" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("search")}
              aria-label={t("search")}
            />
            {search && (
              <Button
                variant="ghost"
                size="icon-sm"
                className={styles.clearSearch}
                aria-label={t("clear")}
                onClick={() => setSearch("")}
              >
                <X size={14} aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.rankTable}>
            <caption className="sr-only">
              {name} · {t("ranking")}
            </caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">{t("model")}</th>
                <th scope="col" aria-sort="descending">
                  <span className={styles.columnLabel}>
                    {t("accuracy")}
                    <ArrowDown size={13} aria-hidden="true" />
                    <ScoreHelp label={t("accuracyInfo")}>{t("accuracyHelp")}</ScoreHelp>
                  </span>
                </th>
                <th scope="col">
                  <span className={styles.columnLabel}>
                    {t("fromTop")}
                    <ScoreHelp label={t("differenceInfo")}>{t("ppHelp")}</ScoreHelp>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ model, score, rank }) => {
                const difference = scoreDifference(score, top);
                return (
                  <tr key={model.key} data-leading={scoreDifference(score, top) === 0}>
                    <td>{rank}</td>
                    <td>
                      <Link className={styles.modelButton} href={modelHref(model)}>
                        <Identity model={model} compact />
                      </Link>
                    </td>
                    <td>
                      <Link
                        className={styles.scoreCell}
                        href={modelHref(model)}
                        aria-label={t("view", { model: model.name })}
                      >
                        <AccuracyBar
                          value={score}
                          color={
                            scoreDifference(score, top) === 0 ? "var(--green)" : "var(--rank-bar)"
                          }
                          label={`${model.name}: ${number(score)}%`}
                        />
                        <strong>
                          {number(score)}
                          <span>%</span>
                        </strong>
                      </Link>
                    </td>
                    <td>
                      <span className={styles.difference} data-negative={difference < 0}>
                        {difference === 0
                          ? t("leading")
                          : t("points", { value: number(difference) })}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className={styles.empty}>
            <p>{t("noResults")}</p>
            <Button variant="outline" onClick={() => setSearch("")}>
              {t("clear")}
            </Button>
          </div>
        )}
      </section>
    </>
  );
}

function Comparison({
  language,
  name,
  number,
  label,
  t,
  modelHref,
  publishedModels,
  datasets,
  languages: declaredLanguages,
}: Context) {
  const ranked = rankedModels(publishedModels, language);
  const [ids, setIds] = useState(ranked.slice(0, 3).map(({ model }) => model.key));
  const models = ids.flatMap((id) => publishedModels.filter((model) => model.key === id));
  const toggle = (id: string) =>
    setIds((current) =>
      current.includes(id)
        ? current.length > 1
          ? current.filter((item) => item !== id)
          : current
        : current.length < 3
          ? [...current, id]
          : current,
    );
  const languages = [...declaredLanguages].sort((a, b) =>
    a === language ? -1 : b === language ? 1 : label(a).localeCompare(label(b)),
  );
  return (
    <div className={styles.comparisonLayout}>
      <aside className={styles.modelRail}>
        <h2>{t("selectModels")}</h2>
        <p>{t("selected", { count: ids.length })}</p>
        <div className={styles.modelChoices}>
          {ranked.map(({ model, score }) => (
            <Button
              key={model.key}
              variant="ghost"
              aria-pressed={ids.includes(model.key)}
              disabled={ids.includes(model.key) ? ids.length === 1 : ids.length === 3}
              onClick={() => toggle(model.key)}
              className={styles.modelChoice}
            >
              <span
                className={styles.checkbox}
                style={
                  ids.includes(model.key)
                    ? { background: model.color, borderColor: model.color }
                    : undefined
                }
              >
                {ids.includes(model.key) && <Check size={12} />}
              </span>
              <span>
                <strong>{model.name}</strong>
                <small>{t("effort", { effort: model.profile?.effort ?? "unknown" })}</small>
              </span>
              <span className={styles.choiceScore}>{number(score)}%</span>
            </Button>
          ))}
        </div>
        <p className={styles.selectionHelp}>{t("selectionHelp")}</p>
      </aside>
      <div className={styles.comparisonMain}>
        <div
          className={styles.comparisonCards}
          style={{ "--selected-count": models.length } as CSSProperties}
        >
          {models.map((model) => (
            <Link
              className={styles.comparisonCard}
              style={{ "--model-color": model.color } as CSSProperties}
              key={model.key}
              href={modelHref(model)}
              aria-label={t("view", { model: model.name })}
            >
              <span className={styles.cardModel}>
                <ModelOwnerLogo ownerId={model.owner} size={22} />
                <ArrowUpRight size={16} />
              </span>
              <strong>{model.name}</strong>
              <span className={styles.muted}>
                {t("effort", { effort: model.profile?.effort ?? "unknown" })}
              </span>
              <span className={styles.comparisonScore}>
                {number(scoreValue(model, language)!)}
                <small>%</small>
              </span>
              <span className={styles.muted}>{t("correct")}</span>
            </Link>
          ))}
        </div>
        <section className={styles.chartPanel}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>{t("byTask")}</h2>
              <p>{t("byTaskBody")}</p>
            </div>
          </div>
          <div className={styles.legend}>
            {models.map((model) => (
              <span key={model.key}>
                <i style={{ background: model.color }} />
                {model.name} · {t("effort", { effort: model.profile?.effort ?? "unknown" })}
              </span>
            ))}
          </div>
          <div className={styles.groupChart}>
            <div className={styles.chartGrid} aria-hidden="true">
              {[100, 75, 50, 25, 0].map((tick) => (
                <div key={tick}>
                  <span>{tick}%</span>
                </div>
              ))}
            </div>
            <div className={styles.chartGroups}>
              {datasets.map((dataset) => (
                <div className={styles.chartGroup} key={dataset}>
                  <div className={styles.columns}>
                    {models.map((model) => {
                      const score = scoreValue(model, language, dataset);
                      return (
                        <div key={model.key} className={styles.columnSlot}>
                          {score !== null && (
                            <Link
                              className={styles.column}
                              style={{ height: `${score}%`, background: model.color }}
                              href={modelHref(model)}
                              aria-label={`${model.name} · ${dataset}: ${number(score)}%`}
                            >
                              <span>{number(score)}</span>
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <span className={styles.groupLabel}>{dataset}</span>
                </div>
              ))}
            </div>
          </div>
          <p className={styles.tableNote}>{t("scale")}</p>
        </section>
        <section className={styles.matrixPanel}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>{t("across")}</h2>
              <p>{t("acrossBody")}</p>
            </div>
            <Globe2 size={22} aria-hidden="true" />
          </div>
          <div className={styles.tableScroll}>
            <table className={styles.matrix}>
              <caption className="sr-only">{t("across")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("language")}</th>
                  {models.map((model) => (
                    <th scope="col" key={model.key}>
                      <i style={{ background: model.color }} />
                      {model.name}
                      <small className={styles.matrixEffort}>
                        {t("effort", { effort: model.profile?.effort ?? "unknown" })}
                      </small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {languages.map((tag) => (
                  <tr key={tag} data-current={tag === language}>
                    <th scope="row">
                      {label(tag)}
                      {tag === language && <span>{t("current")}</span>}
                    </th>
                    {models.map((model) => {
                      const score = scoreValue(model, tag);
                      return (
                        <td key={model.key}>
                          <span
                            className={styles.heatCell}
                            style={
                              score === null
                                ? undefined
                                : {
                                    background: `color-mix(in srgb, ${model.color} ${Math.max(3, (score - 45) * 0.7)}%, var(--background))`,
                                  }
                            }
                          >
                            {score === null ? (
                              <span title={t("missing")}>—</span>
                            ) : (
                              `${number(score)}%`
                            )}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.tableNote}>
            {name} · {t("accuracyHelp")}
          </p>
        </section>
      </div>
    </div>
  );
}
