import { describe, expect, it } from "vitest";
import type { Aggregate, ReleaseManifest } from "@llang-gap/contracts";
import type { GuidePlan, ReleaseEvidence } from "@llang-gap/contracts/guide";
import { buildGuide, reconcileGuidePlan, type GuideRelease } from "./guide";

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

it("publishes separate effort rows across datasets and preserves legacy snapshots", () => {
  const inputs = [
    release("first", "first", ["ja"], 0.25),
    release("second", "second", ["ja"], 0.75),
  ];
  for (const input of inputs)
    input.manifest.aggregate.push({
      ...input.manifest.aggregate[0]!,
      effort: "max",
      scores: [{ language: "ja", n: 4, accuracy: 1, repeatAccuracy: [1] }],
    });
  const configuration = plan(inputs);
  expect(build(inputs, configuration).models).toHaveLength(1);
  configuration.configurationRows = true;
  configuration.profiles.push({ ...profile, effort: "max" });
  const rows = build(inputs, configuration).models;
  expect(rows).toHaveLength(2);
  expect(rows.find((row) => row.profile?.effort === "low")!.scores[0]!.value).toBeCloseTo(100 / 3);
  expect(rows.find((row) => row.profile?.effort === "max")!.scores[0]!.value).toBe(100);
  inputs[1]!.manifest.aggregate.pop();
  expect(
    build(inputs, configuration).models.find((row) => row.profile?.effort === "max")!.scores[0]!
      .value,
  ).toBeNull();
});

it("keeps native and routed configurations separate even with the same model identity", () => {
  const input = release("providers", "first", ["ja"]);
  input.manifest.aggregate[0]!.model = "openai/gpt-6-astra";
  input.evidence!.configurations[0]!.model = "openai/gpt-6-astra";
  input.manifest.aggregate.push({
    ...input.manifest.aggregate[0]!,
    transport: "openai",
    model: "gpt-6-astra",
    scores: [{ language: "ja", n: 4, accuracy: 1, repeatAccuracy: [1] }],
  });
  input.evidence!.configurations.push({
    transport: "openai",
    model: "gpt-6-astra",
    maxOutputTokens: 2048,
  });
  const configuration = plan([input]);
  configuration.configurationRows = true;
  configuration.profiles = input.manifest.aggregate.map(({ transport, model, effort }) => ({
    transport,
    model,
    effort,
  }));
  const rows = build([input], configuration).models;
  expect(rows.map((row) => row.id)).toEqual(["openai/gpt-6-astra", "openai/gpt-6-astra"]);
  expect(rows.find((row) => row.profile?.transport === "openai")!.scores[0]!.value).toBe(100);
  expect(rows.find((row) => row.profile?.transport === "openrouter")!.scores[0]!.value).toBeCloseTo(
    200 / 3,
  );
  configuration.profiles = [];
  const unlisted = build([input], configuration).models;
  expect(unlisted).toHaveLength(2);
  expect(
    unlisted.every((row) => row.profile?.effort === "low" && row.scores[0]!.value === null),
  ).toBe(true);
});

