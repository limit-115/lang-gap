"use client";

import type { ReleaseManifest } from "@llang-gap/contracts";
import { useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  FileText,
  FlaskConical,
  Folder,
  FolderOpen,
  Globe2,
  Grid2X2,
  Monitor,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { groupReleasesByDay, matchesRelease, releaseModels } from "./presentation";
import "./release-designs.css";

export type ReleaseDesign = "journal" | "desktop" | "board";
const designs = [
  { id: "journal", icon: BookOpen },
  { id: "desktop", icon: Monitor },
  { id: "board", icon: Grid2X2 },
] as const;

export function ReleaseDesigns({
  releases,
  design,
  showDesignPicker = true,
}: {
  releases: ReleaseManifest[];
  design: ReleaseDesign;
  showDesignPicker?: boolean;
}) {
  const t = useTranslations("Releases.designs");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [dataset, setDataset] = useState("all");
  const [oldestFirst, setOldestFirst] = useState(false);
  const datasets = [...new Set(releases.map((release) => release.dataset))].sort();
  const languages = [...new Set(releases.flatMap((release) => release.languages))];
  const allGroups = groupReleasesByDay(releases);
  const visible = releases.filter(
    (release) =>
      (dataset === "all" || release.dataset === dataset) && matchesRelease(release, query, locale),
  );
  const groups = groupReleasesByDay(visible, oldestFirst);
  const languageNames = new Intl.DisplayNames([locale], { type: "language" });
  const date = (day: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(day));
  const publicationTime = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  });
  const languageName = (language: string) => languageNames.of(language) ?? language;
  const title = (release: ReleaseManifest) => {
    const models = releaseModels(release);
    const subject =
      models.length === 1 ? models[0]!.label : t("modelCount", { count: models.length });
    return release.languages.length <= 2
      ? `${subject} · ${release.languages.map(languageName).join(" + ")}`
      : t("reportTitle", { subject, count: release.languages.length });
  };
  const reset = () => {
    setQuery("");
    setDataset("all");
  };

  function LanguageTags({ release }: { release: ReleaseManifest }) {
    return (
      <ul className="report-languages" aria-label={t("languages")}>
        {release.languages.map((language) => (
          <li key={language} title={languageName(language)}>
            <span className="sr-only">{languageName(language)}: </span>
            {language.toUpperCase()}
          </li>
        ))}
      </ul>
    );
  }

  function Report({ release, index }: { release: ReleaseManifest; index: number }) {
    const models = releaseModels(release);
    const time = publicationTime.format(new Date(release.createdAt));
    return (
      <article className={`report-card report-tone-${index % 4}`}>
        <Link className="report-main-link" href={`/releases/${release.id}`} title={release.id}>
          <span className="report-icon">
            <FileText aria-hidden="true" />
          </span>
          <div className="report-content">
            <div className="report-topline">
              <span className="report-dataset">{release.dataset}</span>
              {design === "board" ? (
                <time
                  className="report-time-chip"
                  dateTime={release.createdAt}
                  aria-label={t("publishedTime", { time })}
                >
                  {time} UTC
                </time>
              ) : (
                <span className="report-model-count">
                  {t("modelCount", { count: models.length })}
                </span>
              )}
            </div>
            <h3>{title(release)}</h3>
            <p className="report-models">
              {models.length === 1
                ? models[0]!.ownerName
                : models.map((model) => model.label).join(" · ")}
            </p>
            <LanguageTags release={release} />
            <span className="report-id">{release.id}</span>
          </div>
          {design === "desktop" && (
            <time
              className="report-published"
              dateTime={release.createdAt}
              aria-label={t("publishedTime", { time })}
            >
              {time}
            </time>
          )}
          <span className="report-open">
            <span>{t("openReport")}</span>
            <ArrowUpRight aria-hidden="true" />
          </span>
        </Link>
      </article>
    );
  }

  const controls = (
    <div className="archive-controls">
      <div className="archive-search">
        <Search aria-hidden="true" />
        <Input
          type="search"
          aria-label={t("search")}
          placeholder={t("search")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <Select
        value={dataset}
        onValueChange={(value) => setDataset(value ?? "all")}
        items={[
          { value: "all", label: t("allDatasets") },
          ...datasets.map((value) => ({ value, label: value })),
        ]}
      >
        <SelectTrigger className="archive-select" aria-label={t("datasetFilter")}>
          <SlidersHorizontal aria-hidden="true" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-md">
          <SelectItem value="all">{t("allDatasets")}</SelectItem>
          {datasets.map((value) => (
            <SelectItem key={value} value={value}>
              {value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        className="archive-sort"
        onClick={() => setOldestFirst(!oldestFirst)}
      >
        {oldestFirst ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}
        {t(oldestFirst ? "oldestFirst" : "newestFirst")}
      </Button>
    </div>
  );

  const empty = (
    <Empty className="archive-empty">
      <EmptyHeader>
        <Search aria-hidden="true" />
        <EmptyTitle>{t(releases.length ? "noMatches" : "noReleases")}</EmptyTitle>
        <EmptyDescription>{t(releases.length ? "trySearch" : "comingSoon")}</EmptyDescription>
      </EmptyHeader>
      {releases.length > 0 && (
        <Button variant="outline" onClick={reset}>
          {t("clearFilters")}
        </Button>
      )}
    </Empty>
  );

  const dailyReports = groups.length
    ? groups.map(({ day, reports }) => (
        <section
          className="release-day"
          key={day}
          id={`day-${day}`}
          aria-labelledby={`heading-${day}`}
        >
          <div className="release-day-heading">
            <span className="day-marker">
              <CalendarDays aria-hidden="true" />
            </span>
            <div>
              <h2 id={`heading-${day}`}>
                <time dateTime={day}>{date(day)}</time>
              </h2>
              <span>
                {t("reportCount", { count: reports.length })}
                <span className="day-timezone"> · UTC</span>
              </span>
            </div>
            {day === allGroups[0]?.day && <span className="latest-day">{t("latestDay")}</span>}
          </div>
          <div className="daily-reports">
            {reports.map((release, index) => (
              <Report release={release} index={index} key={release.id} />
            ))}
          </div>
        </section>
      ))
    : empty;

  return (
    <div className={`release-design release-design-${design}`}>
      {showDesignPicker && (
        <nav className="design-picker" aria-label={t("chooseDesign")}>
          <span>{t("chooseDesign")}</span>
          <div>
            {designs.map(({ id, icon: Icon }) => (
              <Link
                href={`/releases?design=${id}`}
                key={id}
                aria-current={design === id ? "page" : undefined}
              >
                <Icon aria-hidden="true" />
                {t(id)}
              </Link>
            ))}
          </div>
          <Link className="design-original" href="/releases?design=original">
            {t("original")}
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </nav>
      )}

      {design === "desktop" ? (
        <>
          <div className="desktop-heading">
            <h1>{t("desktopTitle")}</h1>
            <p>{t("desktopIntro")}</p>
          </div>
          <div className="archive-window">
            <div className="window-titlebar">
              <span>
                <FolderOpen aria-hidden="true" />
                {t("windowTitle")}
              </span>
              <span className="window-status">
                <span />
                {t("publicArchive")}
              </span>
            </div>
            <div className="window-path">
              <FolderOpen aria-hidden="true" />
              <span>Llang Gap</span>
              <ChevronRight aria-hidden="true" />
              <strong>{t("releaseHistory")}</strong>
              <span className="path-count">{t("reportCount", { count: releases.length })}</span>
            </div>
            <div className="window-body">
              <aside className="archive-sidebar">
                <a className="sidebar-all" href="#archive-results" onClick={reset}>
                  <FolderOpen aria-hidden="true" />
                  {t("allReports")}
                  <span>{releases.length}</span>
                </a>
                <p className="sidebar-label">{t("publishedOn")}</p>
                <nav aria-label={t("jumpToDate")}>
                  {allGroups.map(({ day, reports }) => (
                    <a key={day} href={`#day-${day}`} onClick={reset}>
                      <Folder aria-hidden="true" />
                      <span>{date(day)}</span>
                      <small>{reports.length}</small>
                    </a>
                  ))}
                </nav>
                <div className="sidebar-note">
                  <Image
                    className="sidebar-researcher"
                    src="/brand/release-researcher.png"
                    alt=""
                    width={180}
                    height={120}
                  />
                  <h2>{t("evidenceTitle")}</h2>
                  <p>{t("evidenceShort")}</p>
                  <Link href="/methodology">
                    {t("howItWorks")}
                    <ArrowUpRight aria-hidden="true" />
                  </Link>
                </div>
              </aside>
              <div className="window-content" id="archive-results">
                {controls}
                <div className="desktop-column-head">
                  <span>{t("report")}</span>
                  <span>{t("publishedColumn")}</span>
                  <span className="sr-only">{t("openReport")}</span>
                </div>
                {dailyReports}
              </div>
            </div>
            <div className="window-bottom">
              <output>{t("showing", { shown: visible.length, total: releases.length })}</output>
              <span>
                <Check aria-hidden="true" />
                {t("evidenceIncluded")}
              </span>
            </div>
          </div>
          <div className="desktop-footnote">
            <FlaskConical aria-hidden="true" />
            <p>{t("desktopFootnote")}</p>
            <Link href="/run">
              {t("buildRun")}
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </>
      ) : (
        <>
          <header className="archive-hero">
            <div>
              <h1>
                {t(design === "journal" ? "journalTitle" : "boardTitle")}
                <span>{t(design === "journal" ? "journalAccent" : "boardAccent")}</span>
              </h1>
              <p>{t(design === "journal" ? "journalIntro" : "boardIntro")}</p>
              <div className="archive-overview">
                <span>
                  <FileText aria-hidden="true" />
                  {t("reportCount", { count: releases.length })}
                </span>
                <span>
                  <Globe2 aria-hidden="true" />
                  {t("languageCount", { count: languages.length })}
                </span>
                <Link href="/methodology">
                  {t("howWeTest")}
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              </div>
            </div>
            <div className="archive-hero-art" aria-hidden="true">
              <Image
                src="/brand/release-researcher.png"
                alt=""
                width={320}
                height={213}
                sizes="(max-width: 540px) 95px, 280px"
                loading="eager"
              />
              <span className="art-note">{t("artNote")}</span>
            </div>
          </header>
          {controls}
          <div className="archive-result-meta">
            <output>{t("showing", { shown: visible.length, total: releases.length })}</output>
            <span>
              <CalendarDays aria-hidden="true" />
              {t("groupedByDay")}
            </span>
          </div>
          <div className="archive-days">{dailyReports}</div>
          <aside className="archive-evidence">
            <span className="evidence-icon">
              <ShieldCheck aria-hidden="true" />
            </span>
            <div>
              <h2>{t("evidenceTitle")}</h2>
              <p>{t("evidenceIntro")}</p>
            </div>
            <Link href="/methodology">
              {t("checkMethodology")}
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </aside>
        </>
      )}
    </div>
  );
}
