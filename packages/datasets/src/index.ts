import { getLogger } from "@logtape/logtape";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  datasetManifestSchema,
  type DatasetManifest,
  type Language,
  type Question,
} from "@llang-gap/contracts";

import { decodeSource } from "#src/adapters/index";
import { getDatasetSources, sourceUrl } from "./manifest";
export { getDatasetSources } from "./manifest";
export { normalizeRow } from "#src/adapters/mmluprox";

export const sha256 = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
export async function readManifest(path: string): Promise<DatasetManifest> {
  return datasetManifestSchema.parse(JSON.parse(await readFile(path, "utf8")));
}

export function validateDataset(
  questions: readonly Question[],
  expectedTestCount?: number,
  languages = [...new Set(questions.map((q) => q.language))],
): void {
  if (!languages.length) throw new Error("Empty dataset language selection");
  for (const language of languages) {
    const rows = questions.filter((q) => q.language === language);
    const keys = new Set(rows.map((q) => `${q.split}/${q.id}`));
    if (keys.size !== rows.length) throw new Error(`Duplicate ${language} question ID`);
    const test = rows.filter((q) => q.split === "test");
    if (!test.length || (expectedTestCount !== undefined && test.length !== expectedTestCount))
      throw new Error(`Unexpected ${language} test count`);
    const testIds = new Set(test.map((q) => q.id));
    const testSourceIds = new Set(test.map((q) => q.sourceId));
    if (
      rows.some(
        (q) => q.split === "validation" && (testIds.has(q.id) || testSourceIds.has(q.sourceId)),
      )
    )
      throw new Error("Test / validation question ID overlap");
  }
}

// Alignment is a property of an explicitly requested comparison, not of every dataset.
export function validateAlignment(
  questions: readonly Question[],
  baseline: Language,
  language: Language,
): void {
  const first = questions.filter((q) => q.language === baseline && q.split === "test");
  const second = new Map(
    questions.filter((q) => q.language === language && q.split === "test").map((q) => [q.id, q]),
  );
  if (!first.length || first.length !== second.size)
    throw new Error("Language alignment sets differ");
  for (const a of first) {
    const b = second.get(a.id);
    if (
      !b ||
      a.category !== b.category ||
      a.answer !== b.answer ||
      a.options.length !== b.options.length
    )
      throw new Error(`Language alignment mismatch: ${a.id}`);
  }
}

export function validateManifestQuestions(
  questions: readonly Question[],
  manifest: DatasetManifest,
  languages: readonly Language[],
) {
  validateDataset(questions, undefined, [...languages]);
  for (const language of languages) {
    const sources = getDatasetSources(manifest)
      .flatMap((file) => file.partitions)
      .filter((partition) => partition.language === language);
    if (!sources.some((file) => file.split === "test"))
      throw new Error(`Dataset ${manifest.id} does not support ${language}`);
    for (const split of ["test", "validation"] as const) {
      const expected = sources
        .filter((file) => file.split === split)
        .reduce((sum, file) => sum + file.rows, 0);
      if (questions.filter((q) => q.language === language && q.split === split).length !== expected)
        throw new Error(`Dataset manifest row count mismatch: ${language}/${split}`);
    }
  }
  if (questions.some((q) => !languages.includes(q.language)))
    throw new Error("Unselected dataset language");
}

export async function prepareDataset(options: {
  manifest: DatasetManifest;
  cacheDir: string;
  offline?: boolean;
  languages?: readonly Language[];
}): Promise<{ questions: Question[]; directory: string; hash: string }> {
  const { manifest, cacheDir, offline = false } = options;
  const log = getLogger(["llang-gap", "datasets"]).with({ dataset: manifest.id });
  const sources = getDatasetSources(manifest);
  const partitions = sources.flatMap((source) => source.partitions);
  const languages = options.languages ?? [
    ...new Set(partitions.map((partition) => partition.language)),
  ];
  if (!languages.length || new Set(languages).size !== languages.length)
    throw new Error("Expected a nonempty, unique dataset language selection");
  for (const language of languages) {
    if (
      !partitions.some((partition) => partition.language === language && partition.split === "test")
    )
      throw new Error(`Dataset ${manifest.id} does not support ${language}`);
  }
  const directory = join(
    cacheDir,
    manifest.id,
    manifest.revision,
    `normalizer-${manifest.normalizerVersion}`,
  );
  const questions: Question[] = [];
  for (const source of sources.filter((file) =>
    file.partitions.some((partition) => languages.includes(partition.language)),
  )) {
    const path = join(directory, source.path);
    log.debug("Verifying source {source}", {
      event: "dataset.source",
      source: source.path,
    });
    let bytes: Buffer;
    try {
      bytes = await readFile(path);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
      if (offline) throw new Error(`Dataset is not cached: ${source.path}`);
      const url = sourceUrl(manifest, source.path);
      log.info("Downloading {source}", {
        event: "dataset.download",
        source: source.path,
      });
      const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`Dataset download failed: HTTP ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      if (sha256(bytes) !== source.sha256) throw new Error(`Checksum mismatch: ${source.path}`);
      await mkdir(dirname(path), { recursive: true });
      const temporary = `${path}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, bytes, { flag: "wx" });
        await rename(temporary, path);
      } finally {
        await rm(temporary, { force: true });
      }
    }
    if (sha256(bytes) !== source.sha256) throw new Error(`Corrupted dataset cache: ${source.path}`);
    const decoded = await decodeSource(manifest, source, bytes);
    if (decoded.rowCount !== source.rows) throw new Error(`Unexpected row count: ${source.path}`);
    for (const partition of source.partitions) {
      if (
        decoded.questions.filter(
          (q) => q.language === partition.language && q.split === partition.split,
        ).length !== partition.rows
      )
        throw new Error(
          `Dataset source partition row count mismatch: ${source.path}/${partition.language}/${partition.split}`,
        );
    }
    if (
      decoded.questions.some(
        (q) =>
          !source.partitions.some(
            (partition) => partition.language === q.language && partition.split === q.split,
          ),
      )
    )
      throw new Error(`Dataset source language/split mismatch: ${source.path}`);
    questions.push(...decoded.questions.filter((q) => languages.includes(q.language)));
    log.debug("Verified {source} · {rows} rows · {bytes} bytes", {
      event: "dataset.verified",
      source: source.path,
      rows: decoded.questions.length,
      bytes: bytes.length,
    });
  }
  validateManifestQuestions(questions, manifest, languages);
  const normalized = `${questions.map((q) => JSON.stringify(q)).join("\n")}\n`;
  const temporary = join(directory, `normalized.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, normalized);
    await rename(
      temporary,
      join(
        directory,
        `normalized-${sha256(JSON.stringify([...languages].sort())).slice(0, 16)}.jsonl`,
      ),
    );
  } finally {
    await rm(temporary, { force: true });
  }
  return { questions, directory, hash: sha256(normalized) };
}
