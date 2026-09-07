import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { aggregateSchema, releaseManifestSchema, safeIdSchema } from "@llang-gap/contracts";
import index from "@results/index.json";

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
      const aggregateFile = await readFile(
        resolve(process.cwd(), "../../results", id, "aggregate.json"),
      );
      if (
        createHash("sha256").update(aggregateFile).digest("hex") !== release.files["aggregate.json"]
      )
        throw new Error(`Aggregate checksum mismatch for ${id}`);
      const aggregate = aggregateSchema.array().parse(JSON.parse(aggregateFile.toString("utf8")));
      if (JSON.stringify(aggregate) !== JSON.stringify(release.aggregate))
        throw new Error(`Aggregate differs from manifest for ${id}`);
      return release;
    }),
  );
}
export async function getRelease(id: string) {
  if (!safeIdSchema.safeParse(id).success || !(index.releases as string[]).includes(id))
    return null;
  return (await getReleases()).find((release) => release.id === id) ?? null;
}

export async function getReleaseAssetsUrl(id: string) {
  if (!(await getRelease(id))) throw new Error(`Unpublished release: ${id}`);
  const assets: unknown = JSON.parse(
    await readFile(resolve(process.cwd(), "../../results", id, "assets.json"), "utf8"),
  );
  if (
    !assets ||
    typeof assets !== "object" ||
    !("baseUrl" in assets) ||
    typeof assets.baseUrl !== "string"
  )
    throw new Error(`Invalid release asset location for ${id}`);
  const url = new URL(assets.baseUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash)
    throw new Error(`Release assets require an HTTPS base URL for ${id}`);
  return url.href.replace(/\/$/, "");
}

export function releaseAssetUrl(baseUrl: string, filename: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(filename))
    throw new Error(`Invalid release filename: ${filename}`);
  return `${baseUrl}/${encodeURIComponent(filename)}`;
}
export async function getLatestRelease() {
  const id = process.env.LLANG_RELEASE_ID ?? index.latest;
  if (!id) return null;
  const releases = await getReleases();
  const release = releases.find((r) => r.id === id);
  if (!release) throw new Error(`Unpublished release: ${id}`);
  return release;
}
