import { getTranslations } from "next-intl/server";
import { Link } from "../../i18n/navigation";

export async function SiteFooter() {
  const t = await getTranslations("Navigation");
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <Link className="brand" href="/" aria-label={t("home")}>
            Llang Gap<span className="brand-period">.</span>
          </Link>
          <p>{t("footer")}</p>
        </div>
        <nav aria-label={t("navigation")}>
          <h2>{t("navigation")}</h2>
          <ul>
            <li>
              <Link href="/">{t("leaderboard")}</Link>
            </li>
            <li>
              <Link href="/methodology">{t("methodology")}</Link>
            </li>
            <li>
              <Link href="/releases">{t("releases")}</Link>
            </li>
          </ul>
        </nav>
        <nav aria-label={t("resources")}>
          <h2>{t("resources")}</h2>
          <ul>
            <li>
              <a href="https://github.com/limit-115/llang-gap">{t("sourceCode")}</a>
            </li>
            <li>
              <a href="https://github.com/limit-115/llang-gap#readme">{t("documentation")}</a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="footer-bottom">{t("open")}</div>
    </footer>
  );
}
