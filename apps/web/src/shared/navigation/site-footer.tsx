import { Heart } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BrandLink, ButtonLink, NavLink, TextLink } from "@/shared/links/link";
import type { Locale } from "@/i18n/routing";
import { BrandLogo } from "./brand-logo";

export async function SiteFooter({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "Navigation" });
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <BrandLink href="/" locale={locale} aria-label={t("home")}>
          <BrandLogo />
        </BrandLink>
        <p className="footer-description">{t("footer")}</p>

        <div className="footer-actions">
          <TextLink layout="standalone" href="https://github.com/limit-115/llang-gap" newTab>
            GitHub
          </TextLink>
          <ButtonLink href="https://t.me/dibenkobit" variant="outline" size="lg" newTab>
            <Heart aria-hidden="true" className="size-4 fill-current" strokeWidth={1.5} />
            {t("becomeSponsor")}
          </ButtonLink>
        </div>
        <nav aria-label={t("navigation")}>
          <ul>
            <li>
              <NavLink href="/" locale={locale}>
                {t("leaderboard")}
              </NavLink>
            </li>
            <li>
              <NavLink href="/methodology" locale={locale}>
                {t("methodology")}
              </NavLink>
            </li>
            <li>
              <NavLink href="/releases" locale={locale}>
                {t("releases")}
              </NavLink>
            </li>
          </ul>
        </nav>
        <p className="footer-attribution">
          {t.rich("attribution", {
            author: (chunks) => (
              <TextLink href="https://github.com/limit-115" newTab>
                {chunks}
              </TextLink>
            ),
          })}
        </p>
      </div>
    </footer>
  );
}
