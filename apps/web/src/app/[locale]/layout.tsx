import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getMessagesForLocale } from "@/i18n/messages";
import { SiteHeader } from "@/shared/navigation/site-header";
import { SiteFooter } from "@/shared/navigation/site-footer";
import { siteUrl } from "@/shared/metadata";
import "@/app/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Llang Gap", template: "%s · Llang Gap" },
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
    <html lang={locale}>
      <body>
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
      </body>
    </html>
  );
}
