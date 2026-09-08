import { describe, expect, it } from "vitest";
import type { Aggregate, ReleaseManifest } from "@llang-gap/contracts";
import type { GuidePlan, ReleaseEvidence } from "@llang-gap/contracts/guide";
import { buildGuide, type GuideRelease } from "./guide";

const h = (letter: string) => letter.repeat(64);
const conditions = (languages: string[], n = 4) =>
  languages.map((language) => ({
    language,
    n,
    inputHash: h(language === "ja" ? "b" : "a"),
    alignmentHash: h("c"),
    randomBaseline: 0.25,
  }));
const profile = {
  transport: "openrouter" as const,
  model: "fixture/model",
  effort: "low" as const,
};
function release(
  id: string,
  dataset = "first",
  languages = ["de", "ja"],
  accuracy = 0.75,
  n = 4,
): GuideRelease {
  const row: Aggregate = {
    ...profile,
    repeats: 1,
    scores: languages.map((language) => ({ language, n, accuracy, repeatAccuracy: [accuracy] })),
    comparisons: [],
    unparseable: 0,
    refusals: 0,
    costUsd: null,
  };
  const manifest: ReleaseManifest = {
    schemaVersion: 3,
    id,
    runId: `run-${id}`,
    createdAt: "2026-09-08T00:00:00.000Z",
    kind: "benchmark",
    dataset,
    datasetRevision: "revision",
    languages,
    comparisons: [],
    protocol: "multiple-choice-v1",
    configHash: h("a"),
    files: { "dataset-manifest.json": h("b") },
    aggregate: [row],
  };
  const evidence: ReleaseEvidence = {
    schemaVersion: 1,
    releaseId: id,
    runCreatedAt: manifest.createdAt,
    configHash: h("a"),
    datasetManifestHash: h("b"),
    protocolHash: h("c"),
    languages: conditions(languages, n),
    configurations: [{ transport: profile.transport, model: profile.model, maxOutputTokens: 2048 }],
  };
  return { manifest, evidence, manifestHash: h("d"), evidenceHash: h("e") };
}
function plan(inputs: GuideRelease[]): GuidePlan {
  return {
    schemaVersion: 1,
    suite: {
      id: "test-v1",
      families: [{ id: "reasoning", weight: 1 }],
      tasks: [
        ...new Map(
          inputs.map(({ manifest, evidence }) => [
            manifest.dataset,
            {
              id: manifest.dataset,
              family: "reasoning",
              weight: 1,
              dataset: manifest.dataset,
              datasetRevision: manifest.datasetRevision,
              datasetManifestHash: evidence!.datasetManifestHash,
              protocol: manifest.protocol,
              protocolHash: evidence!.protocolHash,
              maxOutputTokens: 2048,
              repeats: 1,
              languages: evidence!.languages,
            },
          ]),
        ).values(),
      ],
    },
    profiles: [profile],
    releases: inputs.map((entry) => entry.manifest.id),
  };
}
const build = (inputs: GuideRelease[], configuration = plan(inputs)) =>
  buildGuide(configuration, inputs, "guide-test", "2026-09-08T00:00:00.000Z");

