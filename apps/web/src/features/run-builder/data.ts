import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { readRunDataset } from "@llang-gap/evaluation/run-catalog";

export async function getRunDatasets() {
  const root = resolve(process.cwd(), "../../datasets");
  const entries = await readdir(root, { withFileTypes: true });
  return Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((entry) => readRunDataset(resolve(root, entry.name))),
  );
}
