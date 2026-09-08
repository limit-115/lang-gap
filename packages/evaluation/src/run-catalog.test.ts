import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { datasetManifestSchema } from "@llang-gap/contracts";
import { runDatasetSchema } from "@llang-gap/contracts/run-catalog";
import { describeRunDataset } from "./run-catalog";

it("derives public setup metadata from the pinned manifest and adapters", async () => {
  const manifest = datasetManifestSchema.parse(
    JSON.parse(
      await readFile(
        new URL("../../../datasets/mmlu-prox-lite/manifest.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  if (manifest.schemaVersion === 3) throw new Error("Expected a historical manifest");
  const result = runDatasetSchema.parse(describeRunDataset(manifest));
  for (const { tag, questions } of result.languages)
    expect(questions).toBe(
      manifest.files
        .filter((file) => file.language === tag && file.split === "test")
        .reduce((sum, file) => sum + file.rows, 0),
    );
  expect(
    result.protocols.find((entry) => entry.id === "mmluprox-lite-5shot-author-api-v3"),
  ).toMatchObject({ tokenCap: 2048, requiresTokenCap: true });
  expect(
    result.protocols.find((entry) => entry.id === "mmluprox-lite-5shot-flexible-api-v1"),
  ).toMatchObject({ tokenCap: null, requiresTokenCap: false });
  expect(
    result.protocols.find((entry) => entry.id === "mmluprox-lite-5shot-native-reasoning-v1"),
  ).toMatchObject({ tokenCap: null, requiresTokenCap: true });
  expect(result.protocols.some((entry) => entry.id === "multiple-choice-v1")).toBe(false);
});

it.each([
  { id: "science-human", tags: ["ja", "de"] },
  { id: "history-machine", tags: ["zh-Hant"] },
])("counts v3 test partitions for $id independently of source rows", ({ id, tags }) => {
  const manifest = datasetManifestSchema.parse({
    schemaVersion: 3,
    id,
    repository: "fixtures/data",
    revision: "a".repeat(40),
    hosting: "github",
    normalizerVersion: 1,
    adapter: { format: "normalized-jsonl" },
    license: "MIT",
    source: "https://example.org",
    prompts: Object.fromEntries(
      tags.map((tag) => [
        tag,
        { instruction: "Choose.", question: "Question", options: "Options" },
      ]),
    ),
    files: [
      {
        path: "shared.jsonl",
        rows: 100,
        sha256: "b".repeat(64),
        partitions: [
          ...tags.map((language, i) => ({ language, split: "test", rows: 3 + i })),
          { language: tags[0], split: "validation", rows: 20 },
          { language: "fr", split: "validation", rows: 10 },
        ],
      },
      {
        path: "extra.jsonl",
        rows: 50,
        sha256: "c".repeat(64),
        partitions: [{ language: tags[0], split: "test", rows: 7 }],
      },
    ],
  });
  const result = runDatasetSchema.parse(describeRunDataset(manifest));
  expect(result.id).toBe(id);
  expect(result.languages).toEqual(
    tags.map((tag, i) => ({ tag, questions: i === 0 ? 10 : 3 + i })),
  );
  expect(result.protocols).toEqual([
    { id: "multiple-choice-v1", languages: tags, tokenCap: null, requiresTokenCap: false },
  ]);
});

it("sums shards, ignores validation rows and exposes only languages with reviewed prompts", () => {
  const file = { split: "test", rows: 4, sha256: "b".repeat(64) };
  const manifest = datasetManifestSchema.parse({
    schemaVersion: 2,
    id: "local-science",
    repository: "fixtures/data",
    revision: "a".repeat(40),
    normalizerVersion: 1,
    format: "normalized-jsonl",
    license: "MIT",
    source: "https://example.org",
    prompts: { ja: { instruction: "選ぶ", question: "質問", options: "選択肢" } },
    files: [
      { ...file, path: "ja-1.jsonl", language: "ja" },
      { ...file, path: "ja-2.jsonl", language: "ja" },
      { ...file, path: "de.jsonl", language: "de" },
      { ...file, path: "ja-validation.jsonl", language: "ja", split: "validation", rows: 20 },
    ],
  });
  const result = describeRunDataset(manifest);
  expect(result.languages).toEqual([
    { tag: "ja", questions: 8 },
    { tag: "de", questions: 4 },
  ]);
  expect(result.protocols).toEqual([
    { id: "multiple-choice-v1", languages: ["ja"], tokenCap: null, requiresTokenCap: false },
  ]);
});
