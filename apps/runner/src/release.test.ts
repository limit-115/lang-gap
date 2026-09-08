import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readManifest } from "@llang-gap/datasets";
import { createFakeAdapter } from "@llang-gap/transports";
import { releaseManifestSchema, type TransportAdapter } from "@llang-gap/contracts";
import { experiment, questions } from "@tests/fixtures";
import { createRun, resumeRun } from "./run";
import { buildRelease, scoreRun, stageRelease, verifyRelease } from "./release";
import { workspace, hash, json, readJson } from "./files";
import { RunState } from "./state";
import { snapshotSchema } from "./snapshot";
import * as files from "./files";
import { createReleaseEvidence } from "./release-evidence";
import { verifyGuidePublication, syncGuide } from "./guide";
import { protocol, protocolV1 } from "@llang-gap/evaluation";

describe("run → resume → independent release verification", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "llang-release-"));
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });
  const manifest = async () => {
    const pinned = await readManifest(join(workspace, "datasets/mmlu-prox-lite/manifest.json"));
    if (pinned.schemaVersion !== 1) throw new Error("Expected pinned schema-v1 fixture");
    return {
      ...pinned,
      files: pinned.files.map((file) => ({
        ...file,
        rows: questions.filter((q) => q.language === file.language && q.split === file.split)
          .length,
      })),
    };
  };

  it("stages a complete intercepted benchmark and refreshes the homepage in the same operation", async () => {
    const identity = await files.implementationIdentity(workspace);
    vi.spyOn(files, "implementationIdentity").mockResolvedValue({
      ...identity,
      clean: true,
      commit: "a".repeat(40),
    });
    const config = {
      ...experiment,
      questionLimit: undefined,
      models: experiment.models.map((model) => ({
        ...model,
        transport: "openrouter" as const,
        model: "fixture/model",
        efforts: ["high" as const],
      })),
    };
    const directory = join(root, "run");
    await createRun({
      directory,
      experiment: config,
      questions,
      manifest: await manifest(),
      adapters: new Map([
        ["openrouter", { ...createFakeAdapter(), transport: "openrouter" as const }],
      ]),
    });
    const artifact = await buildRelease(directory, "publication-fixture", "benchmark", root);
    const evidence = await createReleaseEvidence(artifact.directory);
    const results = join(root, "results");
    await mkdir(results);
    await writeFile(
      join(results, "index.json"),
      json({ schemaVersion: 1, latest: null, releases: [] }),
    );
    await writeFile(
      join(results, "guide-plan.json"),
      json({
        schemaVersion: 1,
        configurationRows: true,
        suite: {
          id: "test-suite",
          families: [{ id: "reasoning", weight: 1 }],
          tasks: [
            {
              id: "test-task",
              family: "reasoning",
              weight: 1,
              dataset: config.dataset,
              datasetRevision: (await manifest()).revision,
              datasetManifestHash: evidence.datasetManifestHash,
              protocol: config.protocol,
              protocolHash: evidence.protocolHash,
              maxOutputTokens: 1024,
              repeats: config.repeats,
              languages: evidence.languages,
            },
          ],
        },
        profiles: [],
        releases: [],
      }),
    );
    const staged = await stageRelease(artifact.directory, "https://example.com/assets", results);
    expect(staged.guide.changed).toBe(true);
    expect(await verifyGuidePublication(results)).toMatchObject({
      valid: true,
      id: staged.guide.id,
    });
    const snapshot = (await readJson(join(results, "guide", staged.guide.id, "summary.json"))) as {
      models: { profile: { effort: string } }[];
    };
    expect(snapshot.models.map((model) => model.profile.effort)).toEqual(["high"]);
    expect(await syncGuide(results)).toEqual({ id: staged.guide.id, changed: false });
  });

  it("completes a paused run without reissuing completed jobs and exports an auditable test release", async () => {
    const directory = join(root, "run");
    const fake = createFakeAdapter();
    const generate = vi.fn(fake.generate);
    const adapters = new Map<string, TransportAdapter>([["fake", { ...fake, generate }]]);
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

  it.each([false, true])(
    "preserves optional accounting through resume and release (priced: %s)",
    async (priced) => {
      const directory = join(root, "optional-cost");
      const config = {
        ...experiment,
        models: experiment.models.map(({ pricing, ...model }) => ({
          ...model,
          transport: "openrouter" as const,
          model: "fixtures/model:free",
          efforts: ["xhigh", "max"] as ("xhigh" | "max")[],
          ...(priced ? { pricing } : {}),
        })),
      };
      const adapter = { ...createFakeAdapter(), transport: "openrouter" as const };
      const adapters = new Map([["openrouter", adapter]]);
      const first = await createRun({
        directory,
        experiment: config,
        questions,
        manifest: await manifest(),
        adapters,
        maxJobs: 1,
      });
      expect(first.completed).toBe(1);
      const original = await readFile(join(directory, "resolved.json"), "utf8");
      expect(snapshotSchema.parse(JSON.parse(original)).initialBudgetUsd).toBeNull();
      const done = await resumeRun(directory, { adapters });
      expect(done.chargedOrReservedUsd).toBe(priced ? 0 : null);
      const artifact = await buildRelease(directory, "optional-cost-release", "test", root);
      const verified = await verifyRelease(artifact.directory);
      expect(verified.aggregate).toHaveLength(2);
      expect(verified.aggregate.every((row) => row.costUsd === (priced ? 0 : null))).toBe(true);
      expect(await readFile(join(directory, "resolved.json"), "utf8")).toBe(original);
    },
  );

  it("retains the last explicit budget on a later resume", async () => {
    const directory = join(root, "budget-history");
    await createRun({
      directory,
      experiment,
      questions,
      manifest: await manifest(),
      budgetUsd: 1,
      maxJobs: 1,
    });
    await resumeRun(directory, { budgetUsd: 2, maxJobs: 1 });
    await resumeRun(directory, { maxJobs: 1 });
    const state = new RunState(join(directory, "state.sqlite"));
    try {
      expect(state.lastBudget(null)).toBe(2);
    } finally {
      state.close();
    }
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

  it.each([protocolV1.id, protocol.id])(
    "uses the recorded parser through resume and release verification (%s)",
    async (protocolId) => {
      const directory = join(root, "versioned");
      const config = {
        ...experiment,
        protocol: protocolId,
        models: experiment.models.map((m) => ({ ...m, maxOutputTokens: 2048 })),
      };
      const fake = createFakeAdapter();
      const generate = vi.fn(async (request: Parameters<typeof fake.generate>[0]) => ({
        ...(await fake.generate(request)),
        text:
          request.language === "en"
            ? "The answer is (B). Explanation follows."
            : "Ответ - (B). Объяснение после ответа.",
      }));
      const adapters = new Map([["fake", { ...fake, generate }]]);
      await createRun({
        directory,
        experiment: config,
        questions,
        manifest: await manifest(),
        budgetUsd: 0,
        maxJobs: 1,
        adapters,
      });
      const original = await readFile(join(directory, "resolved.json"), "utf8");
      await resumeRun(directory, { budgetUsd: 0, adapters });
      expect(generate).toHaveBeenCalledTimes(12);
      const state = new RunState(join(directory, "state.sqlite"));
      const rows = state.results();
      state.close();
      expect(rows.every((r) => r.answer === (protocolId === protocol.id ? "B" : null))).toBe(true);
      const release = await buildRelease(directory, "versioned-release", "test", root);
      expect((await verifyRelease(release.directory)).protocol).toBe(protocolId);
      expect(await readFile(join(directory, "resolved.json"), "utf8")).toBe(original);
    },
  );

  it("rejects a protocol substitution even after the snapshot identity is rehashed", async () => {
    const directory = join(root, "mismatch");
    await createRun({
      directory,
      experiment,
      questions,
      manifest: await manifest(),
      budgetUsd: 0,
      maxJobs: 1,
    });
    const path = join(directory, "resolved.json");
    const snapshot = snapshotSchema.parse(await readJson(path));
    snapshot.experiment.protocol = protocol.id;
    const modified = json(snapshot);
    await writeFile(path, modified);
    await writeFile(join(directory, "identity.json"), json({ configHash: hash(modified) }));
    await expect(resumeRun(directory, { budgetUsd: 0 })).rejects.toThrow(
      "Protocol implementation differs",
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
    const adapter: TransportAdapter = {
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

  it("scores and retains cap-limited v3 responses while keeping the publication gate", async () => {
    const directory = join(root, "author-cap");
    const fake = createFakeAdapter();
    const adapter: TransportAdapter = {
      ...fake,
      async generate(request) {
        return {
          ...(await fake.generate(request)),
          outcome: "truncated",
          text: request.language === "en" ? "The answer is (B). Further explanation" : "",
        };
      },
    };
    await createRun({
      directory,
      experiment: {
        ...experiment,
        protocol: protocol.id,
        models: experiment.models.map((m) => ({ ...m, maxOutputTokens: 2048 })),
      },
      questions,
      manifest: await manifest(),
      budgetUsd: 0,
      adapters: new Map([["fake", adapter]]),
    });
    const state = new RunState(join(directory, "state.sqlite"));
    const rows = state.results();
    state.close();
    expect(rows).toHaveLength(12);
    expect(rows.every((r) => r.outcome === "truncated")).toBe(true);
    expect(rows.filter((r) => r.language === "en").every((r) => r.answer === "B")).toBe(true);
    expect(
      rows.filter((r) => r.language === "ru").every((r) => !r.correct && r.answer === null),
    ).toBe(true);
    await expect(buildRelease(directory, "author-cap-release", "test", root)).rejects.toThrow(
      "Truncation",
    );
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
