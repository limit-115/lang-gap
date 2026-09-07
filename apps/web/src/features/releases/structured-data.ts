import type { ReleaseManifest } from "@llang-gap/contracts";
import type { Locale } from "@/i18n/routing";
import { siteUrl } from "@/shared/metadata";
import { releaseAssetUrl } from "./data";

export function releaseStructuredData(
  release: ReleaseManifest,
  baseUrl: string,
  locale: Locale,
  description: string,
) {
  if (release.kind !== "benchmark") throw new Error("Only published benchmarks describe datasets");
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": `${siteUrl}/en/releases/${release.id}/#dataset`,
    url: `${siteUrl}/${locale}/releases/${release.id}/`,
    name: `Llang Gap: ${release.dataset} · ${release.id}`,
    description,
    identifier: release.id,
    version: release.id,
    dateCreated: release.createdAt,
    inLanguage: release.languages,
    creator: { "@type": "Organization", name: "Limit 115", url: "https://github.com/limit-115" },
    measurementTechnique: release.protocol,
    isAccessibleForFree: true,
    distribution: (["aggregate.json", "aggregate.csv"] as const)
      .filter((filename) => filename in release.files)
      .map((filename) => ({
        "@type": "DataDownload",
        name: filename,
        encodingFormat: filename.endsWith(".csv") ? "text/csv" : "application/json",
        contentUrl: releaseAssetUrl(baseUrl, filename),
      })),
  };
}
