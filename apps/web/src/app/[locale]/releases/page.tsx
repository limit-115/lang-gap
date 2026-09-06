import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "../../../i18n/routing";
import { Link } from "../../../i18n/navigation";
import { pageMetadata } from "../../../shared/metadata";
import { getReleases } from "../../../features/releases/data";

type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Releases" });
  return pageMetadata(locale, "/releases", t("title"), t("intro"));
}
export default async function ReleasesPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Releases");
  const releases = await getReleases();
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
              <Link href={`/releases/${r.id}`}>
                <strong>{r.id}</strong>
                <time dateTime={r.createdAt}>
                  {new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(
                    new Date(r.createdAt),
                  )}
                </time>
                <span>↗</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty className="mb-16 border border-solid py-16">
          <EmptyHeader className="max-w-lg">
            <EmptyTitle className="tracking-normal">
              <h2>{t("emptyTitle")}</h2>
            </EmptyTitle>
            <EmptyDescription>
              <p>{t("emptyBody")}</p>
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </>
  );
}