describe("publication inventory reconciliation", () => {
  it("discovers separate runs, languages and efforts without erasing older results", () => {
    const first = release("first", "first", ["de"]);
    const incoming = release("incoming", "first", ["ja", "es"]);
    incoming.manifest.aggregate.push({
      ...structuredClone(incoming.manifest.aggregate[0]!),
      effort: "high",
    });
    const basis = { ...plan([first]), configurationRows: true as const };
    const resolved = reconcileGuidePlan(basis, [first, incoming]);
    expect(basis.releases).toEqual(["first"]);
    expect(resolved.suite.id).not.toBe(basis.suite.id);
    expect(resolved.suite.families).toEqual(basis.suite.families);
    expect(resolved.suite.tasks[0]!.languages.map((entry) => entry.language)).toEqual([
      "de",
      "es",
      "ja",
    ]);
    expect(resolved.profiles.map((entry) => entry.effort).sort()).toEqual(["high", "low"]);
    expect(reconcileGuidePlan(resolved, [incoming, first])).toEqual(resolved);
    const snapshot = build([first, incoming], resolved);
    expect(snapshot.models).toHaveLength(2);
    const low = snapshot.models.find((entry) => entry.profile?.effort === "low")!;
    expect(low.scores.find((entry) => entry.language === "de")!.value).toBeCloseTo(200 / 3);
    const high = snapshot.models.find((entry) => entry.profile?.effort === "high")!;
    expect(high.scores.find((entry) => entry.language === "de")!.value).toBeNull();
    expect(high.scores.find((entry) => entry.language === "ja")!.value).toBeCloseTo(200 / 3);
  });
  it("does not invent task weights or language inputs for other datasets and token policies", () => {
    const first = release("first", "first", ["de"]);
    const other = release("other", "second", ["es"]);
    const capped = release("capped", "first", ["ja"]);
    capped.evidence!.configurations[0]!.maxOutputTokens = 8192;
    const basis = { ...plan([first]), configurationRows: true as const };
    const resolved = reconcileGuidePlan(basis, [first, other, capped]);
    expect(resolved.suite).toEqual(basis.suite);
    expect(
      build([first, other, capped], resolved).models[0]!.scores.map((entry) => entry.language),
    ).toEqual(["de"]);
  });
  it("requires all tasks before enabling a new language and withholds incomplete model scores", () => {
    const a = release("a", "first", ["de"]);
    const b = release("b", "second", ["de"]);
    const jaA = release("ja-a", "first", ["ja"], 1);
    const jaB = release("ja-b", "second", ["ja"], 0.25);
    jaB.manifest.aggregate[0]!.model = "fixture/other";
    jaB.evidence!.configurations[0]!.model = "fixture/other";
    const basis = { ...plan([a, b]), configurationRows: true as const };
    const partial = reconcileGuidePlan(basis, [a, b, jaA]);
    expect(partial.suite).toEqual(basis.suite);
    expect(
      build([a, b, jaA], partial).models[0]!.scores.some((score) => score.language === "ja"),
    ).toBe(false);
    const complete = reconcileGuidePlan(partial, [a, b, jaA, jaB]);
    expect(
      complete.suite.tasks.every((task) => task.languages.some((entry) => entry.language === "ja")),
    ).toBe(true);
    expect(
      build([a, b, jaA, jaB], complete).models.every(
        (row) => row.scores.find((score) => score.language === "ja")!.value === null,
      ),
    ).toBe(true);
  });
  it("rejects conflicting new language identities without selecting by release order", () => {
    const first = release("first", "first", ["de"]);
    const a = release("a", "first", ["ja"]);
    const b = release("b", "first", ["ja"]);
    b.evidence!.languages[0]!.inputHash = h("f");
    const basis = { ...plan([first]), configurationRows: true as const };
    expect(() => reconcileGuidePlan(basis, [first, a, b])).toThrow("Conflicting new language");
    expect(() => reconcileGuidePlan(basis, [first, b, a])).toThrow("Conflicting new language");
  });
  it("keeps existing pinned language inputs authoritative", () => {
    const first = release("first", "first", ["ja"]);
    const newer = release("newer", "first", ["ja"], 1);
    newer.evidence!.languages[0]!.inputHash = h("f");
    const basis = { ...plan([first]), configurationRows: true as const };
    const resolved = reconcileGuidePlan(basis, [first, newer]);
    expect(resolved.suite).toEqual(basis.suite);
    expect(build([first, newer], resolved).models[0]!.scores[0]!.contributions[0]!.releaseId).toBe(
      "first",
    );
  });
  it("validates source provenance and requires explicit legacy migration", () => {
    const first = release("first");
    expect(() => reconcileGuidePlan(plan([first]), [first])).toThrow("configurationRows");
    first.evidence!.configHash = h("f");
    expect(() =>
      reconcileGuidePlan({ ...plan([first]), configurationRows: true }, [first]),
    ).toThrow("provenance mismatch");
  });
});

