import { describe, expect, it } from "vitest";
import { normalizeRow, prepareDataset, readManifest, validateDataset } from "./index";
import { questions } from "@tests/fixtures";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("dataset alignment", () => {
  it("pairs tests by source identity, not row position", () => {
    expect(() => validateDataset([...questions].reverse(), 3)).not.toThrow();
  });
  it("detects missing rows, duplicate identities and shifted answer keys", () => {
    expect(() => validateDataset(questions.slice(1), 3)).toThrow();
    expect(() => validateDataset([...questions, questions[0]!], 3)).toThrow("Duplicate");
    expect(() =>
      validateDataset(
        questions.map((q) =>
          q.language === "ru" && q.split === "test" ? { ...q, answer: "A" } : q,
        ),
        3,
      ),
    ).toThrow("alignment");
  });
  it("never downloads when offline; corrupted cache fails before decoding", async () => {
    const root = await mkdtemp(join(tmpdir(), "llang-dataset-"));
    try {
      const manifest = await readManifest(
        new URL("../../../datasets/mmlu-prox-lite/manifest.json", import.meta.url).pathname,
      );
      await expect(prepareDataset({ manifest, cacheDir: root, offline: true })).rejects.toThrow(
        "not cached",
      );
      const directory = join(root, manifest.id, manifest.revision, "normalizer-1", "en");
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, "test-00000-of-00001.parquet"), "corrupted");
      await expect(prepareDataset({ manifest, cacheDir: root, offline: true })).rejects.toThrow(
        "Corrupted",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("rejects inconsistent source answer indices and gaps in options", () => {
    const row: Record<string, unknown> = {
      question_id_src: 1,
      src: "fixture",
      question: "Q",
      category: "math",
      answer: "B",
      answer_index: 0,
      cot_content: "",
    };
    for (let i = 0; i < 10; i++) row[`option_${i}`] = i < 4 ? String(i) : null;
    expect(() => normalizeRow(row, "en", "test")).toThrow("index");
    row.answer_index = 1;
    row.option_1 = null;
    expect(() => normalizeRow(row, "en", "test")).toThrow("contiguous");
  });
});
