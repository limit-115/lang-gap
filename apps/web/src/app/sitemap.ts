import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { isPreviewDeployment, languageAlternates, siteUrl } from "@/shared/metadata";
import { getReleases } from "@/features/releases/data";
import { modelGuideHref } from "@/features/leaderboard/table-state";
import { getModelGuide } from "@/features/leaderboard/guide-data";
export const dynamic = "force-static";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isPreviewDeployment) return [];
  const releases = await getReleases();
  const guide = await getModelGuide();
  const paths = [
    "",
    "/methodology",
    "/run",
    ...(releases.length ? ["/releases"] : []),
    ...releases.map((r) => `/releases/${r.id}`),
    ...new Set(releases.flatMap((release) => release.aggregate.map(modelGuideHref))),
    ...(guide?.plan.schemaVersion === 2
      ? guide.languages.map((language) => `/languages/${encodeURIComponent(language)}`)
      : []),
  ];
  return paths.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: `${siteUrl}/${locale}${path}/`,
      alternates: { languages: languageAlternates(path) },
    })),
  );
}
