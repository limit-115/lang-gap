import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "ru"],
  defaultLocale: "en",
  localePrefix: "always",
  localeDetection: true,
  // Canonical-origin alternates are supplied by page metadata and the sitemap.
  alternateLinks: false,
  localeCookie: { maxAge: 60 * 60 * 24 * 365 },
});
export type Locale = (typeof routing.locales)[number];
export type Dictionary<T> = { [K in keyof T]: T[K] extends string ? string : Dictionary<T[K]> };
