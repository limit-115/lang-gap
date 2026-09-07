import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getMessagesForLocale } from "@/i18n/messages";
import { SiteHeader } from "@/shared/navigation/site-header";
import { SiteFooter } from "@/shared/navigation/site-footer";
import { ThemeProvider } from "@/shared/theme-provider";
import { SiteBackground } from "@/shared/site-background";
import { isPreviewDeployment, siteUrl } from "@/shared/metadata";
import "@/app/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Llang Gap", template: "%s · Llang Gap" },
  robots: { index: !isPreviewDeployment, follow: true },
};
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Navigation");
  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <SiteBackground />
        <ThemeProvider>
          <NextIntlClientProvider
            locale={locale}
            messages={{ Navigation: getMessagesForLocale(locale).Navigation }}
          >
            <a className="skip-link" href="#main">
              {t("skip")}
            </a>
            <SiteHeader />
            <main id="main" className="page-shell">
              {children}
            </main>
            <SiteFooter />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
