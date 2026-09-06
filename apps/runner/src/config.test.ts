import { describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { protocolV2 } from "@llang-gap/evaluation";
import { parseExperiment } from "./config";
import { createJobs, summarizePlan } from "./plan";
import { experiment, questions } from "@tests/fixtures";

describe("experiment plan", () => {
  it("rejects duplicate YAML keys and aliases", () => {
    expect(() => parseExperiment(`id: first\nid: second\n`)).toThrow("Invalid YAML");
    expect(() => parseExperiment("value: &x [1]\nother: *x")).toThrow();
  });
  it("roundtrips strict config and produces deterministic paired jobs", () => {
    expect(parseExperiment(stringify(experiment))).toEqual(experiment);
    const jobs = createJobs(experiment, questions, "fixed");
    expect(jobs).toHaveLength(12);
    expect(createJobs(experiment, questions, "fixed")).toEqual(jobs);
    expect(new Set(jobs.map((j) => j.id)).size).toBe(12);
    for (let index = 0; index < jobs.length; index += 2) {
      expect(jobs[index]?.questionId).toBe(jobs[index + 1]?.questionId);
      expect(jobs[index]?.request.language).not.toBe(jobs[index + 1]?.request.language);
      expect(jobs[index]?.request.prompt).not.toContain("PRIVATE_TEST_SOLUTION");
    }
  });
  it("changes job identities for scientific config changes", () => {
    expect(createJobs(experiment, questions, "old")[0]?.id).not.toBe(
      createJobs(experiment, questions, "new")[0]?.id,
    );
  });

  const stratifiedQuestions = ["math", "physics"].flatMap((category, index) =>
    questions.map((question) => ({
      ...question,
      id: `${question.id}:${category}`,
      sourceId: question.sourceId + index * 10_000,
      category,
    })),
  );
  const stratifiedExperiment = parseExperiment(
    stringify({
      ...experiment,
      protocol: protocolV2.id,
      questionLimit: undefined,
      questionsPerCategory: 2,
      models: [{ ...experiment.models[0], efforts: ["low", "high"] }],
    }),
  );

  it("selects two questions per category with identical paired conditions across efforts and repeats", () => {
    expect(parseExperiment(stringify(stratifiedExperiment))).toEqual(stratifiedExperiment);
    const jobs = createJobs(stratifiedExperiment, stratifiedQuestions, "stratified");
    expect(jobs).toHaveLength(32);
    expect(new Set(jobs.map((job) => job.id)).size).toBe(32);
    const selectedIds = [...new Set(jobs.map((job) => job.questionId))].sort();
    expect(selectedIds).toEqual([
      "test:synthetic:2000:math",
      "test:synthetic:2000:physics",
      "test:synthetic:2002:math",
      "test:synthetic:2002:physics",
    ]);
    const otherSeed = createJobs(
      { ...stratifiedExperiment, seed: 43 },
      stratifiedQuestions,
      "stratified",
    );
    expect([...new Set(otherSeed.map((job) => job.questionId))].sort()).not.toEqual(selectedIds);
    expect(createJobs(stratifiedExperiment, stratifiedQuestions, "stratified")).toEqual(jobs);
    expect(summarizePlan(stratifiedExperiment, jobs)).toMatchObject({
      protocol: protocolV2.id,
      questionsPerLanguage: 4,
      questionsByCategory: { math: 2, physics: 2 },
      configurations: 2,
      repeats: 2,
      requests: 32,
    });
    for (const questionId of new Set(jobs.map((job) => job.questionId))) {
      const conditions = jobs
        .filter((job) => job.questionId === questionId)
        .map((job) => `${job.request.language}/${job.request.effort}/${job.repeat}`)
        .sort();
      expect(conditions).toEqual([
        "en/high/0",
        "en/high/1",
        "en/low/0",
        "en/low/1",
        "ru/high/0",
        "ru/high/1",
        "ru/low/0",
        "ru/low/1",
      ]);
    }
    for (let index = 0; index < jobs.length; index += 2) {
      const first = jobs[index]!;
      const second = jobs[index + 1]!;
      expect([first.questionId, first.request.effort, first.repeat]).toEqual([
        second.questionId,
        second.request.effort,
        second.repeat,
      ]);
      expect(first.request.language).not.toBe(second.request.language);
    }
    const reordered = [
      ...stratifiedQuestions.filter((question) => question.split === "test").reverse(),
      ...stratifiedQuestions.filter((question) => question.split === "validation"),
    ];
    expect(createJobs(stratifiedExperiment, reordered, "stratified")).toEqual(jobs);
  });

  it("rejects underfilled categories and inconsistent language pairs before sampling", () => {
    const underfilled = stratifiedQuestions.filter(
      (question) =>
        question.split !== "test" ||
        question.category !== "physics" ||
        question.sourceId === 12_000,
    );
    expect(() => createJobs(stratifiedExperiment, underfilled, "stratified")).toThrow(
      "Category physics has 1 questions; requested 2",
    );
    const mismatched = stratifiedQuestions.map((question) =>
      question.id === "test:synthetic:2000:math" && question.language === "ru"
        ? { ...question, category: "physics" }
        : question,
    );
    expect(() => createJobs(stratifiedExperiment, mismatched, "stratified")).toThrow(
      "Paired question has mismatched categories: test:synthetic:2000:math",
    );
  });
});
