import { BookOpen, Database, FileText } from "lucide-react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getLatestRelease, getReleaseAssetsUrl, releaseAssetUrl } from "@/features/releases/data";
import styles from "@/app/[locale]/link-options/preview.module.css";

export const metadata = {
  title: "Link options",
  robots: { index: false, follow: false },
};

const options = [
  { id: "minimal", title: "Minimal", description: "Quiet underlines. No icons." },
  { id: "soft", title: "Soft surfaces", description: "Compact links with an icon on the left." },
  { id: "rows", title: "Resource rows", description: "Structured lists with clear file formats." },
] as const;

export default async function LinkOptions({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ variant?: string }>;
}) {
  // A local design comparison, never a published navigation destination.
  if (process.env.NODE_ENV !== "development") notFound();
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const { variant } = await searchParams;
  const t = await getTranslations("Releases");
  const m = await getTranslations("Methodology");
  const release = await getLatestRelease();
  const baseUrl = release ? await getReleaseAssetsUrl(release.id) : null;
  const files = release ? ["manifest.json", ...Object.keys(release.files)] : [];
  const before = variant === "before";
  const visible = before
    ? [{ id: "before", title: "Current links", description: "The existing treatment." }]
    : options.filter((option) => !variant || option.id === variant);
  if (!visible.length) notFound();

  return (
    <div className={styles.preview}>
      <header className={styles.header}>
        <h1>Link options</h1>
        <nav className={styles.controls} aria-label="Link design options">
          <Link href="/link-options" aria-current={!variant ? "page" : undefined}>
            Compare all
          </Link>
          {options.map((option) => (
            <Link
              key={option.id}
              href={`/link-options?variant=${option.id}`}
              aria-current={variant === option.id ? "page" : undefined}
            >
              {option.title}
            </Link>
          ))}
          <Link href="/link-options?variant=before" aria-current={before ? "page" : undefined}>
            Before
          </Link>
        </nav>
      </header>
      <div className={`${styles.grid} ${visible.length === 1 ? styles.single : ""}`}>
        {visible.map((option) => (
          <article key={option.id} className={`${styles.option} ${styles[option.id] ?? ""}`}>
            <header className={styles.optionHeader}>
              <h2>{option.title}</h2>
              <p>{option.description}</p>
            </header>
            <div className={styles.sample}>
              <section className={styles.navigation}>
                <h3>{t("aggregate")}</h3>
                <Link href="/methodology" className={before ? "text-link" : styles.link}>
                  {option.id === "soft" && <BookOpen aria-hidden="true" />}
                  <span>
                    {t("methodology")}
                    {before && " ↗"}
                  </span>
                </Link>
              </section>
              <section>
                <h3>{m("sources")}</h3>
                <div className={before ? "source-links" : styles.sources}>
                  <a
                    className={before ? undefined : styles.link}
                    href="https://github.com/limit-115/llang-gap/tree/main/datasets"
                  >
                    {option.id === "soft" && <Database aria-hidden="true" />}
                    <span>
                      {m("datasetLink")}
                      {before && " ↗"}
                      {option.id === "rows" && <small>github.com / datasets</small>}
                    </span>
                  </a>
                  <a
                    className={before ? undefined : styles.link}
                    href="https://github.com/limit-115/llang-gap/blob/main/docs/protocol.md"
                  >
                    {option.id === "soft" && <BookOpen aria-hidden="true" />}
                    <span>
                      {m("harnessLink")}
                      {before && " ↗"}
                      {option.id === "rows" && <small>github.com / docs / protocol.md</small>}
                    </span>
                  </a>
                </div>
              </section>
              <section>
                <h3>{t("download")}</h3>
                <ul className={before ? "mt-5 space-y-3" : styles.files}>
                  {files.map((filename) => (
                    <li key={filename}>
                      <a
                        className={before ? "text-link break-all" : styles.link}
                        href={releaseAssetUrl(baseUrl!, filename)}
                      >
                        {option.id === "soft" && <FileText aria-hidden="true" />}
                        <span>
                          {filename}
                          {before && " ↗"}
                        </span>
                        {option.id === "rows" && (
                          <small aria-hidden="true">
                            {filename.split(".").at(-1)?.toUpperCase()}
                          </small>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
