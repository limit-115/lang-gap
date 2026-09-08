import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { datasetManifestSchema } from "@llang-gap/contracts";
import { describeRunDataset } from "@llang-gap/evaluation/run-catalog";
import { buildRun, initialSettings, shellQuote, type RunSettings } from "./config";

function dataset(id: string, tags = ["de", "ja"]) {
  return describeRunDataset(
    datasetManifestSchema.parse({
      schemaVersion: 2,
      normalizerVersion: 1,
      format: "normalized-jsonl",
      id,
      repository: "fixtures/questions",
      revision: "a".repeat(40),
      license: "MIT",
      source: "https://example.org/fixture",
      prompts: Object.fromEntries(
        tags.map((tag) => [
          tag,
          { instruction: "Choose.", question: "Question", options: "Options" },
        ]),
      ),
      files: tags.map((language, i) => ({
        path: `${language}.jsonl`,
        language,
        split: "test",
        rows: i ? 3 : 7,
        sha256: "b".repeat(64),
      })),
    }),
  );
}
const datasets = [dataset("science"), dataset("history", ["fr", "zh-Hant"])];
const settings: RunSettings = {
  ...initialSettings,
  dataset: "science",
  protocol: "multiple-choice-v1",
  languages: ["de", "ja"],
  transport: "fake",
  models: "one, two",
  efforts: ["low", "high"],
  repeats: "2",
  questionLimit: "5",
};

it("counts unequal language splits, models, efforts and repeats without assuming a dataset or pair", () => {
  const result = buildRun(settings, datasets);
  expect(result.errors).toEqual({});
  expect(result.requests).toBe((5 + 3) * 2 * 2 * 2);
  expect(result.experiment?.comparisons).toEqual([]);
  expect(result.command).not.toContain("--compare");
  const single = buildRun(
    { ...settings, dataset: "history", languages: ["zh-Hant"], scope: "all" },
    datasets,
  );
  expect(single.requests).toBe(3 * 2 * 2 * 2);
  expect(single.command).toContain("--dataset=history");
  expect(single.command).not.toContain("--question-limit");
  expect(single.command).not.toContain("--max-output-tokens");
});

it("never offers a stale command for incomplete or incompatible inputs", () => {
  expect(buildRun(initialSettings, datasets).command).toBeNull();
  for (const patch of [
    { languages: [] },
    { languages: ["en"] },
    { efforts: [] },
    { models: "same,same" },
    { dataset: "unknown" },
    { protocol: "mmluprox-lite-5shot-author-api-v3" },
    { transport: "openrouter" as const, models: "missing-owner" },
    { maxOutputTokens: "255" },
    { models: "$(touch /tmp/unexpected)" },
    { id: "../escape" },
    { repeats: "11" },
    { repeats: "1.5" },
    { concurrency: "33" },
    { seed: "0" },
    { maxAttempts: "6" },
    { timeoutMs: "999" },
    { maxJobs: "0" },
    { maxJobs: "2.5" },
    { questionLimit: "" },
    { comparisons: "de:de" },
    { comparisons: "de:fr" },
    { comparisons: "de:ja,de:ja" },
    { comparisons: "de:ja:fr" },
  ])
    expect(buildRun({ ...settings, ...patch }, datasets).command, JSON.stringify(patch)).toBeNull();
});

it("keeps planning free of dispatch-only options and reports the entire experiment when pausing", () => {
  const result = buildRun(
    { ...settings, offline: true, maxJobs: "2", comparisons: "ja:de" },
    datasets,
  );
  expect(result.command).toContain("--max-jobs=2");
  expect(result.plan).toContain("pnpm bench plan");
  expect(result.plan).toContain("--offline");
  expect(result.plan).not.toContain("--max-jobs");
  expect(result.command).toContain("--compare=ja:de");
  expect(result.requests).toBe(64);
});

it("enforces provider and protocol cap requirements", () => {
  expect(buildRun({ ...settings, transport: "anthropic" }, datasets).errors.maxOutputTokens).toBe(
    "capRequired",
  );
  expect(
    buildRun({ ...settings, transport: "anthropic", maxOutputTokens: "4096" }, datasets).command,
  ).toContain("--max-output-tokens=4096");
  const pinned = {
    ...datasets[0]!,
    protocols: [
      {
        id: "mmluprox-lite-5shot-author-api-v3" as const,
        languages: ["de"],
        tokenCap: 2048,
        requiresTokenCap: true,
      },
    ],
  };
  const selected = { ...settings, languages: ["de"], protocol: pinned.protocols[0]!.id };
  expect(buildRun(selected, [pinned]).errors.maxOutputTokens).toBe("capFixed");
  expect(buildRun({ ...selected, maxOutputTokens: "4096" }, [pinned]).command).toBeNull();
  expect(buildRun({ ...selected, maxOutputTokens: "2048" }, [pinned]).command).toContain(
    "--max-output-tokens=2048",
  );
});

const priced: RunSettings = {
  ...settings,
  pricing: true,
  pricingAsOf: "2026-09-08",
  pricingSource: "https://example.org/prices?plan=a&currency=usd",
  inputPerMillion: "1",
  cachedInputPerMillion: "0",
  cacheWritePerMillion: "0",
  cacheWrite1hPerMillion: "0",
  outputPerMillion: "2",
  budgetUsd: "0",
  maxOutputTokens: "1024",
  id: "custom",
  seed: "7",
  concurrency: "3",
  maxAttempts: "5",
  timeoutMs: "60000",
};

it("requires complete rates and bounded paid output for a budget, preserving zero values", () => {
  expect(buildRun({ ...settings, budgetUsd: "20" }, datasets).errors.budgetUsd).toBe(
    "budgetNeedsRates",
  );
  expect(buildRun({ ...priced, maxOutputTokens: "" }, datasets).errors.budgetUsd).toBe(
    "budgetNeedsRates",
  );
  expect(buildRun({ ...priced, cachedInputPerMillion: "" }, datasets).command).toBeNull();
  expect(
    buildRun({ ...priced, maxOutputTokens: "", outputPerMillion: "0" }, datasets).command,
  ).not.toBeNull();
  const result = buildRun(priced, datasets);
  expect(result.command).toContain("--budget-usd=0");
  expect(result.command).toContain("--cache-write1h-per-million=0");
  expect(result.command).toContain("--seed=7");
  expect(result.command).toContain("--timeout-ms=60000");
});

describe("POSIX shell output", () => {
  // Execute only a fixed argument-printing program; no benchmark or provider runs here.
  const argv = (value: string) =>
    JSON.parse(
      execFileSync(
        "/bin/sh",
        [
          "-c",
          `exec "$1" -e 'process.stdout.write(JSON.stringify(process.argv.slice(1)))' -- ${value}`,
          "test",
          process.execPath,
        ],
        { encoding: "utf8" },
      ),
    ) as string[];
  it("preserves metacharacters, quotes and newlines as data", () => {
    const text = "https://example.org/?q='&x=$(printf INJECTED)&y=`printf INJECTED`\nnext";
    expect(argv(shellQuote(text))).toEqual([text]);
  });
  it("produces complete flag arguments, including a URL with shell metacharacters", () => {
    const result = buildRun(priced, datasets);
    const args = argv(result.command!.replace("pnpm bench run", ""));
    expect(args).toContain(`--pricing-source=${priced.pricingSource}`);
    expect(args).toContain("--languages=de,ja");
    expect(args).toContain("--models=one,two");
  });
});
