"use client";

import type { ReleaseManifest, ReleaseSubmissions } from "@llang-gap/contracts";
import { useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
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
  UserRound,
} from "lucide-react";
import { LinkSurface, TextLink } from "@/shared/links/link";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import {
  Select,
  SelectContent,
  SelectGroup,
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
  submitters,
  design,
  showDesignPicker = true,
}: {
  releases: ReleaseManifest[];
  submitters: ReleaseSubmissions["releases"];
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
          <li key={language}>{languageName(language)}</li>
        ))}
      </ul>
    );
  }

  function Report({ release, index }: { release: ReleaseManifest; index: number }) {
    const models = releaseModels(release);
    const submitter = submitters[release.id];
    const time = publicationTime.format(new Date(release.createdAt));
    return (
      <article className={`report-card report-tone-${index % 4}`}>
        <LinkSurface
          className="report-main-link"
          href={`/releases/${release.id}`}
          title={release.id}
        >
          <span className="report-icon">
            <FileText aria-hidden="true" />
          </span>
          <div className="report-content">
            <div className="report-topline">
              <span className="report-dataset">{release.dataset}</span>
              {design !== "board" && (
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
          {design !== "board" && (
            <span className="report-open">
              <span>{t("openReport")}</span>
            </span>
          )}
        </LinkSurface>
        {design === "board" && (
          <footer className="report-card-footer">
            <div className="report-submitter">
              <UserRound aria-hidden="true" />
              {submitter ? (
                <span>
                  {t("submittedBy")}{" "}
                  <TextLink
                    href={`https://github.com/${submitter.githubUsername}`}
                    title={`@${submitter.githubUsername}`}
                  >
                    {submitter.fullName}
                  </TextLink>{" "}
                  <time className="report-submitted-time" dateTime={release.createdAt}>
                    {t("submittedAt", { time })}
                  </time>
                </span>
              ) : (
                <span>
                  {t("submitterUnknown")} ·{" "}
                  <time className="report-submitted-time" dateTime={release.createdAt}>
                    {t("publishedTime", { time })}
                  </time>
                </span>
              )}
            </div>
            <TextLink
              layout="standalone"
              direction="forward"
              className="report-open"
              href={`/releases/${release.id}`}
              aria-label={t("openNamedReport", { title: title(release) })}
            >
              <span>{t("openReport")}</span>
            </TextLink>
          </footer>
        )}
      </article>
    );
  }

  const controls = (
    <div className="archive-controls">
      <SearchInput
        className="archive-search"
        label={t("search")}
        clearLabel={t("clearSearch")}
        value={query}
        onValueChange={setQuery}
      />
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
        <SelectContent align="start" alignItemWithTrigger={false}>
          <SelectGroup>
            <SelectItem value="all">{t("allDatasets")}</SelectItem>
            {datasets.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectGroup>
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
            <div>
              <h2 id={`heading-${day}`}>
                <time dateTime={day}>{date(day)}</time>
              </h2>
              <span>{t("reportCount", { count: reports.length })}</span>
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
              <LinkSurface
                href={`/releases?design=${id}`}
                key={id}
                aria-current={design === id ? "page" : undefined}
              >
                <Icon aria-hidden="true" />
                {t(id)}
              </LinkSurface>
            ))}
          </div>
          <TextLink
            layout="standalone"
            direction="forward"
            className="design-original"
            href="/releases?design=original"
          >
            {t("original")}
          </TextLink>
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
              <span>Lang Gap</span>
              <ChevronRight aria-hidden="true" />
              <strong>{t("releaseHistory")}</strong>
              <span className="path-count">{t("reportCount", { count: releases.length })}</span>
            </div>
            <div className="window-body">
              <aside className="archive-sidebar">
                <LinkSurface className="sidebar-all" href="#archive-results" onClick={reset}>
                  <FolderOpen aria-hidden="true" />
                  {t("allReports")}
                  <span>{releases.length}</span>
                </LinkSurface>
                <p className="sidebar-label">{t("publishedOn")}</p>
                <nav aria-label={t("jumpToDate")}>
                  {allGroups.map(({ day, reports }) => (
                    <LinkSurface key={day} href={`#day-${day}`} onClick={reset}>
                      <Folder aria-hidden="true" />
                      <span>{date(day)}</span>
                      <small>{reports.length}</small>
                    </LinkSurface>
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
                  <TextLink layout="standalone" direction="forward" href="/methodology">
                    {t("howItWorks")}
                  </TextLink>
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
            <TextLink layout="standalone" direction="forward" href="/run">
              {t("buildRun")}
            </TextLink>
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
                <TextLink layout="standalone" direction="forward" href="/methodology">
                  {t("howWeTest")}
                </TextLink>
              </div>
            </div>
            <div className="archive-hero-art" aria-hidden="true">
              <Image
                className="archive-art-light"
                src="/brand/release-researcher.png"
                alt=""
                width={320}
                height={213}
                sizes="(max-width: 540px) 95px, 280px"
                fetchPriority="high"
              />
              {design === "board" && (
                <Image
                  className="archive-art-dark"
                  src="/brand/release-researcher-dark.png"
                  alt=""
                  width={320}
                  height={213}
                  sizes="(max-width: 540px) 95px, 280px"
                  fetchPriority="high"
                />
              )}
              <span className="art-note">{t("artNote")}</span>
            </div>
          </header>
          {controls}
          <div className="archive-days">{dailyReports}</div>
          <div className="archive-result-meta">
            <output>{t("showing", { shown: visible.length, total: releases.length })}</output>
          </div>
          <aside className="archive-evidence">
            <span className="evidence-icon">
              <ShieldCheck aria-hidden="true" />
            </span>
            <div>
              <h2>{t("evidenceTitle")}</h2>
              <p>{t("evidenceIntro")}</p>
            </div>
            <TextLink layout="standalone" direction="forward" href="/methodology">
              {t("checkMethodology")}
            </TextLink>
          </aside>
        </>
      )}
    </div>
  );
}
