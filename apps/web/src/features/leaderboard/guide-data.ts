import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { guideIndexSchema, guideSnapshotSchema } from "@llang-gap/contracts/guide";
import { getReleases } from "@/features/releases/data";

const hash = (value: Buffer) => createHash("sha256").update(value).digest("hex");

export async function getModelGuide() {
  const root = resolve(process.cwd(), "../../results");
  let rawIndex: Buffer;
  try {
    rawIndex = await readFile(resolve(root, "guide/index.json"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" && (await getReleases()).length === 0)
      return null;
    throw error;
  }
  const index = guideIndexSchema.parse(JSON.parse(rawIndex.toString("utf8")));
  const id = process.env.LLANG_GUIDE_ID ?? index.latest;
  if (!id) return null;
  const entry = index.snapshots.find((value) => value.id === id);
  if (!entry) throw new Error(`Unpublished model guide: ${id}`);
  const content = await readFile(resolve(root, "guide", entry.id, "summary.json"));
  if (hash(content) !== entry.sha256) throw new Error("Model guide checksum mismatch");
  const guide = guideSnapshotSchema.parse(JSON.parse(content.toString("utf8")));
  if (guide.id !== id) throw new Error("Model guide ID mismatch");
  const releases = await getReleases();
  for (const source of guide.sources) {
    if (!releases.some((release) => release.id === source.releaseId))
      throw new Error("Unpublished model guide source");
    const directory = resolve(root, source.releaseId);
    if (hash(await readFile(resolve(directory, "manifest.json"))) !== source.manifestHash)
      throw new Error("Model guide source changed");
    if (
      source.evidenceHash !== null &&
      hash(await readFile(resolve(directory, "evidence.json"))) !== source.evidenceHash
    )
      throw new Error("Model guide evidence changed");
  }
  return guide;
}
