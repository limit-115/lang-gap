import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { FileArchive } from "lucide-react";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getMessagesForLocale } from "@/i18n/messages";
import { ReleaseDesigns } from "@/features/releases/release-designs";
import { routing } from "@/i18n/routing";
import { LinkSurface } from "@/shared/links/link";
import { isPreviewDeployment, pageMetadata } from "@/shared/metadata";
import { getReleaseSubmitters } from "@/features/releases/submissions";
import { getReleases } from "@/features/releases/data";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ design?: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Releases" });
  return {
    ...pageMetadata(locale, "/releases", t("metadataTitle"), t("intro")),
    robots: { index: !isPreviewDeployment && (await getReleases()).length > 0, follow: true },
  };
}
export default async function ReleasesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Releases");
  const releases = await getReleases();
  // Keep the selected board and comparison concepts local during design review.
  if (process.env.NODE_ENV === "development") {
    const query = await searchParams;
    const design = query.design ?? "board";
    if (design !== "original")
      return (
        <NextIntlClientProvider messages={{ Releases: getMessagesForLocale(locale).Releases }}>
          <ReleaseDesigns
            releases={releases}
            submitters={getReleaseSubmitters(releases)}
            showDesignPicker={query.design !== undefined}
            design={design === "desktop" || design === "board" ? design : "journal"}
          />
        </NextIntlClientProvider>
      );
  }
  return (
    <>
      <section className="intro">
        <h1>{t("title")}</h1>
        <p>{t("intro")}</p>
      </section>
      {releases.length ? (
        <ul className="release-list">
          {releases.map((r) => (
            <li key={r.id}>
              <LinkSurface
                href={`/releases/${r.id}`}
                kind="row"
                className="release-row rounded-lg border bg-background text-sm"
              >
                <FileArchive aria-hidden="true" />
                <strong>{r.id}</strong>
                <time dateTime={r.createdAt}>
                  {new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(
                    new Date(r.createdAt),
                  )}
                </time>
              </LinkSurface>
            </li>
          ))}
        </ul>
      ) : (
        <Empty className="mb-16 border border-solid bg-background py-16">
          <EmptyHeader className="max-w-lg">
            <EmptyTitle className="tracking-normal">
              <h2>{t("emptyTitle")}</h2>
            </EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}
    </>
  );
}
