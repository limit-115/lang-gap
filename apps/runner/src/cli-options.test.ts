import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { stringify } from "yaml";
import { experiment, questions } from "@tests/fixtures";
import type { Experiment } from "@llang-gap/contracts";
import { experimentOptions } from "./cli-options";
import { resolveExperiment } from "./config";
import { createJobs, summarizePlan } from "./plan";

async function configure(args: string[]) {
  let result: Experiment | undefined;
  await experimentOptions()
    .exitOverride()
    .action(async (path, options) => {
      result = await resolveExperiment(path, options);
    })
    .parseAsync(args, { from: "user" });
  if (!result) throw new Error("Command did not resolve an experiment");
  return result;
}
const flags = [
  "--dataset",
  "mmlu-prox-lite",
  "--protocol",
  "mmluprox-lite-5shot-flexible-api-v1",
  "--transport",
  "openrouter",
];

it.each(
  [
    [
      "--models=fixtures/one:free,fixtures/two,fixtures/three",
      "--languages=ru,en",
      "--efforts=low,medium,high,xhigh,max",
    ],
    [
      "--models",
      "fixtures/one:free",
      "fixtures/two",
      "fixtures/three",
      "--languages",
      "ru",
      "en",
      "--efforts",
      "low",
      "medium",
      "high",
      "xhigh",
      "max",
    ],
    [
      "--models",
      "fixtures/one:free,fixtures/two",
      "fixtures/three",
      "--languages",
      "ru en",
      "--efforts",
      "low,medium",
      "high xhigh max",
    ],
  ].map((args) => [args]),
)("expands CLI-only lists and limits unique questions before conditions: %j", async (lists) => {
  const config = await configure([...flags, ...lists, "--question-limit", "2", "--repeats", "3"]);
  expect(config.comparisons).toEqual([]);
  expect(config.models).toHaveLength(3);
  expect(
    config.models.every((model) => model.pricing === undefined && model.maxOutputTokens === null),
  ).toBe(true);
  const jobs = createJobs(config, questions, "cli");
  expect(jobs).toHaveLength(2 * 2 * 3 * 5 * 3);
  expect(summarizePlan(config, jobs)).toMatchObject({
    questionsPerLanguage: { en: 2, ru: 2 },
    requests: 180,
    upperBoundUsdAllAttempts: null,
  });
});

