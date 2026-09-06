import type { MetadataRoute } from "next";
import { routing } from "../i18n/routing";
import { siteUrl } from "../shared/metadata";
import { getReleases } from "../features/releases/data";
export const dynamic = "force-static";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paths = [
    "",
    "/methodology",
    "/releases",
    ...(await getReleases()).map((r) => `/releases/${r.id}`),
  ];
  return paths.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: `${siteUrl}/${locale}${path}/`,
      alternates: { languages: { en: `${siteUrl}/en${path}/`, ru: `${siteUrl}/ru${path}/` } },
    })),
  );
}
