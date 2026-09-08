import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GuideSnapshot } from "@llang-gap/contracts/guide";
import { getModelGuide } from "./guide-data";

const mocks = vi.hoisted(() => ({ readFile: vi.fn(), getReleases: vi.fn() }));
vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile }));
vi.mock("@/features/releases/data", () => ({ getReleases: mocks.getReleases }));
const hash = (value: Buffer) => createHash("sha256").update(value).digest("hex");
let files: Map<string, Buffer>;
beforeEach(() => {
  vi.stubEnv("LLANG_GUIDE_ID", undefined);
  const manifest = Buffer.from("synthetic published manifest");
  const evidence = Buffer.from("synthetic public evidence");
  const snapshot: GuideSnapshot = {
    schemaVersion: 1,
    id: "fixture-guide",
    createdAt: "2026-09-08T00:00:00.000Z",
    languages: ["ja"],
    models: [],
    plan: {
      schemaVersion: 1,
      releases: ["fixture"],
      profiles: [],
      suite: {
        id: "suite-v1",
        families: [{ id: "family", weight: 1 }],
        tasks: [
          {
            id: "task",
            family: "family",
            weight: 1,
            dataset: "synthetic",
            datasetRevision: "fixture",
            datasetManifestHash: "a".repeat(64),
            protocol: "multiple-choice-v1",
            protocolHash: "b".repeat(64),
            maxOutputTokens: null,
            repeats: 1,
            languages: [
              {
                language: "ja",
                n: 2,
                inputHash: "c".repeat(64),
                alignmentHash: "d".repeat(64),
                randomBaseline: 0.25,
              },
            ],
          },
        ],
      },
    },
    sources: [{ releaseId: "fixture", manifestHash: hash(manifest), evidenceHash: hash(evidence) }],
  };
  const content = Buffer.from(JSON.stringify(snapshot));
  files = new Map([
    [
      "guide/index.json",
      Buffer.from(
        JSON.stringify({
          schemaVersion: 1,
          latest: "fixture-guide",
          snapshots: [{ id: "fixture-guide", sha256: hash(content) }],
        }),
      ),
    ],
    ["guide/fixture-guide/summary.json", content],
    ["fixture/manifest.json", manifest],
    ["fixture/evidence.json", evidence],
  ]);
  mocks.getReleases.mockReset().mockResolvedValue([{ id: "fixture" }]);
  mocks.readFile.mockReset().mockImplementation((path: string) => {
    const entry = [...files].find(([suffix]) => path.endsWith(`/results/${suffix}`));
    if (entry) return Promise.resolve(entry[1]);
    return Promise.reject(Object.assign(new Error("Missing fixture file"), { code: "ENOENT" }));
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("model guide website boundary", () => {
  it("reads only the checksummed overview and public source files", async () => {
    expect((await getModelGuide())?.languages).toEqual(["ja"]);
    expect(
      mocks.readFile.mock.calls.every(
        (args) => !/sqlite|items|dataset.jsonl|resolved/.test(String(args[0])),
      ),
    ).toBe(true);
  });
  it.each(["guide/fixture-guide/summary.json", "fixture/manifest.json", "fixture/evidence.json"])(
    "rejects modified %s",
    async (path) => {
      files.set(path, Buffer.from("modified"));
      await expect(getModelGuide()).rejects.toThrow(/checksum|changed/);
    },
  );
  it("never falls back from an explicitly selected unpublished guide", async () => {
    vi.stubEnv("LLANG_GUIDE_ID", "missing");
    await expect(getModelGuide()).rejects.toThrow("Unpublished model guide");
  });
  it("rejects sources removed from the published release index", async () => {
    mocks.getReleases.mockResolvedValue([]);
    await expect(getModelGuide()).rejects.toThrow("Unpublished model guide source");
  });
  it("allows a genuinely empty repository but not a silently missing guide with published results", async () => {
    files.delete("guide/index.json");
    await expect(getModelGuide()).rejects.toThrow("Missing fixture file");
    mocks.getReleases.mockResolvedValue([]);
    expect(await getModelGuide()).toBeNull();
  });
});
