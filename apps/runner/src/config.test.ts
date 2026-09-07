import { describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { parseExperiment } from "./config";
import { createJobs } from "./plan";
import { experiment, questions } from "@tests/fixtures";
import { protocol } from "@llang-gap/evaluation";
import { readFile } from "node:fs/promises";

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
  it("plans the new protocol with author stops and rejects a changed token cap", () => {
    const config = {
      ...experiment,
      protocol: protocol.id,
      models: experiment.models.map((m) => ({ ...m, maxOutputTokens: 2048 })),
    };
    for (const job of createJobs(config, questions, "author")) {
      expect(job.protocol).toBe(protocol.id);
      expect(job.request.stopSequences).toEqual(protocol.generation.until[job.request.language]);
      expect(job.request.maxOutputTokens).toBe(2048);
    }
    expect(() => createJobs({ ...config, models: experiment.models }, questions, "bad")).toThrow(
      "2048",
    );
    for (const job of createJobs(experiment, questions, "legacy")) {
      expect(job).not.toHaveProperty("protocol");
      expect(job.request).not.toHaveProperty("stopSequences");
    }
  });
  it("keeps every question in the primary plan and uses v3 in all active configurations", async () => {
    for (const name of ["mvp", "pilot", "smoke", "openrouter-pilot"]) {
      const config = parseExperiment(
        await readFile(new URL(`../../../experiments/${name}.yaml`, import.meta.url), "utf8"),
      );
      expect(config.protocol).toBe(protocol.id);
      expect(config.models.every((m) => m.maxOutputTokens === 2048)).toBe(true);
      if (name === "mvp") {
        expect(config.questionLimit).toBeUndefined();
        const jobs = createJobs(config, questions, "primary");
        expect(new Set(jobs.map((j) => j.questionId))).toEqual(
          new Set(questions.filter((q) => q.split === "test").map((q) => q.id)),
        );
      }
    }
  });
});

const routerModel = {
  ...experiment.models[0]!,
  transport: "openrouter" as const,
  model: "openai/gpt-5-nano",
  pricing: { ...experiment.models[0]!.pricing, inputPerMillion: 1, outputPerMillion: 1 },
};
it("plans a transport and model without gateway-specific configuration", () => {
  const config = parseExperiment(stringify({ ...experiment, models: [routerModel] }));
  const jobs = createJobs(config, questions, "router");
  expect(jobs.length).toBeGreaterThan(0);
  expect(
    jobs.every(
      (job) => job.model.transport === "openrouter" && job.request.model === routerModel.model,
    ),
  ).toBe(true);
});
it.each([
  { model: "../secret" },
  { model: "openrouter/auto" },
  { model: "openai/gpt-5-nano:online" },
  { model: "gpt-5-nano" },
  { openrouterProvider: "openai" },
  { provider: "openrouter" },
  { pricing: { ...routerModel.pricing, inputPerMillion: 0 } },
])("rejects invalid OpenRouter configuration %j", (override) => {
  expect(() =>
    parseExperiment(stringify({ ...experiment, models: [{ ...routerModel, ...override }] })),
  ).toThrow();
});

it("accepts native transport/model configurations and rejects the previous schema", () => {
  const model = { ...routerModel, transport: "openai", model: "gpt-6-astra" };
  expect(parseExperiment(stringify({ ...experiment, models: [model] })).models[0]).toEqual(model);
  expect(() => parseExperiment(stringify({ ...experiment, schemaVersion: 1 }))).toThrow();
});
