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
import { getModelGuide } from "@/features/leaderboard/guide-data";
import { guideLanguages } from "@/features/leaderboard/table-state";

type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Leaderboard" });
  return pageMetadata(
    locale,
    "",
    t("metadataTitle"),
    t((await getModelGuide()) ? "metadataDescription" : "metadataPlannedDescription"),
  );
}
export default async function LeaderboardPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Leaderboard");
  const guide = await getModelGuide();
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          "@id": `${siteUrl}/#website`,
          url: `${siteUrl}/`,
          name: "Llang Gap",
          description: t(guide ? "metadataDescription" : "metadataPlannedDescription"),
          inLanguage: [...routing.locales],
          publisher: {
            "@type": "Organization",
            name: "Limit 115",
            url: "https://github.com/limit-115",
          },
        }}
      />
      <NextIntlClientProvider messages={{ Leaderboard: getMessagesForLocale(locale).Leaderboard }}>
        <ModelFinderHero rows={guide?.models.map((model) => model.reference) ?? []} />
      </NextIntlClientProvider>
      <section aria-labelledby="benchmark-title">
        <div className="panel-heading">
          <div>
            <h2 id="benchmark-title">{t("tableTitle")}</h2>
          </div>
        </div>
        <NextIntlClientProvider
          messages={{ Leaderboard: getMessagesForLocale(locale).Leaderboard }}
        >
          <LeaderboardTable
            key={guide?.id ?? "empty"}
            rows={guide?.models ?? []}
            languages={guideLanguages(guide?.models ?? [], guide?.languages ?? [])}
          />
        </NextIntlClientProvider>
      </section>
      {guide && (
        <div className="release-link">
          <Link className="resource-link" href="/releases">
            <FileArchive aria-hidden="true" />
            <span>{t("viewRelease")}</span>
          </Link>
        </div>
      )}
      <RunCta />
    </>
  );
}
