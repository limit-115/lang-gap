import { RunCta } from "@/features/run-builder/run-cta";
import { FileArchive } from "lucide-react";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getMessagesForLocale } from "@/i18n/messages";
import { Link } from "@/i18n/navigation";
import { pageMetadata, siteUrl } from "@/shared/metadata";
import { JsonLd } from "@/shared/json-ld";
import { ModelFinderHero } from "@/features/leaderboard/model-finder";
import { LeaderboardTable } from "@/features/leaderboard/leaderboard-table";
import { getLatestRelease } from "@/features/releases/data";

type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Leaderboard" });
  return pageMetadata(
    locale,
    "",
    t("metadataTitle"),
    t((await getLatestRelease()) ? "metadataDescription" : "metadataPlannedDescription"),
  );
}
export default async function LeaderboardPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Leaderboard");
  const release = await getLatestRelease();
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          "@id": `${siteUrl}/#website`,
          url: `${siteUrl}/`,
          name: "Llang Gap",
          description: t(release ? "metadataDescription" : "metadataPlannedDescription"),
          inLanguage: [...routing.locales],
          publisher: {
            "@type": "Organization",
            name: "Limit 115",
            url: "https://github.com/limit-115",
          },
        }}
      />
      <NextIntlClientProvider messages={{ Leaderboard: getMessagesForLocale(locale).Leaderboard }}>
        <ModelFinderHero rows={release?.aggregate ?? []} />
      </NextIntlClientProvider>
      <section aria-labelledby="benchmark-title">
        <div className="panel-heading">
          <div>
            <h2 id="benchmark-title">{t("tableTitle")}</h2>
            <p>{release ? `${release.dataset} · ${release.protocol}` : t("tableDescription")}</p>
          </div>
        </div>
        <NextIntlClientProvider
          messages={{ Leaderboard: getMessagesForLocale(locale).Leaderboard }}
        >
          <LeaderboardTable
            rows={release?.aggregate ?? []}
            languages={release?.languages ?? []}
            comparisons={release?.comparisons ?? []}
          />
        </NextIntlClientProvider>
        <div className="panel-meta">
          {release ? (
            <>
              {release.aggregate[0]!.scores.map((score) => (
                <span key={score.language}>
                  {score.language.toUpperCase()} · {t("questions", { count: score.n })}
                </span>
              ))}
              <span>{t("repeats", { count: release.aggregate[0]!.repeats })}</span>
              <span>{t("languages", { count: release.languages.length })}</span>
              <span className="meta-last">{t("release", { id: release.id })}</span>
            </>
          ) : (
            <span>{t("noPublishedResults")}</span>
          )}
        </div>
      </section>
      {release && (
        <div className="release-link">
          <Link className="resource-link" href={`/releases/${release.id}`}>
            <FileArchive aria-hidden="true" />
            <span>{t("viewRelease")}</span>
          </Link>
        </div>
      )}
      <RunCta />
    </>
  );
}
