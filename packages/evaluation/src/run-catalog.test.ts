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
