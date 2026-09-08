import type { DatasetManifest, DatasetSource } from "@llang-gap/contracts";

// Present historical single-partition files through the same loader interface,
// without rewriting the original manifests or their snapshot identities.
export function getDatasetSources(manifest: DatasetManifest): DatasetSource[] {
  if (manifest.schemaVersion === 3) return manifest.files;
  return manifest.files.map(({ language, split, rows, ...source }) => ({
    ...source,
    rows,
    partitions: [{ language, split, rows }],
  }));
}

export function sourceUrl(manifest: DatasetManifest, path: string): string {
  return manifest.schemaVersion === 3 && manifest.hosting === "github"
    ? `https://raw.githubusercontent.com/${manifest.repository}/${manifest.revision}/${path}`
    : `https://huggingface.co/datasets/${manifest.repository}/resolve/${manifest.revision}/${path}`;
}
