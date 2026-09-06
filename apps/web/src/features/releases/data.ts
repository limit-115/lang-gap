import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { releaseManifestSchema, safeIdSchema } from "@llang-gap/contracts";
import index from "../../../../../results/index.json";

export async function getReleases() {
  return Promise.all(
    (index.releases as string[]).map(async (id) => {
      safeIdSchema.parse(id);
      const release = releaseManifestSchema.parse(
        JSON.parse(
          await readFile(resolve(process.cwd(), "../../results", id, "manifest.json"), "utf8"),
        ),
      );
      if (release.kind !== "benchmark" || release.id !== id)
        throw new Error(`Invalid public release ${id}`);
      return release;
    }),
  );
}
export async function getLatestRelease() {
  const id = process.env.LLANG_RELEASE_ID ?? index.latest;
  if (!id) return null;
  const releases = await getReleases();
  const release = releases.find((r) => r.id === id);
  if (!release) throw new Error(`Unpublished release: ${id}`);
  return release;
}
