import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/shared/metadata";

type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Methodology" });
  return pageMetadata(locale, "/methodology", t("title"), t("intro"));
}
export default async function MethodologyPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Methodology");
  return (
    <article className="document">
      <header className="intro">
        <h1>{t("title")}</h1>
        <p>{t("intro")}</p>
      </header>
      {(["protocol", "dataset", "score", "errors", "limits", "audit"] as const).map((key) => (
        <section key={key}>
          <h2>{t(`${key}Title`)}</h2>
          <p>{t(key)}</p>
          {key === "protocol" && <p>{t("adaptation")}</p>}
          {key === "score" && (
            <>
              <div className="formula">
                Δ = 100 × ({t("accuracy")}
                <sub>A</sub> − {t("accuracy")}
                <sub>B</sub>)
              </div>
              <p>{t("interval")}</p>
            </>
          )}
        </section>
      ))}
      <section>
        <h2>{t("sources")}</h2>
        <div className="source-links">
          <a href="https://github.com/limit-115/llang-gap/tree/main/datasets">
            {t("datasetLink")} ↗
          </a>
          <a href="https://github.com/limit-115/llang-gap/blob/main/docs/protocol.md">
            {t("harnessLink")} ↗
          </a>
        </div>
      </section>
    </article>
  );
}
