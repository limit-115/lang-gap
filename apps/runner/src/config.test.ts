import { describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { parseExperiment } from "./config";
import { createJobs } from "./plan";
import { experiment, questions } from "../../../tests/fixtures";

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
});
