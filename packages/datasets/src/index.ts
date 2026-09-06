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

export function validateDataset(questions: Question[], expectedTestCount = 588): void {
  const byLanguage = new Map<Language, Map<string, Question>>();
  for (const language of ["en", "ru"] as const) {
    const rows = questions.filter((q) => q.language === language);
    const map = new Map(rows.map((q) => [q.id, q]));
    if (map.size !== rows.length) throw new Error(`Duplicate ${language} question ID`);
    if (rows.filter((q) => q.split === "test").length !== expectedTestCount)
      throw new Error(`Unexpected ${language} test count`);
    const validation = rows.filter((q) => q.split === "validation");
    const categories = new Set(rows.map((q) => q.category));
    if (expectedTestCount === 588 && (validation.length !== 70 || categories.size !== 14))
      throw new Error("Expected 70 validation examples in 14 subjects");
    for (const category of categories) {
      if (validation.filter((q) => q.category === category).length !== 5)
        throw new Error(`Expected five validation examples: ${category}`);
    }
    byLanguage.set(language, map);
  }
  const en = byLanguage.get("en");
  const ru = byLanguage.get("ru");
  if (!en || !ru || en.size !== ru.size) throw new Error("Language sets differ");
  for (const [id, a] of en) {
    const b = ru.get(id);
    if (
      !b ||
      a.split !== b.split ||
      a.category !== b.category ||
      a.answer !== b.answer ||
      a.options.length !== b.options.length
    ) {
      throw new Error(`Language alignment mismatch: ${id}`);
    }
  }
  const testIds = new Set(questions.filter((q) => q.split === "test").map((q) => q.sourceId));
  if (questions.some((q) => q.split === "validation" && testIds.has(q.sourceId)))
    throw new Error("Test / validation source ID overlap");
}

export async function prepareDataset(options: {
  manifest: DatasetManifest;
  cacheDir: string;
  offline?: boolean;
}): Promise<{ questions: Question[]; directory: string; hash: string }> {
  const { manifest, cacheDir, offline = false } = options;
  const directory = join(
    cacheDir,
    manifest.id,
    manifest.revision,
    `normalizer-${manifest.normalizerVersion}`,
  );
  const questions: Question[] = [];
  for (const source of manifest.files) {
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
    const rows = await parquetReadObjects({ file: await asyncBufferFromFile(path) });
    if (rows.length !== source.rows) throw new Error(`Unexpected row count: ${source.path}`);
    questions.push(...rows.map((row) => normalizeRow(row, source.language, source.split)));
  }
  validateDataset(questions);
  const normalized = `${questions.map((q) => JSON.stringify(q)).join("\n")}\n`;
  const temporary = join(directory, `normalized.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, normalized);
    await rename(temporary, join(directory, "normalized.jsonl"));
  } finally {
    await rm(temporary, { force: true });
  }
  return { questions, directory, hash: sha256(normalized) };
}