it("overrides YAML before validation and records execution flags in the resolved settings", async () => {
  const root = await mkdtemp(join(tmpdir(), "llang-config-"));
  try {
    const path = join(root, "experiment.yaml");
    await writeFile(
      path,
      stringify({
        ...experiment,
        execution: { ...experiment.execution, budgetUsd: 5 },
        models: [{ ...experiment.models[0], efforts: ["obsolete"] }],
      }),
    );
    const config = await configure([
      path,
      "--id",
      "overridden",
      "--language",
      "ru",
      "--efforts",
      "max",
      "--repeats",
      "4",
      "--seed",
      "101",
      "--all-questions",
      "--concurrency",
      "3",
      "--max-attempts",
      "5",
      "--timeout-ms",
      "5000",
      "--max-output-tokens",
      "4096",
      "--no-pricing",
      "--no-budget",
    ]);
    expect(config).toMatchObject({
      id: "overridden",
      languages: ["ru"],
      comparisons: [],
      repeats: 4,
      seed: 101,
      execution: { concurrency: 3, maxAttempts: 5, timeoutMs: 5000, budgetUsd: null },
      models: [{ efforts: ["max"], maxOutputTokens: 4096 }],
    });
    expect(config.questionLimit).toBeUndefined();
    expect(config.models[0]!.pricing).toBeUndefined();
    const zero = await configure([path, "--efforts", "low", "--budget-usd", "0"]);
    expect(zero.execution.budgetUsd).toBe(0);
    const changed = await configure([path, "--models", "new-native-id", "--transport", "openai"]);
    expect(changed.models[0]).toMatchObject({
      transport: "openai",
      model: "new-native-id",
      efforts: ["medium"],
    });
    expect(changed.models[0]!.pricing).toBeUndefined();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("can supply every price field, including zero, with no YAML", async () => {
  const config = await configure([
    ...flags,
    "--models",
    "fixtures/free:free",
    "--language",
    "ru",
    "--pricing-as-of",
    "2026-09-07",
    "--pricing-source",
    "https://example.org/rates",
    "--input-per-million",
    "0",
    "--cached-input-per-million",
    "0",
    "--cache-write-per-million",
    "0",
    "--cache-write1h-per-million",
    "0",
    "--output-per-million",
    "0",
    "--budget-usd",
    "0",
  ]);
  expect(config.models[0]!.pricing).toEqual({
    ...experiment.models[0]!.pricing,
    asOf: "2026-09-07",
    source: "https://example.org/rates",
  });
  expect(summarizePlan(config, createJobs(config, questions, "zero"))).toMatchObject({
    upperBoundUsdOneAttempt: 0,
    upperBoundUsdAllAttempts: 0,
  });
});

it.each(["fixture-one", "fixture-two"])(
  "requires explicit scientific inputs and accepts dataset %s with a single non-default language",
  async (dataset) => {
    const config = await configure([
      "--dataset",
      dataset,
      "--protocol",
      "multiple-choice-v1",
      "--transport",
      "fake",
      "--models",
      "synthetic-model",
      "--language",
      "ja",
    ]);
    expect(config).toMatchObject({ dataset, languages: ["ja"], comparisons: [] });
    await expect(
      configure(["--transport", "fake", "--models", "synthetic-model"]),
    ).rejects.toThrow();
  },
);

it.each(
  [
    ["--models", "fixtures/a,,fixtures/b"],
    ["--models", "fixtures/a,fixtures/a"],
    ["--efforts", "low,low"],
    ["--language", "ru", "--languages", "en"],
    ["--question-limit", "2", "--all-questions"],
    ["--budget-usd", "1", "--no-budget"],
    ["--no-pricing", "--input-per-million", "0"],
    ["--input-per-million", "0"],
  ].map((args) => [args]),
)("rejects ambiguous or incomplete options %j", async (overrides) => {
  await expect(
    configure([...flags, "--models", "fixtures/a", "--languages", "ru", ...overrides]),
  ).rejects.toThrow();
});

it.each([["obsolete-models"], [[null, "obsolete"]]])(
  "lets explicit flags replace malformed inherited containers: %j",
  async (models) => {
    const root = await mkdtemp(join(tmpdir(), "llang-malformed-config-"));
    try {
      const path = join(root, "experiment.yaml");
      await writeFile(path, stringify({ ...experiment, models, execution: "obsolete-execution" }));
      await expect(configure([path])).rejects.toThrow();
      const config = await configure([
        path,
        "--models",
        "fixtures/replacement:free",
        "--transport",
        "openrouter",
        "--efforts",
        "max",
        "--concurrency",
        "4",
        "--max-attempts",
        "2",
        "--timeout-ms",
        "5000",
      ]);
      expect(config.models).toEqual([
        {
          transport: "openrouter",
          model: "fixtures/replacement:free",
          efforts: ["max"],
          maxOutputTokens: null,
        },
      ]);
      expect(config.execution).toEqual({ concurrency: 4, maxAttempts: 2, timeoutMs: 5000 });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);

it("omits absent caps, preserves explicit YAML caps, and accepts numeric CLI overrides", async () => {
  const args = [...flags, "--models=fixtures/a:free", "--languages=ru,en"];
  const config = await configure(args);
  expect(config.models[0]!.maxOutputTokens).toBeNull();
  expect(
    createJobs(config, questions, "uncapped").every((j) => j.request.maxOutputTokens === null),
  ).toBe(true);
  expect((await configure([...args, "--max-output-tokens=4096"])).models[0]!.maxOutputTokens).toBe(
    4096,
  );
  const directory = await mkdtemp(join(tmpdir(), "llang-cap-"));
  try {
    const path = join(directory, "config.yaml");
    await writeFile(path, stringify(config));
    expect((await configure([path])).models[0]!.maxOutputTokens).toBeNull();
    await writeFile(
      path,
      stringify({
        ...config,
        models: config.models.map((m) => ({ ...m, maxOutputTokens: undefined })),
      }),
    );
    expect((await configure([path])).models[0]!.maxOutputTokens).toBeNull();
    await writeFile(
      path,
      stringify({ ...config, models: config.models.map((m) => ({ ...m, maxOutputTokens: 4096 })) }),
    );
    expect((await configure([path])).models[0]!.maxOutputTokens).toBe(4096);
    expect((await configure([path, "--max-output-tokens=8192"])).models[0]!.maxOutputTokens).toBe(
      8192,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  const pinnedArgs = [...args, "--protocol", "mmluprox-lite-5shot-author-api-v3"];
  const pinned = await configure(pinnedArgs);
  expect(() => createJobs(pinned, questions, "pinned")).toThrow("2048-token");
  expect(() =>
    createJobs(
      { ...pinned, models: pinned.models.map((m) => ({ ...m, maxOutputTokens: 2048 })) },
      questions,
      "pinned-cap",
    ),
  ).not.toThrow();
  await expect(
    configure([
      ...flags,
      "--languages=ja",
      "--protocol",
      "multiple-choice-v1",
      "--transport",
      "anthropic",
      "--models",
      "claude-test",
    ]),
  ).rejects.toThrow("requires an explicit");
});
