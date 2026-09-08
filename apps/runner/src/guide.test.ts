import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ReleaseManifest } from "@llang-gap/contracts";
import type { GuidePlan, ReleaseEvidence } from "@llang-gap/contracts/guide";
import { hash, json } from "./files";
import { publishGuide, verifyGuide } from "./guide";

describe("published guide artifacts", () => {
  let root: string;
  let plan: GuidePlan;
  let planPath: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "llang-guide-test-"));
    planPath = join(root, "plan.json");
    const evidence: ReleaseEvidence = {
      schemaVersion: 1,
      releaseId: "fixture",
      runCreatedAt: "2026-09-08T00:00:00.000Z",
      configHash: "a".repeat(64),
      datasetManifestHash: "b".repeat(64),
      protocolHash: "c".repeat(64),
      configurations: [{ transport: "openrouter", model: "fixture/model", maxOutputTokens: 2048 }],
      languages: [
        {
          language: "ja",
          n: 4,
          inputHash: "d".repeat(64),
          alignmentHash: "e".repeat(64),
          randomBaseline: 0.25,
        },
      ],
    };
    const manifest: ReleaseManifest = {
      schemaVersion: 3,
      id: "fixture",
      runId: "fixture-run",
      kind: "benchmark",
      createdAt: "2026-09-08T00:00:00.000Z",
      dataset: "synthetic",
      datasetRevision: "fixture",
      languages: ["ja"],
      comparisons: [],
      protocol: "multiple-choice-v1",
      configHash: "a".repeat(64),
      files: { "dataset-manifest.json": evidence.datasetManifestHash },
      aggregate: [
        {
          transport: "openrouter",
          model: "fixture/model",
          effort: "low",
          repeats: 1,
          scores: [{ language: "ja", n: 4, accuracy: 0.75, repeatAccuracy: [0.75] }],
          comparisons: [],
          unparseable: 0,
          refusals: 0,
          costUsd: null,
        },
      ],
    };
    manifest.files["aggregate.json"] = hash(json(manifest.aggregate));
    await mkdir(join(root, "fixture"));
    await writeFile(join(root, "fixture/manifest.json"), json(manifest));
    await writeFile(join(root, "fixture/aggregate.json"), json(manifest.aggregate));
    await writeFile(join(root, "fixture/evidence.json"), json(evidence));
    await writeFile(
      join(root, "index.json"),
      json({ schemaVersion: 1, latest: "fixture", releases: ["fixture"] }),
    );
    plan = {
      schemaVersion: 1,
      suite: {
        id: "suite-v1",
        families: [{ id: "reasoning", weight: 1 }],
        tasks: [
          {
            id: "synthetic",
            family: "reasoning",
            weight: 1,
            dataset: "synthetic",
            datasetRevision: "fixture",
            datasetManifestHash: evidence.datasetManifestHash,
            protocol: manifest.protocol,
            protocolHash: evidence.protocolHash,
            maxOutputTokens: 2048,
            repeats: 1,
            languages: evidence.languages,
          },
        ],
      },
      profiles: [{ transport: "openrouter", model: "fixture/model", effort: "low" }],
      releases: ["fixture"],
    };
    await writeFile(planPath, json(plan));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("recomputes a stored guide without private state, credentials or network calls", async () => {
    await publishGuide(planPath, "guide-one", root);
    expect(await verifyGuide("guide-one", root)).toEqual({
      valid: true,
      id: "guide-one",
      models: 1,
    });
    const original = await readFile(join(root, "guide/guide-one/summary.json"));
    await expect(publishGuide(planPath, "guide-one", root)).rejects.toThrow("already exists");
    expect(await readFile(join(root, "guide/guide-one/summary.json"))).toEqual(original);
    await publishGuide(planPath, "guide-two", root);
    expect(await verifyGuide("guide-one", root)).toMatchObject({ valid: true });
    expect(await verifyGuide("guide-two", root)).toMatchObject({ valid: true });
  });
  it("versions configuration rows while keeping the legacy guide reproducible", async () => {
    await publishGuide(planPath, "legacy", root);
    plan.configurationRows = true;
    await writeFile(planPath, json(plan));
    await expect(publishGuide(planPath, "same-suite", root)).rejects.toThrow("new suite ID");
    plan.suite.id = "configurations-v2";
    await writeFile(planPath, json(plan));
    await publishGuide(planPath, "configurations", root);
    expect(await verifyGuide("legacy", root)).toMatchObject({ valid: true });
    expect(await verifyGuide("configurations", root)).toMatchObject({ valid: true });
  });
  it("requires a new suite identity for changed weights or model settings", async () => {
    await publishGuide(planPath, "guide-one", root);
    plan.suite.tasks[0]!.weight = 2;
    await writeFile(planPath, json(plan));
    await expect(publishGuide(planPath, "changed-weights", root)).rejects.toThrow("new suite ID");
    plan.suite.tasks[0]!.weight = 1;
    plan.profiles[0]!.effort = "high";
    await writeFile(planPath, json(plan));
    await expect(publishGuide(planPath, "changed-profile", root)).rejects.toThrow("new suite ID");
    plan.suite.id = "suite-v2";
    await writeFile(planPath, json(plan));
    await publishGuide(planPath, "guide-two", root);
    expect(await verifyGuide("guide-one", root)).toMatchObject({ valid: true });
  });
  it("detects a changed source even when the source's own checksum has been updated", async () => {
    await publishGuide(planPath, "guide-one", root);
    const sourcePath = join(root, "fixture/manifest.json");
    const source = JSON.parse(await readFile(sourcePath, "utf8")) as ReleaseManifest;
    source.aggregate[0]!.scores[0]!.accuracy = 1;
    source.aggregate[0]!.scores[0]!.repeatAccuracy = [1];
    source.files["aggregate.json"] = hash(json(source.aggregate));
    await writeFile(sourcePath, json(source));
    await writeFile(join(root, "fixture/aggregate.json"), json(source.aggregate));
    await expect(verifyGuide("guide-one", root)).rejects.toThrow("do not reproduce");
  });
  it("rejects a corrupted guide and prevents building on a modified previous suite", async () => {
    await publishGuide(planPath, "guide-one", root);
    await writeFile(join(root, "guide/guide-one/summary.json"), "{}");
    await expect(verifyGuide("guide-one", root)).rejects.toThrow("checksum");
    await expect(publishGuide(planPath, "guide-two", root)).rejects.toThrow("checksum");
  });
  it("rejects an unindexed source or an aggregate with different bytes", async () => {
    plan.releases = ["missing"];
    await writeFile(planPath, json(plan));
    await expect(publishGuide(planPath, "guide-one", root)).rejects.toThrow("Unpublished release");
    plan.releases = ["fixture"];
    await writeFile(planPath, json(plan));
    await writeFile(join(root, "fixture/aggregate.json"), "[]");
    await expect(publishGuide(planPath, "guide-one", root)).rejects.toThrow(
      "Invalid published aggregate",
    );
  });
});
