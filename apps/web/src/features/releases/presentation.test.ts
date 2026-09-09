import { describe, expect, it } from "vitest";
import type { ReleaseManifest } from "@llang-gap/contracts";
import { groupReleasesByDay, matchesRelease, releaseModels } from "./presentation";

function fixture(overrides: Partial<ReleaseManifest> = {}): ReleaseManifest {
  return {
    schemaVersion: 3,
    id: "synthetic-release",
    runId: "synthetic-run",
    kind: "benchmark",
    createdAt: "2026-09-08T12:00:00.000Z",
    dataset: "synthetic-science",
    datasetRevision: "fixture",
    languages: ["ja"],
    comparisons: [],
    protocol: "synthetic-protocol",
    configHash: "a".repeat(64),
    files: {},
    aggregate: [
      {
        transport: "fake",
        model: "synthetic-polyglot",
        effort: "low",
        repeats: 1,
        scores: [{ language: "ja", n: 2, accuracy: 0.5, repeatAccuracy: [0.5] }],
        comparisons: [],
        refusals: 0,
        unparseable: 0,
        costUsd: null,
      },
    ],
    ...overrides,
  };
}

describe("daily release archive", () => {
  it("groups by the UTC publication day, sorts newest first, and preserves the input", () => {
    const earlier = fixture({ id: "earlier", createdAt: "2026-09-03T23:55:00Z" });
    const offset = fixture({
      id: "offset",
      createdAt: "2026-09-09T00:30:00+05:00",
      dataset: "synthetic-history",
    });
    const latest = fixture({ id: "latest", createdAt: "2026-09-08T23:00:00Z" });
    const input = [earlier, offset, latest];
    expect(groupReleasesByDay(input)).toEqual([
      { day: "2026-09-08", reports: [latest, offset] },
      { day: "2026-09-03", reports: [earlier] },
    ]);
    expect(input).toEqual([earlier, offset, latest]);
    expect(groupReleasesByDay(input, true)).toEqual([
      { day: "2026-09-03", reports: [earlier] },
      { day: "2026-09-08", reports: [offset, latest] },
    ]);
  });

  it("handles empty archives and makes equal-time ordering deterministic", () => {
    expect(groupReleasesByDay([])).toEqual([]);
    const a = fixture({ id: "a" });
    const b = fixture({ id: "b" });
    expect(groupReleasesByDay([b, a])[0]!.reports).toEqual([a, b]);
  });

  it("searches non-default language names in the UI locale, without mixing dataset identities", () => {
    const science = fixture();
    const history = fixture({ dataset: "synthetic-history", languages: ["de", "fr"] });
    expect(matchesRelease(science, "Japanese science", "en")).toBe(true);
    expect(matchesRelease(science, "японский", "ru")).toBe(true);
    expect(matchesRelease(science, "history", "en")).toBe(false);
    expect(matchesRelease(history, "German history", "en")).toBe(true);
    expect(matchesRelease(science, "   ", "en")).toBe(true);
    expect(matchesRelease(science, "unavailable model", "en")).toBe(false);
  });

  it("counts a model once across effort settings without dropping single-language runs", () => {
    const release = fixture();
    release.aggregate.push({ ...release.aggregate[0]!, effort: "high" });
    expect(releaseModels(release)).toHaveLength(1);
    expect(releaseModels(release)[0]!.label).toBe("synthetic-polyglot");
    expect(release.languages).toEqual(["ja"]);
  });
});
