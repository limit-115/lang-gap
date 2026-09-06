import { cn } from "cn";
import { ExternalLink, Heart } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { BrandLogo } from "./brand-logo";

export async function SiteFooter() {
  const t = await getTranslations("Navigation");
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <Link className="brand" href="/" aria-label={t("home")}>
          <BrandLogo />
        </Link>
        <p className="footer-description">{t("footer")}</p>

        <div className="footer-actions">
          <a
            href="https://github.com/limit-115/llang-gap"
            target="_blank"
            rel="noopener noreferrer"
            data-slot="button"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-11 gap-2 rounded-xl bg-foreground px-4 text-background shadow-sm hover:bg-foreground/85 motion-reduce:transition-none",
            )}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden="true">
              <path d="M12 .75a11.25 11.25 0 0 0-3.558 21.923c.563.104.768-.244.768-.542 0-.267-.01-.975-.015-1.913-3.13.68-3.79-1.51-3.79-1.51-.512-1.3-1.25-1.646-1.25-1.646-1.022-.699.077-.685.077-.685 1.13.08 1.724 1.16 1.724 1.16 1.005 1.722 2.637 1.225 3.279.937.103-.728.393-1.225.715-1.507-2.498-.284-5.124-1.25-5.124-5.566 0-1.23.44-2.234 1.16-3.022-.116-.284-.503-1.43.11-2.98 0 0 .944-.302 3.094 1.155A10.79 10.79 0 0 1 12 6.175c.956.004 1.918.129 2.817.379 2.148-1.457 3.09-1.155 3.09-1.155.615 1.55.228 2.696.112 2.98.722.788 1.158 1.792 1.158 3.022 0 4.327-2.63 5.279-5.136 5.558.404.35.766 1.043.766 2.1 0 1.516-.014 2.74-.014 3.112 0 .3.203.65.774.54A11.252 11.252 0 0 0 12 .75Z" />
            </svg>
            GitHub
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
          <a
            href="https://t.me/dibenkobit"
            target="_blank"
            rel="noopener noreferrer"
            data-slot="button"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-11 gap-2.5 rounded-xl px-4 text-foreground shadow-sm motion-reduce:transition-none",
            )}
          >
            <Heart aria-hidden="true" className="size-4 fill-current" strokeWidth={1.5} />
            {t("becomeSponsor")}
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        </div>
        <nav aria-label={t("navigation")}>
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
        <p className="footer-attribution">
          {t.rich("attribution", {
            author: (chunks) => (
              <a
                href="https://github.com/limit-115"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground hover:underline underline-offset-4"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </div>
    </footer>
  );
}
