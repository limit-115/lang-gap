import { protocolIdSchema, type DatasetManifest } from "@llang-gap/contracts";
import type { RunDataset } from "@llang-gap/contracts/run-catalog";
import { getMaxOutputTokens, validateProtocolDataset, protocolV1 } from "./prompts";

export function describeRunDataset(manifest: DatasetManifest): RunDataset {
  const counts = new Map<string, number>();
  for (const file of manifest.files) {
    if (file.split === "test")
      counts.set(file.language, (counts.get(file.language) ?? 0) + file.rows);
  }
  const languages = [...counts].map(([tag, questions]) => ({ tag, questions }));
  const protocols = protocolIdSchema.options.flatMap((id) => {
    const supported = languages
      .filter(({ tag }) => {
        try {
          validateProtocolDataset(id, manifest.id, [tag], manifest);
          return true;
        } catch {
          return false;
        }
      })
      .map(({ tag }) => tag);
    if (!supported.length) return [];
    const tokenCap = getMaxOutputTokens(id) ?? null;
    return [
      {
        id,
        languages: supported,
        tokenCap,
        requiresTokenCap: tokenCap !== null || id === protocolV1.id,
      },
    ];
  });
  return { id: manifest.id, languages, protocols };
}