describe("published dataset accuracy summary", () => {
  const summarize = (inputs: GuideRelease[]) =>
    buildGuide(
      {
        schemaVersion: 2,
        aggregation: "mean-dataset-accuracy-v1",
        releases: inputs.map((x) => x.manifest.id),
      },
      inputs,
      "summary",
      "2026-09-08T00:00:00.000Z",
    );
  it("handles an empty inventory and exact perfect scores across many datasets", () => {
    expect(summarize([])).toMatchObject({ languages: [], models: [], sources: [] });
    const inputs = Array.from({ length: 7 }, (_, i) =>
      release(`perfect-${i}`, `dataset-${i}`, ["ko"], 1),
    );
    expect(summarize(inputs).models[0]!.scores[0]!.value).toBe(100);
  });
  it("equally weights available datasets, not questions, repeats or random baselines", () => {
    const small = release("small", "first", ["ko"], 0.8, 5);
    const large = release("large", "second", ["ko"], 0.9, 500);
    large.manifest.aggregate[0]!.repeats = 3;
    large.manifest.aggregate[0]!.scores[0]!.repeatAccuracy = [0.9, 0.9, 0.9];
    large.evidence!.languages[0]!.randomBaseline = 0.5;
    const score = summarize([small, large]).models[0]!.scores[0]!;
    expect(score.value).toBeCloseTo(85);
    expect(score.contributions).toHaveLength(2);
    expect(score.contributions.map((c) => c.n)).toEqual([5, 500]);
  });
  it("selects latest per dataset and language across caps, protocols, revisions and repeat counts", () => {
    const old = release("old", "first", ["ko", "sv"], 1);
    const recent = release("recent", "first", ["ko"], 0.5);
    recent.evidence!.runCreatedAt = "2026-09-10T00:00:00.000Z";
    recent.evidence!.configurations[0]!.maxOutputTokens = null;
    recent.manifest.protocol = "another-protocol";
    recent.manifest.datasetRevision = "new-revision";
    recent.manifest.aggregate[0]!.repeats = 2;
    recent.manifest.aggregate[0]!.scores[0]!.repeatAccuracy = [0.5, 0.5];
    const republished = structuredClone(old);
    republished.manifest.id = "republished";
    republished.evidence!.releaseId = "republished";
    republished.manifest.createdAt = "2026-10-01T00:00:00.000Z";
    const result = summarize([old, recent, republished]);
    expect(result.models[0]!.scores.map((s) => [s.language, s.value])).toEqual([
      ["ko", 50],
      ["sv", 100],
    ]);
    expect(result.models[0]!.scores[0]!.contributions).toHaveLength(1);
    expect(result.models[0]!.scores[0]!.contributions[0]!.releaseId).toBe("recent");
    expect(summarize([republished, recent, old]).models).toEqual(result.models);
  });
  it("keeps sparse languages, single-language runs and zero accuracy visible", () => {
    const first = release("first", "first", ["kk"], 0);
    const second = release("second", "second", ["ko"], 0.5);
    second.manifest.aggregate[0]!.model = "another/model";
    second.evidence!.configurations[0]!.model = "another/model";
    const result = summarize([first, second]);
    const zero = result.models.find((m) => m.reference.model === profile.model)!;
    expect(zero.scores.find((s) => s.language === "kk")).toMatchObject({
      value: 0,
      status: "ready",
    });
    expect(zero.scores.find((s) => s.language === "ko")).toMatchObject({
      value: null,
      status: "unmeasured",
    });
    expect(summarize([first]).languages).toEqual(["kk"]);
  });
  it("includes published aggregates without optional evidence, but withholds unverified language differences", () => {
    const input = release("no-evidence");
    input.evidence = null;
    input.evidenceHash = null;
    const scores = summarize([input]).models[0]!.scores;
    expect(scores.map((s) => s.value)).toEqual([75, 75]);
    expect(scores[0]!.comparisonBasis).not.toBe(scores[1]!.comparisonBasis);
  });
  it("keeps effort and API rows separate and discovers new dataset IDs automatically", () => {
    const low = release("low");
    const high = release("high");
    high.manifest.aggregate[0]!.effort = "high";
    const api = release("api");
    api.manifest.aggregate[0]!.transport = "openai";
    api.evidence!.configurations[0]!.transport = "openai";
    const next = release("new-dataset", "previously-unknown", ["cs"], 0.8);
    const inputs = [low, high, api, next];
    const result = summarize(inputs);
    expect(result.models).toHaveLength(3);
    expect(
      result.models
        .find((m) => m.profile?.transport === "openrouter" && m.profile.effort === "low")!
        .scores.find((s) => s.language === "cs")!.value,
    ).toBe(80);
    expect(
      reconcileGuidePlan(
        { schemaVersion: 2, aggregation: "mean-dataset-accuracy-v1", releases: [] },
        inputs,
      ).releases,
    ).toEqual(inputs.map((i) => i.manifest.id).sort());
  });
  it("shows both language scores but suppresses differences for different dataset coverage", () => {
    const scores = summarize([release("both"), release("extra", "second", ["ja"])]).models[0]!
      .scores;
    expect(scores.every((s) => s.value === 75)).toBe(true);
    expect(scores[0]!.comparisonBasis).not.toBe(scores[1]!.comparisonBasis);
  });
  it("retains synthetic and provenance publication checks", () => {
    const fake = release("fake");
    fake.manifest.aggregate[0]!.transport = "fake";
    expect(() => summarize([fake])).toThrow("Only published benchmark");
    const corrupt = release("corrupt");
    corrupt.evidence!.configHash = h("f");
    expect(() => summarize([corrupt])).toThrow("provenance");
  });
});
