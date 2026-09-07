import { createHash } from "node:crypto";
import { basename } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Aggregate, ReleaseManifest } from "@llang-gap/contracts";
import {
  getLatestRelease,
  getRelease,
  getReleases,
  getReleaseAssetsUrl,
  releaseAssetUrl,
} from "./data";
import { releaseStructuredData } from "./structured-data";

const mocks = vi.hoisted(() => ({
  index: { releases: [] as string[], latest: null as string | null },
  readFile: vi.fn(),
}));
vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile }));
vi.mock("@results/index.json", () => ({ default: mocks.index }));

const row: Aggregate = {
  provider: "fake",
  model: "synthetic-fixture",
  effort: "low",
  n: 2,
  repeats: 1,
  en: 0.5,
  ru: 0.5,
  gapPp: 0,
  gapCi95: [-50, 50],
  repeatAccuracy: { en: [0.5], ru: [0.5] },
  unparseable: 0,
  refusals: 0,
  costUsd: null,
};
let manifest: ReleaseManifest;
let aggregateFile: Buffer;
let baseUrl: string;
beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("LLANG_RELEASE_ID", undefined);
  mocks.index.releases = ["synthetic-fixture"];
  mocks.index.latest = "synthetic-fixture";
  aggregateFile = Buffer.from(JSON.stringify([row]));
  baseUrl = "https://example.org/releases/synthetic-fixture/";
  manifest = {
    schemaVersion: 1,
    id: "synthetic-fixture",
    runId: "synthetic-run",
    kind: "benchmark",
    createdAt: "2026-09-07T00:00:00.000Z",
    dataset: "synthetic",
    datasetRevision: "fixture",
    protocol: "synthetic-protocol",
    configHash: "a".repeat(64),
    files: {
      "aggregate.json": createHash("sha256").update(aggregateFile).digest("hex"),
      "aggregate.csv": "b".repeat(64),
    },
    aggregate: structuredClone([row]),
  };
  mocks.readFile.mockReset().mockImplementation((path: string) => {
    if (basename(path) === "manifest.json") return Promise.resolve(JSON.stringify(manifest));
    if (basename(path) === "aggregate.json") return Promise.resolve(aggregateFile);
    if (basename(path) === "assets.json") return Promise.resolve(JSON.stringify({ baseUrl }));
    throw new Error("Unexpected file read");
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("public release boundary", () => {
  it("keeps an empty index unpublished and does not read artifacts", async () => {
    mocks.index.releases = [];
    mocks.index.latest = null;
    expect(await getReleases()).toEqual([]);
    expect(await getLatestRelease()).toBeNull();
    expect(await getRelease("synthetic-fixture")).toBeNull();
    expect(mocks.readFile).not.toHaveBeenCalled();
  });
  it("accepts matching verified aggregate bytes", async () => {
    expect((await getLatestRelease())?.aggregate).toEqual([row]);
    expect(await getReleaseAssetsUrl(manifest.id)).toBe(baseUrl.slice(0, -1));
    expect((await getLatestRelease())?.aggregate[0]).not.toHaveProperty("averageCostUsd");
  });
  it("reads per-language costs, including unknown and zero, from the verified aggregate", async () => {
    manifest.aggregate[0]!.averageCostUsd = { en: 0, ru: null };
    aggregateFile = Buffer.from(JSON.stringify(manifest.aggregate));
    manifest.files["aggregate.json"] = createHash("sha256").update(aggregateFile).digest("hex");
    expect((await getLatestRelease())?.aggregate[0]?.averageCostUsd).toEqual({ en: 0, ru: null });
    manifest.aggregate[0]!.averageCostUsd.ru = 0.1;
    await expect(getReleases()).rejects.toThrow("differs from manifest");
  });
  it("rejects test artifacts even if indexed", async () => {
    manifest.kind = "test";
    await expect(getReleases()).rejects.toThrow("Invalid public release");
  });
  it("rejects a manifest for a different ID", async () => {
    manifest.id = "different";
    await expect(getReleases()).rejects.toThrow("Invalid public release");
  });
  it("rejects modified aggregate bytes", async () => {
    aggregateFile = Buffer.from("[]");
    await expect(getReleases()).rejects.toThrow("checksum mismatch");
  });
  it("rejects disagreement between hashed file and displayed scores", async () => {
    manifest.aggregate[0]!.en = 0.9;
    await expect(getReleases()).rejects.toThrow("differs from manifest");
  });
  it("rejects missing repeat values instead of rendering NaN", async () => {
    manifest.aggregate[0]!.repeatAccuracy.ru = [];
    aggregateFile = Buffer.from(JSON.stringify(manifest.aggregate));
    manifest.files["aggregate.json"] = createHash("sha256").update(aggregateFile).digest("hex");
    await expect(getReleases()).rejects.toThrow("Incomplete per-repeat");
  });
  it("never falls back when an explicit release is unpublished", async () => {
    vi.stubEnv("LLANG_RELEASE_ID", "unpublished");
    await expect(getLatestRelease()).rejects.toThrow("Unpublished release");
  });
  it("does not read unindexed IDs or traversal paths", async () => {
    expect(await getRelease("not-indexed")).toBeNull();
    expect(await getRelease("../../private")).toBeNull();
    expect(mocks.readFile).not.toHaveBeenCalled();
  });
  it.each([
    "http://example.org",
    "https://user:secret@example.org",
    "https://example.org/?token=private",
    "https://example.org/#fragment",
  ])("rejects unsuitable asset location %s", async (value) => {
    baseUrl = value;
    await expect(getReleaseAssetsUrl(manifest.id)).rejects.toThrow("HTTPS base URL");
  });
  it("does not allow filenames to escape the release directory", () => {
    expect(() => releaseAssetUrl(baseUrl, "../private.json")).toThrow("Invalid release filename");
  });
});

describe("dataset discovery", () => {
  it("uses one dataset identity across locales and real declared downloads", () => {
    const en = releaseStructuredData(manifest, baseUrl.slice(0, -1), "en", "Synthetic fixture");
    const ru = releaseStructuredData(manifest, baseUrl.slice(0, -1), "ru", "Синтетический пример");
    expect(ru["@id"]).toBe(en["@id"]);
    expect(ru.url).toContain("/ru/releases/synthetic-fixture/");
    expect(en.distribution.map((d) => d.contentUrl)).toEqual([
      `${baseUrl}aggregate.json`,
      `${baseUrl}aggregate.csv`,
    ]);
    expect(en).not.toHaveProperty("license");
    expect(en).not.toHaveProperty("datePublished");
  });
  it("cannot describe a test artifact as a published dataset", () => {
    manifest.kind = "test";
    expect(() => releaseStructuredData(manifest, baseUrl, "en", "fixture")).toThrow(
      "published benchmarks",
    );
  });
});
