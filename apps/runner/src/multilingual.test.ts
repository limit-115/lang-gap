import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  datasetManifestSchema,
  experimentSchema,
  type DatasetManifest,
  type Question,
} from "@llang-gap/contracts";
import { prepareDataset, sha256, validateAlignment } from "@llang-gap/datasets";
import {
  aggregateResults,
  buildPrompt,
  multipleChoiceProtocol,
  parseAnswer,
  toPromptQuestion,
} from "@llang-gap/evaluation";
import { createFakeAdapter } from "@llang-gap/providers";
import { experiment, item } from "@tests/fixtures";
import { selectExperiment } from "./config";
import { createJobs } from "./plan";
import { createRun, resumeRun } from "./run";
import { aggregateCsv, buildRelease, verifyRelease } from "./release";
import { readSnapshot } from "./snapshot";
import { RunState } from "./state";

const languages = ["de", "fr", "ja"];
const prompts = {
  de: {
    instruction: "Antworte nur mit dem Buchstaben der richtigen Option (A oder B).",
    question: "Frage:",
    options: "Optionen:",
  },
  fr: {
    instruction: "Répondez uniquement par la lettre de la bonne option (A ou B).",
    question: "Question :",
    options: "Options :",
  },
  ja: {
    instruction: "正しい選択肢の文字（A または B）だけで答えてください。",
    question: "質問：",
    options: "選択肢：",
  },
};
const texts = ["Wie viel ist 1 + 1?", "Combien font 1 + 1 ?", "1 + 1 はいくつですか？"];
const questions: Question[] = languages.flatMap((language, index) =>
  [1, 2].map((id) => ({
    id: `q${id}`,
    sourceId: `source-${id}`,
    language,
    split: "test",
    category: "arithmetic",
    question: texts[index]!,
    options: ["2", "3"],
    answer: "A",
    cot: "PRIVATE_TARGET_SOLUTION",
  })),
);
function fixture(dataset = "arithmetic-fixture") {
  const files = languages.map((language) => {
    const bytes =
      questions
        .filter((q) => q.language === language)
        .map((q) => JSON.stringify(q))
        .join("\n") + "\n";
    return {
      path: `${language}/test.jsonl`,
      language,
      split: "test" as const,
      rows: 2,
      sha256: sha256(bytes),
    };
  });
  const manifest = datasetManifestSchema.parse({
    schemaVersion: 2,
    id: dataset,
    repository: `fixtures/${dataset}`,
    revision: "a".repeat(40),
    normalizerVersion: 1,
    format: "normalized-jsonl",
    prompts,
    license: "Synthetic test only",
    source: "https://example.org/fixtures",
    files,
  });
  const config = experimentSchema.parse({
    ...experiment,
    id: dataset,
    dataset,
    protocol: multipleChoiceProtocol.id,
    languages,
    comparisons: [
      { baseline: "fr", language: "ja" },
      { baseline: "ja", language: "de" },
    ],
    questionLimit: undefined,
  });
  return { manifest, config };
}
async function cache(root: string, manifest: DatasetManifest) {
  if (manifest.schemaVersion !== 2) throw new Error("Expected schema-v2 fixture");
  for (const file of manifest.files) {
    const path = join(root, manifest.id, manifest.revision, "normalizer-1", file.path);
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(
      path,
      questions
        .filter((q) => q.language === file.language)
        .map((q) => JSON.stringify(q))
        .join("\n") + "\n",
    );
  }
}

