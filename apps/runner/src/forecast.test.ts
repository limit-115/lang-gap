import { describe, expect, it } from "vitest";
import { experiment, item, questions } from "@tests/fixtures";
import { createJobs } from "./plan";
import { forecastCost } from "./forecast";

const model = experiment.models[0]!;
const config = {
  ...experiment,
  models: [
    {
      ...model,
      pricing: {
        ...model.pricing,
        inputPerMillion: 10,
        outputPerMillion: 50,
        cachedInputPerMillion: 1,
        cacheWritePerMillion: 12.5,
        cacheWrite1hPerMillion: 20,
      },
    },
  ],
};
const usage = {
  inputTokens: 1000,
  outputTokens: 100,
  cachedInputTokens: 200,
  cacheWriteTokens: 100,
  cacheWrite1hTokens: 50,
  reasoningTokens: 80,
};
const samples = [item({ usage }), item({ language: "ru", usage: { ...usage, outputTokens: 200 } })];
const jobs = createJobs(config, questions, "forecast");

describe("usage cost forecast", () => {
  it("prices observed usage per language, includes reasoning once, and scales to target repeats", () => {
    const forecast = forecastCost(config, jobs, config, samples);
    expect(forecast.estimatedUsd).toBeCloseTo(6 * (0.01395 + 0.01895));
    expect(forecast.conditions.map((c) => c.sampleQuestions)).toEqual([1, 1]);
    expect(forecast.conditions.map((c) => c.requests)).toEqual([6, 6]);
    expect(forecast.outputCapScenarioUsd).toBeCloseTo(12 * (0.00895 + (1024 * 50) / 1e6));
    expect(jobs.reduce((sum, j) => sum + j.reservationUsd, 0)).toBeGreaterThan(
      forecast.estimatedUsd,
    );
  });
  it("reprices usage instead of scaling historical charges", () => {
    expect(
      forecastCost(
        config,
        jobs,
        config,
        samples.map((r) => ({ ...r, costUsd: 999 })),
      ).estimatedUsd,
    ).toBeCloseTo(0.1974);
  });
  it("does not silently drop unknown usage or missing conditions", () => {
    expect(() => forecastCost(config, jobs, config, [samples[0]!])).toThrow("recorded usage");
    expect(() =>
      forecastCost(
        config,
        jobs,
        config,
        samples.map((r) => ({ ...r, usage: null })),
      ),
    ).toThrow("recorded usage");
  });
  it("rejects different protocol, cap, or model", () => {
    expect(() =>
      forecastCost(
        config,
        jobs,
        { ...config, protocol: "mmluprox-lite-5shot-author-api-v3" },
        samples,
      ),
    ).toThrow("same protocol");
    expect(() =>
      forecastCost(
        config,
        jobs,
        { ...config, models: [{ ...config.models[0]!, maxOutputTokens: 2048 }] },
        samples,
      ),
    ).toThrow("token cap mismatch");
    expect(() => forecastCost(config, jobs, { ...config, models: [] }, samples)).toThrow(
      "mismatch",
    );
  });
  it("includes truncated and incorrect outcomes without favourable filtering", () => {
    const changed = samples.map((r) => ({ ...r, outcome: "truncated" as const, correct: false }));
    const result = forecastCost(config, jobs, config, changed);
    expect(result.estimatedUsd).toBe(forecastCost(config, jobs, config, samples).estimatedUsd);
    expect(result.conditions.every((c) => c.sampleTruncated === 1)).toBe(true);
  });
});

it("rejects calibration from a different OpenRouter upstream", () => {
  const model = {
    ...config.models[0]!,
    provider: "openrouter" as const,
    model: "openai/gpt-5-nano",
    openrouterProvider: "openai",
  };
  const target = { ...config, models: [model] };
  const source = { ...target, models: [{ ...model, openrouterProvider: "azure" }] };
  expect(() => forecastCost(target, [], source, [])).toThrow("mismatch");
});
