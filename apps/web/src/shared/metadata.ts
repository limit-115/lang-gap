import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";

export function resolveSiteUrl(value = "https://llang-gap-web.vercel.app") {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  ) {
    throw new Error("SITE_URL must be a public HTTPS origin without a path, query or credentials");
  }
  return url.origin;
}

export const siteUrl = resolveSiteUrl(process.env.SITE_URL);
export const isPreviewDeployment = process.env.VERCEL_ENV === "preview";

export function languageAlternates(path: string) {
  return {
    en: `${siteUrl}/en${path}/`,
    ru: `${siteUrl}/ru${path}/`,
    "x-default": `${siteUrl}/en${path}/`,
  };
}
export function pageMetadata(
  locale: Locale,
  path: string,
  title: string,
  description: string,
): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}${path}/`,
      languages: languageAlternates(path),
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: locale === "en" ? "en_US" : "ru_RU",
      alternateLocale: locale === "en" ? "ru_RU" : "en_US",
      url: `/${locale}${path}/`,
      siteName: "Llang Gap",
    },
    twitter: { card: "summary", title, description },
  };
}
