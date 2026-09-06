import type { Metadata } from "next";
import type { Locale } from "../i18n/routing";

export const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
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
      languages: { en: `/en${path}/`, ru: `/ru${path}/`, "x-default": `/en${path}/` },
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: locale === "en" ? "en_US" : "ru_RU",
      url: `/${locale}${path}/`,
      siteName: "Llang Gap",
    },
    twitter: { card: "summary", title, description },
  };
}
