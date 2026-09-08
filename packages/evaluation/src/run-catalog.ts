import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { datasetManifestSchema, type DatasetManifest } from "@llang-gap/contracts";
import {
  datasetProtocolsSchema,
  type DatasetProtocols,
  type RunDataset,
} from "@llang-gap/contracts/run-catalog";
import { getProtocolAdapter } from "#src/protocols/index";
import { getMaxOutputTokens, validateProtocolDataset } from "./prompts";

export async function readDatasetProtocols(directory: string): Promise<DatasetProtocols> {
  return datasetProtocolsSchema.parse(
    JSON.parse(await readFile(join(directory, "protocols.json"), "utf8")),
  );
}

export function describeRunDataset(
  manifest: DatasetManifest,
  selection: DatasetProtocols,
): RunDataset {
  const registration = datasetProtocolsSchema.parse(selection);
  const counts = new Map<string, number>();
  for (const file of manifest.files) {
    const partitions = "partitions" in file ? file.partitions : [file];
    for (const { language, split, rows } of partitions) {
      if (split === "test") counts.set(language, (counts.get(language) ?? 0) + rows);
    }
  }
  const languages = [...counts].map(([tag, questions]) => ({ tag, questions }));
  const protocols = registration.protocols.map((id) => {
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
    if (!supported.length)
      throw new Error(`Protocol ${id} has no supported test languages for dataset ${manifest.id}`);
    const tokenCap = getMaxOutputTokens(id) ?? null;
    return {
      id,
      languages: supported,
      tokenCap,
      requiresTokenCap: getProtocolAdapter(id).tokenPolicy.required,
    };
  });
  return {
    id: manifest.id,
    recommendedProtocol: registration.recommendedProtocol,
    languages,
    protocols,
  };
}

export async function readRunDataset(directory: string): Promise<RunDataset> {
  const manifest = datasetManifestSchema.parse(
    JSON.parse(await readFile(join(directory, "manifest.json"), "utf8")),
  );
  if (manifest.id !== basename(directory))
    throw new Error(`Dataset identity mismatch: ${basename(directory)}`);
  return describeRunDataset(manifest, await readDatasetProtocols(directory));
}