describe("dataset and language selection", () => {
  it("resolves CLI overrides, including a single language, without inheriting a default pair", () => {
    expect(
      selectExperiment(experiment, {
        dataset: "arithmetic-fixture",
        language: "ja",
        protocol: multipleChoiceProtocol.id,
      }),
    ).toMatchObject({ dataset: "arithmetic-fixture", languages: ["ja"], comparisons: [] });
    expect(
      selectExperiment(experiment, { languages: ["fr", "de"], compare: ["fr:de"] }).comparisons,
    ).toEqual([{ baseline: "fr", language: "de" }]);
    for (const options of [
      { language: "ja", languages },
      { dataset: "../private" },
      { languages: [] },
      { languages: ["fr", "fr"] },
      { languages: ["de"], compare: ["en:de"] },
      { compare: ["en:ru:ja"] },
    ])
      expect(() => selectExperiment(experiment, options)).toThrow();
  });
  it.each(["arithmetic-fixture", "second-dataset"])(
    "runs %s through cache, pause/resume, release and independent verification",
    async (dataset) => {
      const root = await mkdtemp(join(tmpdir(), "llang-multilingual-"));
      try {
        const { manifest, config } = fixture(dataset);
        await cache(root, manifest);
        const prepared = await prepareDataset({
          manifest,
          cacheDir: root,
          offline: true,
          languages,
        });
        const fake = createFakeAdapter();
        const generate = vi.fn(fake.generate);
        const adapters = new Map([["fake", { ...fake, generate }]]);
        const directory = join(root, "run");
        expect(
          (
            await createRun({
              experiment: config,
              manifest,
              questions: prepared.questions,
              directory,
              budgetUsd: 0,
              adapters,
              maxJobs: 1,
            })
          ).completed,
        ).toBe(1);
        const snapshot = await readFile(join(directory, "resolved.json"), "utf8");
        expect((await resumeRun(directory, { budgetUsd: 0, adapters })).completed).toBe(12);
        expect(generate).toHaveBeenCalledTimes(12);
        const state = new RunState(join(directory, "state.sqlite"));
        try {
          expect(
            state
              .conditionSummary()
              .map(({ language, completed, total }) => ({ language, completed, total })),
          ).toEqual(languages.map((language) => ({ language, completed: 4, total: 4 })));
        } finally {
          state.close();
        }
        expect(
          generate.mock.calls.every(
            ([request]) =>
              languages.includes(request.language) &&
              !request.prompt.includes("PRIVATE_TARGET_SOLUTION"),
          ),
        ).toBe(true);
        expect(await readFile(join(directory, "resolved.json"), "utf8")).toBe(snapshot);
        const release = await buildRelease(directory, `test-${dataset}`, "test", root);
        const verified = await verifyRelease(release.directory);
        expect(verified.dataset).toBe(dataset);
        expect(verified.languages).toEqual(languages);
        expect(verified.aggregate[0]!.scores.map((score) => score.language)).toEqual(languages);
        expect(
          verified.aggregate[0]!.comparisons.map(({ baseline, language }) => ({
            baseline,
            language,
          })),
        ).toEqual(config.comparisons);
        const csv = await readFile(join(release.directory, "aggregate.csv"), "utf8");
        expect(csv).toContain('"accuracy","ja"');
        expect(csv).toContain('"comparison","ja","fr"');
        expect(csv).not.toContain("accuracy_en");
        expect(await readFile(join(release.directory, "ATTRIBUTION.md"), "utf8")).toContain(
          `fixtures/${dataset}`,
        );
        const single = selectExperiment(config, { language: "ja" });
        const selected = await prepareDataset({
          manifest,
          cacheDir: root,
          offline: true,
          languages: single.languages,
        });
        const singleRun = await createRun({
          experiment: single,
          manifest,
          questions: selected.questions,
          directory: join(root, "single"),
          budgetUsd: 0,
          adapters,
        });
        const singleState = new RunState(join(singleRun.directory, "state.sqlite"));
        try {
          expect(singleState.conditionSummary()).toMatchObject([
            { language: "ja", total: 4, completed: 4 },
          ]);
        } finally {
          singleState.close();
        }
        const singleRelease = await buildRelease(
          singleRun.directory,
          "single-release",
          "test",
          root,
        );
        expect((await verifyRelease(singleRelease.directory)).aggregate[0]).toMatchObject({
          scores: [{ language: "ja", n: 2 }],
          comparisons: [],
        });
        // A historical snapshot must never be reinterpreted with the new aggregation rules.
        await writeFile(
          join(directory, "resolved.json"),
          snapshot.replace('"schemaVersion": 3', '"schemaVersion": 2'),
        );
        await expect(readSnapshot(directory)).rejects.toThrow("recorded source");
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );
  it("fails unsupported dataset/protocol/language combinations before generating any jobs", async () => {
    const { manifest, config } = fixture();
    expect(() =>
      createJobs({ ...config, dataset: "wrong" }, questions, "identity", manifest),
    ).toThrow("mismatch");
    expect(() =>
      createJobs({ ...config, protocol: experiment.protocol }, questions, "identity", manifest),
    ).toThrow("requires its recorded dataset");
    expect(() =>
      createJobs({ ...experiment, languages: ["ja"], comparisons: [] }, questions, "identity"),
    ).toThrow("does not support ja");
    await expect(
      prepareDataset({ manifest, cacheDir: "/unused", offline: true, languages: ["es"] }),
    ).rejects.toThrow("does not support es");
    if (manifest.schemaVersion !== 2) throw new Error("fixture");
    expect(() => createJobs(config, questions, "identity", { ...manifest, prompts: {} })).toThrow(
      "localized prompt",
    );
    expect(() =>
      datasetManifestSchema.parse({
        ...manifest,
        files: [{ ...manifest.files[0], path: "de/../../private" }],
      }),
    ).toThrow();
  });
  it("keeps target answers out of localized prompts and uses language-independent extraction", () => {
    const target = questions[0]!;
    const prompt = buildPrompt(toPromptQuestion(target), [], multipleChoiceProtocol.id, prompts.de);
    expect(prompt).toContain(prompts.de.instruction);
    expect(prompt).not.toContain(target.cot);
    expect(
      buildPrompt(
        toPromptQuestion({ ...target, answer: "B", cot: "different" }),
        [],
        multipleChoiceProtocol.id,
        prompts.de,
      ),
    ).toBe(prompt);
    for (const language of ["de", "fr", "ja", "zh-Hant"]) {
      expect(parseAnswer(" A\n", language, 2, multipleChoiceProtocol.id)).toBe("A");
      for (const text of ["a", "A or B", "J", "Answer: A", ""])
        expect(parseAnswer(text, language, 2, multipleChoiceProtocol.id)).toBeNull();
    }
  });
});

describe("explicit multilingual statistics", () => {
  const conditions = fixture().config;
  const responses = [0, 1, 2].flatMap((repeat) =>
    questions.map((q) =>
      item({ questionId: q.id, language: q.language, repeat, correct: q.language !== "ja" }),
    ),
  );
  it("preserves signed gaps and question clusters for arbitrary baselines", () => {
    const [row] = aggregateResults(responses, 42, 1000, conditions);
    expect(row!.scores.map((score) => score.accuracy)).toEqual([1, 1, 0]);
    expect(row!.comparisons).toMatchObject([
      { baseline: "fr", language: "ja", gapPp: 100, gapCi95: [100, 100] },
      { baseline: "ja", language: "de", gapPp: -100, gapCi95: [-100, -100] },
    ]);
    expect(aggregateResults([...responses].reverse(), 42, 1000, conditions)).toEqual([row]);
    expect(aggregateCsv([row!]).split("\n")).toHaveLength(7);
    expect(() =>
      aggregateResults(
        responses.filter((row) => row.language !== "fr"),
        42,
        1000,
        conditions,
      ),
    ).toThrow("Incomplete");
    expect(() => aggregateResults(responses.slice(1), 42, 1000, conditions)).toThrow("Incomplete");
    expect(() => aggregateResults([...responses, responses[0]!], 42, 1000, conditions)).toThrow(
      "duplicated",
    );
  });
  it("supports unequal independent language sets and rejects implicit intersection for comparisons", () => {
    const independent = questions
      .map((q) => (q.language === "ja" ? { ...q, id: `other-${q.id}` } : q))
      .filter((q) => q.language !== "de" || q.id === "q1");
    const { manifest, config } = fixture();
    const jobs = createJobs({ ...config, comparisons: [] }, independent, "independent", manifest);
    expect(jobs).toHaveLength(10);
    expect(() => validateAlignment(independent, "fr", "ja")).toThrow("alignment");
    expect(() => createJobs(config, independent, "paired", manifest)).toThrow("alignment");
    const result = aggregateResults(
      independent.map((q) => item({ questionId: q.id, language: q.language })),
      42,
      1000,
      { languages, comparisons: [] },
    );
    expect(result[0]!.scores.map((score) => score.n)).toEqual([1, 2, 2]);
    expect(result[0]!.comparisons).toEqual([]);
  });
});
