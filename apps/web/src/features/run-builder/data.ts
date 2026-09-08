import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { datasetManifestSchema } from "@llang-gap/contracts";
import { describeRunDataset } from "@llang-gap/evaluation/run-catalog";

export async function getRunDatasets() {
  const root = resolve(process.cwd(), "../../datasets");
  const entries = await readdir(root, { withFileTypes: true });
  return Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(async (entry) => {
        const manifest = datasetManifestSchema.parse(
          JSON.parse(await readFile(resolve(root, entry.name, "manifest.json"), "utf8")),
        );
        if (manifest.id !== entry.name) throw new Error(`Dataset identity mismatch: ${entry.name}`);
        return describeRunDataset(manifest);
      }),
  );
}
