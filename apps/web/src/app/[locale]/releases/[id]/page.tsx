import { ArrowLeft, BookOpen } from "lucide-react";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getMessagesForLocale } from "@/i18n/messages";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { pageMetadata, siteUrl } from "@/shared/metadata";
import { JsonLd } from "@/shared/json-ld";
import {
  getRelease,
  getReleases,
  getReleaseAssetsUrl,
  releaseAssetUrl,
} from "@/features/releases/data";
import { ReleaseCitation } from "@/features/releases/release-citation";
import { releaseBibtex } from "@/features/releases/citation";
import { releaseStructuredData } from "@/features/releases/structured-data";
import { getModelPresentation } from "@/features/leaderboard/model-catalog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = { params: Promise<{ locale: string; id: string }> };
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getReleases()).map(({ id }) => ({ id }));
}

export async function generateMetadata({ params }: Props) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const release = await getRelease(id);
  if (!release) notFound();
  const t = await getTranslations({ locale, namespace: "Releases" });
  return pageMetadata(
    locale,
    `/releases/${id}`,
    t("detailTitle", { id }),
    t("detailDescription", { dataset: release.dataset, protocol: release.protocol }),
  );
}

export default async function ReleasePage({ params }: Props) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const release = await getRelease(id);
  if (!release) notFound();
  const baseUrl = await getReleaseAssetsUrl(id);
  const t = await getTranslations("Releases");
  const l = await getTranslations("Leaderboard");
  const description = t("detailDescription", {
    dataset: release.dataset,
    protocol: release.protocol,
  });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(release.createdAt),
  );
  const languageName = (language: string) =>
    new Intl.DisplayNames([locale], { type: "language" }).of(language) ?? language;
  const percent = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(n);
  const pp = (n: number) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      signDisplay: "exceptZero",
    }).format(n);
  const url = `${siteUrl}/${locale}/releases/${id}/`;
  return (
    <article className="min-w-0 pb-16">
      <JsonLd data={releaseStructuredData(release, baseUrl, locale, description)} />
      <header className="intro">
        <Link className="resource-link mb-6" href="/releases">
          <ArrowLeft aria-hidden="true" />
          <span>{t("back")}</span>
        </Link>
        <h1 className="break-words">{t("detailTitle", { id })}</h1>
        <p>{description}</p>
        <p>
          <time dateTime={release.createdAt}>{t("fileCreated", { date })}</time>
        </p>
      </header>
      <section className="space-y-5" aria-labelledby="scores">
        <h2 id="scores" className="text-xl font-semibold">
          {t("aggregate")}
        </h2>
        <p className="max-w-3xl leading-7 text-muted-foreground">{t("scope")}</p>
        <Link href="/methodology" className="resource-link">
          <BookOpen aria-hidden="true" />
          <span>{t("methodology")}</span>
        </Link>
        <div className="rounded-lg border bg-background">
          <Table>
            <caption className="sr-only">
              {t("aggregate")} · {id}
            </caption>
            <TableHeader>
              <TableRow>
                {[
                  l("model"),
                  l("effort"),
                  ...release.languages.map(languageName),
                  ...release.comparisons.flatMap((pair) => [
                    `${pair.baseline.toUpperCase()} − ${pair.language.toUpperCase()} · ${l("gapUnit")}`,
                    `${pair.baseline.toUpperCase()} − ${pair.language.toUpperCase()} · ${l("confidence")}`,
                  ]),
                ].map((label) => (
                  <TableHead key={label} scope="col">
                    {label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {release.aggregate.map((row) => (
                <TableRow key={`${row.transport}/${row.model}/${row.effort}`}>
                  <TableCell>
                    <span className="font-medium">{getModelPresentation(row).label}</span>
                    <br />
                    {getModelPresentation(row).ownerName}
                  </TableCell>
                  <TableCell>{l(row.effort)}</TableCell>
                  {row.scores.map((score) => (
                    <TableCell key={score.language} className="font-mono">
                      {percent(score.accuracy)}
                    </TableCell>
                  ))}
                  {row.comparisons.flatMap((pair) => [
                    <TableCell key={`gap:${pair.baseline}:${pair.language}`} className="font-mono">
                      {pp(pair.gapPp)}
                    </TableCell>,
                    <TableCell
                      key={`interval:${pair.baseline}:${pair.language}`}
                      className="font-mono"
                    >
                      [{pair.gapCi95.map(pp).join(", ")}]
                    </TableCell>,
                  ])}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
      <div className="document mt-12 max-w-none">
        <section>
          <h2>{t("repeatScores")}</h2>
          {release.aggregate.map((row) => (
            <div className="mb-8 space-y-2" key={`${row.transport}/${row.model}/${row.effort}`}>
              <h3 className="font-semibold">
                {getModelPresentation(row).label} · {l(row.effort)}
              </h3>
              {row.scores.map((score) => (
                <div key={score.language}>
                  <h4>{languageName(score.language)}</h4>
                  <p>{t("sample", { count: score.n, repeats: row.repeats })}</p>
                  <ul className="space-y-1 font-mono text-sm">
                    {score.repeatAccuracy.map((accuracy, i) => (
                      <li key={i}>
                        {t("repeat", { number: i + 1 })}: {percent(accuracy)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p>{t("counts", { refusals: row.refusals, unparseable: row.unparseable })}</p>
              <p>
                {t("costs", {
                  cost:
                    row.costUsd === null
                      ? t("unknownCost")
                      : new Intl.NumberFormat(locale, {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 4,
                        }).format(row.costUsd),
                })}
              </p>
            </div>
          ))}
        </section>
        <section>
          <h2>{t("config")}</h2>
          <p>
            {t("protocol")}: <code>{release.protocol}</code>
          </p>
          <p className="break-all">
            {t("revision")}: <code>{release.datasetRevision}</code>
          </p>
        </section>
        <section>
          <h2>{t("download")}</h2>
          <p>{t("audit")}</p>
          <ul className="mt-5 space-y-3">
            {["manifest.json", ...Object.keys(release.files)].map((filename) => (
              <li key={filename}>
                <a className="artifact-link" href={releaseAssetUrl(baseUrl, filename)}>
                  {filename}
                </a>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>{t("integrity")}</h2>
          <dl className="space-y-4 text-sm">
            {Object.entries(release.files).map(([filename, hash]) => (
              <div key={filename}>
                <dt className="font-medium">{filename}</dt>
                <dd className="mt-1 break-all font-mono text-muted-foreground">{hash}</dd>
              </div>
            ))}
          </dl>
        </section>
        <NextIntlClientProvider messages={{ Releases: getMessagesForLocale(locale).Releases }}>
          <ReleaseCitation
            citation={`${t("citationText", { dataset: release.dataset, id, date, protocol: release.protocol })} ${url}`}
            bibtex={releaseBibtex(release, url)}
            url={url}
            releaseId={id}
          />
        </NextIntlClientProvider>
      </div>
    </article>
  );
}
