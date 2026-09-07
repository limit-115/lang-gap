import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";
import {
  datasetManifestSchema,
  questionSchema,
  type DatasetManifest,
  type Language,
  type Question,
} from "@llang-gap/contracts";

export const sha256 = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
export async function readManifest(path: string): Promise<DatasetManifest> {
  return datasetManifestSchema.parse(JSON.parse(await readFile(path, "utf8")));
}

export function normalizeRow(
  row: Record<string, unknown>,
  language: Language,
  split: Question["split"],
): Question {
  const options: string[] = [];
  let ended = false;
  for (let index = 0; index < 10; index++) {
    const value = row[`option_${index}`];
    if (value === null) {
      ended = true;
      continue;
    }
    if (ended || typeof value !== "string")
      throw new Error("Invalid or non-contiguous answer options");
    options.push(value);
  }
  if (
    typeof row.answer !== "string" ||
    row.answer.charCodeAt(0) - 65 !== Number(row.answer_index)
  ) {
    throw new Error("Answer letter / index mismatch");
  }
  if (typeof row.src !== "string") throw new Error("Missing question source");
  return questionSchema.parse({
    id: `${split}:${row.src}:${String(row.question_id_src)}`,
    sourceId: Number(row.question_id_src),
    language,
    split,
    category: row.category,
    question: row.question,
    options,
    answer: row.answer,
    cot: row.cot_content,
  });
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
    const sources = manifest.files.filter((file) => file.language === language);
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
  const languages = options.languages ?? [...new Set(manifest.files.map((file) => file.language))];
  for (const language of languages) {
    if (!manifest.files.some((file) => file.language === language && file.split === "test"))
      throw new Error(`Dataset ${manifest.id} does not support ${language}`);
  }
  const directory = join(
    cacheDir,
    manifest.id,
    manifest.revision,
    `normalizer-${manifest.normalizerVersion}`,
  );
  const questions: Question[] = [];
  for (const source of manifest.files.filter((file) => languages.includes(file.language))) {
    const path = join(directory, source.path);
    let bytes: Buffer;
    try {
      bytes = await readFile(path);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
      if (offline) throw new Error(`Dataset is not cached: ${source.path}`);
      const url = `https://huggingface.co/datasets/${manifest.repository}/resolve/${manifest.revision}/${source.path}`;
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
    const normalized = manifest.schemaVersion === 2 && manifest.format === "normalized-jsonl";
    const rows: Record<string, unknown>[] = normalized
      ? bytes
          .toString("utf8")
          .trimEnd()
          .split("\n")
          .map((line) => questionSchema.parse(JSON.parse(line)))
      : await parquetReadObjects({ file: await asyncBufferFromFile(path) });
    if (rows.length !== source.rows) throw new Error(`Unexpected row count: ${source.path}`);
    const decoded = rows.map((row) =>
      normalized ? questionSchema.parse(row) : normalizeRow(row, source.language, source.split),
    );
    if (decoded.some((q) => q.language !== source.language || q.split !== source.split))
      throw new Error(`Dataset source language/split mismatch: ${source.path}`);
    questions.push(...decoded);
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
