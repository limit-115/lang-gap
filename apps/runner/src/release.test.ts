import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readManifest } from "@llang-gap/datasets";
import { createFakeAdapter } from "@llang-gap/providers";
import {
  experimentSchema,
  releaseManifestSchema,
  type ProviderAdapter,
} from "@llang-gap/contracts";
import { protocol, protocolV2 } from "@llang-gap/evaluation";
import { experiment, questions } from "@tests/fixtures";
import { createRun, resumeRun } from "./run";
import { buildRelease, scoreRun, stageRelease, verifyRelease } from "./release";
import { workspace, hash, json, readJson } from "./files";
import { RunState } from "./state";
import { readSnapshot, snapshotSchema } from "./snapshot";

describe("run → resume → independent release verification", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "llang-release-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const manifest = () => readManifest(join(workspace, "datasets/mmlu-prox-lite/manifest.json"));

  it("completes a paused run without reissuing completed jobs and exports an auditable test release", async () => {
    const directory = join(root, "run");
    const fake = createFakeAdapter();
    const generate = vi.fn(fake.generate);
    const adapters = new Map<string, ProviderAdapter>([["fake", { ...fake, generate }]]);
    const first = await createRun({
      directory,
      experiment,
      questions,
      manifest: await manifest(),
      budgetUsd: 0,
      maxJobs: 2,
      adapters,
    });
    expect(first.completed).toBe(2);
    await expect(buildRelease(directory, "incomplete", "test", root)).rejects.toThrow("Incomplete");
    const resumed = await resumeRun(directory, { budgetUsd: 0, adapters });
    expect(resumed.completed).toBe(12);
    expect(generate).toHaveBeenCalledTimes(12);
    const scores = await scoreRun(directory);
    expect(scores.aggregate).toHaveLength(1);
    const release = await buildRelease(directory, "test-release", "test", root);
    expect((await verifyRelease(release.directory)).kind).toBe("test");
    await expect(stageRelease(release.directory, "https://example.com/assets")).rejects.toThrow(
      "Test releases",
    );
    await expect(buildRelease(directory, "test-release", "test", root)).rejects.toThrow(
      "already exists",
    );
    const saved = await readFile(join(release.directory, "items.jsonl"), "utf8");
    expect(saved).not.toContain("API_KEY");
    await writeFile(join(release.directory, "items.jsonl"), `${saved} `);
    await expect(verifyRelease(release.directory)).rejects.toThrow("checksum");
  });

  it("resumes and independently verifies a v2 stratified test release but rejects benchmark promotion", async () => {
    const directory = join(root, "v2-run");
    const model = experiment.models[0]!;
    const v2Experiment = experimentSchema.parse({
      ...experiment,
      protocol: protocolV2.id,
      questionLimit: undefined,
      questionsPerCategory: 2,
      models: [
        {
          ...model,
          provider: "openai",
          model: "gpt-5-nano-2025-08-07",
          pricing: { ...model.pricing, inputPerMillion: 1, outputPerMillion: 1 },
        },
      ],
    });
    const fake = createFakeAdapter();
    const generate = vi.fn(fake.generate);
    const adapters = new Map<string, ProviderAdapter>([
      ["openai", { ...fake, name: "openai", generate }],
    ]);
    const first = await createRun({
      directory,
      experiment: v2Experiment,
      questions,
      manifest: await manifest(),
      budgetUsd: 1,
      maxJobs: 2,
      adapters,
    });
    expect(first.completed).toBe(2);
    const { snapshot } = await readSnapshot(directory);
    expect(snapshot.protocol).toEqual(protocolV2);
    expect(snapshot.protocolHash).toBe(hash(json(protocolV2)));
    expect(snapshot.experiment.questionsPerCategory).toBe(2);
    expect(snapshot.experiment.questionLimit).toBeUndefined();
    const resumed = await resumeRun(directory, { budgetUsd: 1, adapters });
    expect(resumed.completed).toBe(8);
    expect(generate).toHaveBeenCalledTimes(8);
    for (const [request] of generate.mock.calls) {
      expect(request.prompt).toContain(
        request.language === "en" ? "[BEGIN TARGET QUESTION]" : "[НАЧАЛО ЦЕЛЕВОГО ВОПРОСА]",
      );
      expect(request.prompt).not.toContain("PRIVATE_TEST_SOLUTION");
    }
    const scores = await scoreRun(directory);
    expect(scores.aggregate).toHaveLength(1);
    expect(scores.aggregate[0]).toMatchObject({ n: 2, repeats: 2, unparseable: 0 });
    const release = await buildRelease(directory, "v2-test-release", "test", root);
    expect(await verifyRelease(release.directory)).toMatchObject({
      kind: "test",
      protocol: protocolV2.id,
      aggregate: scores.aggregate,
    });
    expect((await readSnapshot(release.directory)).snapshot).toEqual(snapshot);
    await expect(buildRelease(directory, "v2-benchmark", "benchmark", root)).rejects.toThrow(
      "Synthetic or subset runs cannot become benchmark releases",
    );
  });

  it("rejects a v1 protocol snapshot for a v2 experiment even when its hashes were recomputed", async () => {
    const directory = join(root, "v2-tampered");
    await createRun({
      directory,
      experiment: { ...experiment, protocol: protocolV2.id },
      questions,
      manifest: await manifest(),
      budgetUsd: 0,
      maxJobs: 1,
    });
    const { snapshot } = await readSnapshot(directory);
    snapshot.protocol = protocol;
    snapshot.protocolHash = hash(json(protocol));
    const modified = json(snapshot);
    await writeFile(join(directory, "resolved.json"), modified);
    await writeFile(join(directory, "identity.json"), json({ configHash: hash(modified) }));
    await expect(readSnapshot(directory)).rejects.toThrow("Protocol implementation differs");
    await expect(resumeRun(directory, { budgetUsd: 0 })).rejects.toThrow(
      "Protocol implementation differs",
    );
  });

  it("detects scientific configuration and SQLite job tampering", async () => {
    const directory = join(root, "run");
    await createRun({
      directory,
      experiment,
      questions,
      manifest: await manifest(),
      budgetUsd: 0,
      maxJobs: 1,
    });
    const state = new RunState(join(directory, "state.sqlite"));
    state.db.prepare("UPDATE jobs SET payload='{}' WHERE ordinal=1").run();
    state.close();
    await expect(resumeRun(directory, { budgetUsd: 0 })).rejects.toThrow("payload differs");
    const path = join(directory, "resolved.json");
    const content = await readFile(path, "utf8");
    await writeFile(path, content.replace('"seed": 42', '"seed": 43'));
    await expect(resumeRun(directory, { budgetUsd: 0 })).rejects.toThrow(
      "configuration was modified",
    );
  });

  it("requires the recorded scoring implementation for release reproduction", async () => {
    const directory = join(root, "run");
    await createRun({ directory, experiment, questions, manifest: await manifest(), budgetUsd: 0 });
    const path = join(directory, "resolved.json");
    const snapshot = snapshotSchema.parse(await readJson(path));
    snapshot.implementation.sha256 = "0".repeat(64);
    const modified = json(snapshot);
    await writeFile(path, modified);
    await writeFile(join(directory, "identity.json"), json({ configHash: hash(modified) }));
    await expect(scoreRun(directory)).rejects.toThrow("Scoring implementation differs");
  });

  it("blocks releases with truncated responses", async () => {
    const directory = join(root, "run");
    const fake = createFakeAdapter();
    const adapter: ProviderAdapter = {
      ...fake,
      async generate(request) {
        return { ...(await fake.generate(request)), outcome: "truncated" };
      },
    };
    await createRun({
      directory,
      experiment,
      questions,
      manifest: await manifest(),
      budgetUsd: 0,
      adapters: new Map([["fake", adapter]]),
    });
    await expect(buildRelease(directory, "bad", "test", root)).rejects.toThrow("Truncation");
  });

  it("rejects fabricated saved correctness even with unchanged output", async () => {
    const directory = join(root, "run");
    await createRun({ directory, experiment, questions, manifest: await manifest(), budgetUsd: 0 });
    const state = new RunState(join(directory, "state.sqlite"));
    state.db
      .prepare(
        "UPDATE attempts SET result=json_set(result, '$.correct', json(CASE WHEN json_extract(result,'$.correct') THEN 'false' ELSE 'true' END)) WHERE id=1",
      )
      .run();
    state.close();
    await expect(buildRelease(directory, "fabricated", "test", root)).rejects.toThrow(
      "does not reproduce",
    );
  });

  it("recomputes financial totals even when the file checksum was updated", async () => {
    const directory = join(root, "run");
    await createRun({ directory, experiment, questions, manifest: await manifest(), budgetUsd: 0 });
    const release = await buildRelease(directory, "audit", "test", root);
    const executionPath = join(release.directory, "execution.json");
    const original = await readFile(executionPath, "utf8");
    const modified = original.replace('"chargedOrReservedUsd": 0', '"chargedOrReservedUsd": 1');
    await writeFile(executionPath, modified);
    const releasePath = join(release.directory, "manifest.json");
    const releaseData = releaseManifestSchema.parse(await readJson(releasePath));
    releaseData.files["execution.json"] = hash(modified);
    await writeFile(releasePath, json(releaseData));
    await expect(verifyRelease(release.directory)).rejects.toThrow("Execution totals");
  });
});