describe("versioned model guide", () => {
  it("normalizes within each dataset then weights datasets, never questions or runs", () => {
    const inputs = [
      release("small", "first", ["ja"], 0.25, 4),
      release("large", "second", ["ja"], 1, 400),
    ];
    const result = build(inputs);
    expect(result.models[0]!.scores[0]!.value).toBe(50);
    expect(result.models[0]!.scores[0]!.contributions.map((entry) => entry.accuracy)).toEqual([
      0.25, 1,
    ]);
  });
  it("selects newest compatible evidence per language without erasing older languages", () => {
    const old = release("old");
    const next = release("next", "first", ["ja"], 0.25);
    next.manifest.createdAt = "2026-09-09T00:00:00.000Z";
    const configuration = plan([old]);
    configuration.releases.push("next");
    const result = build([next, old], configuration);
    expect(result.models).toHaveLength(1);
    expect(
      result.models[0]!.scores.map((score) => [score.language, score.contributions[0]?.releaseId]),
    ).toEqual([
      ["de", "old"],
      ["ja", "next"],
    ]);
    expect(result.models[0]!.scores[1]!.value).toBe(0);
    expect(build([old, next], configuration)).toEqual(result);
  });
  it("does not let a republication of an old run replace newer observations", () => {
    const old = release("republished", "first", ["ja"], 1);
    old.manifest.createdAt = "2026-10-01T00:00:00.000Z";
    const recent = release("recent", "first", ["ja"], 0.25);
    recent.evidence!.runCreatedAt = "2026-09-09T00:00:00.000Z";
    recent.manifest.createdAt = "2026-09-09T00:00:00.000Z";
    expect(build([old, recent]).models[0]!.scores[0]!.contributions[0]!.releaseId).toBe("recent");
  });
  it("retains published languages outside the suite without inventing scores", () => {
    const input = release("one", "first", ["ja", "de"]);
    const configuration = plan([input]);
    configuration.suite.tasks[0]!.languages = configuration.suite.tasks[0]!.languages.filter(
      (entry) => entry.language === "ja",
    );
    const output = build([input], configuration);
    expect(output.languages).toEqual(["de", "ja"]);
    expect(output.models[0]!.scores.map((score) => score.language)).toEqual(["ja"]);
  });
  it("keeps valid scores bounded for large or fractional fixed weights", () => {
    const inputs = [release("a", "a", ["ja"], 1), release("b", "b", ["ja"], 1)];
    const configuration = plan(inputs);
    configuration.suite.tasks.forEach((task) => {
      task.weight = 1e308;
    });
    expect(build(inputs, configuration).models[0]!.scores[0]!.value).toBe(100);
  });
  it("rejects duplicate observations inside a release instead of selecting by row order", () => {
    const input = release("one");
    input.manifest.aggregate.push(structuredClone(input.manifest.aggregate[0]!));
    expect(() => build([input])).toThrow("Duplicate published model condition");
  });
  it("does not average a more successful effort into the selected model profile", () => {
    const input = release("one");
    input.manifest.aggregate.push({
      ...input.manifest.aggregate[0]!,
      effort: "high",
      scores: conditions(["de", "ja"]).map(({ language, n }) => ({
        language,
        n,
        accuracy: 1,
        repeatAccuracy: [1],
      })),
    });
    expect(build([input]).models[0]!.scores[0]!.value).toBeCloseTo(66.66667);
  });
  it("does not infer a profile for a new model or combine API providers", () => {
    const input = release("one");
    input.manifest.aggregate[0]!.model = "fixture/new-model";
    const configuration = plan([input]);
    const model = build([input], configuration).models[0]!;
    expect(model.profile).toBeNull();
    expect(
      model.scores.every((score) => score.status === "incomplete" && score.value === null),
    ).toBe(true);
  });
  it("withholds the whole score when a required dataset is missing; zero is still a measured score", () => {
    const first = release("first", "first", ["ja"], 0.25);
    const second = release("second", "second", ["ja"], 1);
    const configuration = plan([first, second]);
    configuration.releases = ["first"];
    const score = build([first], configuration).models[0]!.scores[0]!;
    expect(score).toMatchObject({ status: "incomplete", value: null, required: 2 });
    expect(score.contributions[0]!.value).toBe(0);
  });
  it("supports five versus twenty-five languages without changing previous scores", () => {
    const tags = [
      "ar",
      "az",
      "bg",
      "bs",
      "ca",
      "cs",
      "da",
      "de",
      "el",
      "es",
      "et",
      "eu",
      "fi",
      "fr",
      "he",
      "hi",
      "hr",
      "hu",
      "id",
      "it",
      "ja",
      "ka",
      "kk",
      "ko",
      "lt",
    ];
    const small = release("small", "first", tags.slice(0, 5));
    const large = release("large", "first", tags);
    large.manifest.aggregate[0]!.model = "fixture/other";
    large.evidence!.configurations[0]!.model = "fixture/other";
    const configuration = plan([large]);
    configuration.releases.push("small");
    configuration.profiles.push({ ...profile, model: "fixture/other" });
    const result = build([small, large], configuration);
    expect(
      result.models.map((model) => model.scores.filter((score) => score.value !== null).length),
    ).toEqual([5, 25]);
    expect(result.models[0]!.scores[6]!.status).toBe("unmeasured");
    expect(result.models[0]!.scores[0]!.value).toBeCloseTo(result.models[1]!.scores[0]!.value!);
  });
  it.each(["cap", "repeats", "revision", "manifest", "protocol", "input", "count"])(
    "does not silently replace a compatible result with changed %s",
    (change) => {
      const original = release("original");
      const next = release("next", "first", ["de", "ja"], 1);
      const configuration = plan([original]);
      configuration.releases.push("next");
      next.manifest.createdAt = "2026-09-09T00:00:00.000Z";
      if (change === "cap") next.evidence!.configurations[0]!.maxOutputTokens = null;
      if (change === "repeats") {
        next.manifest.aggregate[0]!.repeats = 2;
        next.manifest.aggregate[0]!.scores.forEach((score) => score.repeatAccuracy.push(1));
      }
      if (change === "revision") next.manifest.datasetRevision = "other";
      if (change === "manifest") {
        next.evidence!.datasetManifestHash = h("f");
        next.manifest.files["dataset-manifest.json"] = h("f");
      }
      if (change === "protocol") next.evidence!.protocolHash = h("f");
      if (change === "input")
        next.evidence!.languages.forEach((entry) => {
          entry.inputHash = h("f");
        });
      if (change === "count")
        next.evidence!.languages.forEach((entry) => {
          entry.n = 2;
        });
      expect(
        build([original, next], configuration).models[0]!.scores.every(
          (score) => score.contributions[0]!.releaseId === "original",
        ),
      ).toBe(true);
    },
  );
  it("keeps fixed family weights when one family contains several related datasets", () => {
    const inputs = [
      release("a", "a", ["ja"], 1),
      release("b", "b", ["ja"], 1),
      release("c", "c", ["ja"], 0.25),
    ];
    const configuration = plan(inputs);
    configuration.suite.families.push({ id: "knowledge", weight: 1 });
    configuration.suite.tasks[2]!.family = "knowledge";
    expect(build(inputs, configuration).models[0]!.scores[0]!.value).toBe(50);
  });
  it("separates different language bases and never supplies a synthetic uncertainty interval", () => {
    const input = release("one");
    const configuration = plan([input]);
    configuration.suite.tasks[0]!.languages[1]!.alignmentHash = h("f");
    input.evidence!.languages[1]!.alignmentHash = h("f");
    const scores = build([input], configuration).models[0]!.scores;
    expect(scores[0]!.comparisonBasis).not.toBe(scores[1]!.comparisonBasis);
    expect(scores[0]).not.toHaveProperty("gapCi95");
  });
  it("allows old releases without metadata in history but not in the index calculation", () => {
    const input = release("one");
    const configuration = plan([input]);
    input.evidence = null;
    input.evidenceHash = null;
    expect(build([input], configuration).models[0]!.scores[0]!.value).toBeNull();
  });
  it("rejects synthetic, duplicate and unlisted releases", () => {
    const input = release("one");
    const configuration = plan([input]);
    input.manifest.kind = "test";
    expect(() => build([input], configuration)).toThrow("published benchmark");
    input.manifest.kind = "benchmark";
    expect(() => build([input, input], configuration)).toThrow("release set");
    configuration.releases = [];
    expect(() => build([input], configuration)).toThrow("release set");
  });
});
