import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getTranslations } from "next-intl/server";
import { getMessagesForLocale } from "@/i18n/messages";
import type { Locale } from "@/i18n/routing";
import { SiteHeader } from "@/shared/navigation/site-header";
import { SiteFooter } from "@/shared/navigation/site-footer";
import { NavigationProvider } from "@/shared/navigation/navigation-provider";
import { ThemeProvider } from "@/shared/theme-provider";
import { PageTransition } from "@/shared/page-transition";
import { SiteBackground } from "@/shared/site-background";
import "@/app/globals.css";

export async function SiteDocument({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: Locale;
}) {
  const t = await getTranslations({ locale, namespace: "Navigation" });
  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <SiteBackground />
        <ThemeProvider>
          <NavigationProvider
            locale={locale}
            timeZone="UTC"
            messages={{ Navigation: getMessagesForLocale(locale).Navigation }}
          >
            <a className="skip-link" href="#main">
              {t("skip")}
            </a>
            <SiteHeader />
            <main id="main" className="page-shell">
              <PageTransition>{children}</PageTransition>
            </main>
            <SiteFooter locale={locale} />
          </NavigationProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
