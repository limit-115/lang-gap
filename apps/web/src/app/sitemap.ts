import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { isPreviewDeployment, languageAlternates, siteUrl } from "@/shared/metadata";
import { getReleases } from "@/features/releases/data";
export const dynamic = "force-static";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isPreviewDeployment) return [];
  const releases = await getReleases();
  const paths = [
    "",
    "/methodology",
    "/run",
    ...(releases.length ? ["/releases"] : []),
    ...releases.map((r) => `/releases/${r.id}`),
  ];
  return paths.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: `${siteUrl}/${locale}${path}/`,
      alternates: { languages: languageAlternates(path) },
    })),
  );
}
