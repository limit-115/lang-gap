import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { SiteDocument } from "@/shared/site-document";
import { isPreviewDeployment, siteUrl } from "@/shared/metadata";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Lang Gap", template: "%s · Lang Gap" },
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
  return <SiteDocument locale={locale}>{children}</SiteDocument>;
}
