import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, expect, it } from "vitest";
import { readManifest } from "@llang-gap/datasets";
import { createFakeAdapter } from "@llang-gap/transports";
import { experiment, questions } from "@tests/fixtures";
import { createRun } from "./run";
import { workspace, hash, json } from "./files";
import { createJobs } from "./plan";
import { readSnapshot } from "./snapshot";
import { RunState } from "./state";

let temp: string;
const runs: string[] = [];
beforeEach(async () => {
  temp = await mkdtemp(join(tmpdir(), "llang-cli-logs-"));
});
afterEach(async () => {
  for (const directory of runs.splice(0)) await rm(directory, { recursive: true, force: true });
  await rm(temp, { recursive: true, force: true });
});

async function seed(transport: "fake" | "openrouter" = "fake") {
  const manifest = await readManifest(join(workspace, "datasets/mmlu-prox-lite/manifest.json"));
  if (manifest.schemaVersion !== 1) throw new Error("Expected pinned schema-v1 fixture");
  const result = await createRun({
    experiment: {
      ...experiment,
      id: "logging-test",
      models: experiment.models.map((m) => ({
        ...m,
        transport,
        model: transport === "fake" ? "fixture-model" : "fixtures/model",
      })),
    },
    questions,
    manifest: {
      ...manifest,
      files: manifest.files.map((f) => ({
        ...f,
        rows: questions.filter((q) => q.language === f.language && q.split === f.split).length,
      })),
    },
    adapters: new Map([[transport, { ...createFakeAdapter(), transport }]]),
    maxJobs: 1,
  });
  runs.push(result.directory);
  return result;
}

function cli(
  args: string[],
  env: NodeJS.ProcessEnv = {},
  preload?: string,
  onLog?: (child: ReturnType<typeof spawn>, chunk: string) => void,
) {
  const processArgs = [
    ...(preload ? ["--import", pathToFileURL(preload).href] : []),
    "--import",
    "tsx",
    join(workspace, "apps/runner/src/cli.ts"),
    ...args,
  ];
  const child = spawn(process.execPath, processArgs, {
    cwd: workspace,
    env: {
      ...process.env,
      LLANG_LOG_FILE: "auto",
      LLANG_LOG_LEVEL: "info",
      LLANG_LOG_FORMAT: "pretty",
      NO_COLOR: "1",
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (bytes: Buffer) => {
      stdout += bytes.toString();
    });
    child.stderr.on("data", (bytes: Buffer) => {
      stderr += bytes.toString();
      onLog?.(child, bytes.toString());
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

it("keeps stdout JSON clean, appends resume sessions, and reports durable condition results", async () => {
  const run = await seed();
  const first = await cli(["--json", "resume", run.runId, "--max-jobs", "1"]);
  expect(first.code).toBe(0);
  expect(JSON.parse(first.stdout)).toMatchObject({ stopReason: "max-jobs", completed: 2 });
  expect(first.stderr).toContain("Resuming saved experiment");
  expect(first.stderr).not.toContain("Request started");
  const before = await readFile(join(run.directory, "runner.jsonl"), "utf8");
  expect(before).toContain('"event":"request.started"');
  const second = await cli(["resume", run.runId], { LLANG_LOG_FORMAT: "json" });
  expect(second.code).toBe(0);
  expect(JSON.parse(second.stdout)).toMatchObject({ stopReason: "completed", completed: 12 });
  const logs = second.stderr
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(logs.some((r) => r.properties.event === "run.finished")).toBe(true);
  expect(await readFile(join(run.directory, "runner.jsonl"), "utf8")).toContain(before);
  const status = await cli(["status", run.runId]);
  expect(JSON.parse(status.stdout).conditions).toHaveLength(2);
  expect(status.stderr).toContain("Observed answers by condition");
});

it("exits nonzero on a transport failure and exposes the saved reason through status", async () => {
  const run = await seed("openrouter");
  const preload = join(temp, "intercept.mjs");
  await writeFile(
    preload,
    `globalThis.fetch = async () => Response.json({ error: { message: "Access denied for Bearer fixture-api-key", metadata: { raw: "PRIVATE_BODY" } } }, { status: 401, headers: { "x-request-id": "req-auth-fixture" } });`,
  );
  const failed = await cli(
    ["--json", "resume", run.runId, "--concurrency", "1"],
    { OPENROUTER_API_KEY: "fixture-api-key" },
    preload,
  );
  expect(failed.code).toBe(1);
  expect(JSON.parse(failed.stdout)).toMatchObject({
    stopReason: "transport-error",
    failed: 1,
    completed: 1,
  });
  expect(failed.stderr).toContain("Transport HTTP 401: Access denied");
  expect(failed.stderr).toContain("req-auth-fixture");
  expect(failed.stderr).not.toMatch(/fixture-api-key|PRIVATE_BODY/);
  const status = await cli(["status", run.runId]);
  expect(JSON.parse(status.stdout).recentFailures[0]).toMatchObject({
    requestId: "req-auth-fixture",
    error: "Transport HTTP 401: Access denied for Bearer [REDACTED]",
  });
  expect(status.stderr).toContain("Transport HTTP 401: Access denied");
});

it.each([
  { kind: "failed", limit: 3 },
  { kind: "uncertain", limit: 3 },
  { kind: "failed", limit: 5 },
] as const)(
  "explains exhausted $kind retries at limit $limit and preserves saved work",
  async ({ kind, limit }) => {
    const run = await seed();
    const { snapshot, configHash } = await readSnapshot(run.directory);
    const jobs = createJobs(snapshot.experiment, questions, configHash, snapshot.datasetManifest);
    const state = new RunState(join(run.directory, "state.sqlite"));
    try {
      const pending = state.pendingIds();
      for (const job of jobs.filter((job) => pending.has(job.id))) {
        for (let number = 1; number <= limit; number++) {
          const attempt = state.begin(job);
          if (kind === "uncertain" && number === limit) break;
          state.fail(
            job,
            attempt,
            { message: "Synthetic HTTP 429", uncertain: false, requestId: null },
            number < limit,
          );
        }
      }
      state.recover(false, limit);
      const saved = state.results();
      const audit = state.audit();
      const snapshotText = await readFile(join(run.directory, "resolved.json"), "utf8");
      const flag = `--retry-${kind}`;
      const withoutRetry = await cli(["resume", run.runId]);
      expect(withoutRetry.code).toBe(1);
      expect(withoutRetry.stderr).not.toContain("Retry blocked");
      const blocked = await cli([
        "resume",
        run.runId,
        flag,
        ...(limit === 5 ? ["--max-attempts", "5"] : []),
      ]);
      expect(blocked.code).toBe(1);
      expect(JSON.parse(blocked.stdout)).toMatchObject({
        completed: 1,
        [kind]: 11,
        pending: 0,
        attempts: 1 + 11 * limit,
      });
      expect(blocked.stderr).toContain(`Retry blocked by the total attempt limit (${limit})`);
      expect(blocked.stderr).toContain("Retry flags do not reset recorded attempts");
      expect(state.results()).toEqual(saved);
      expect(state.audit()).toEqual(audit);
      if (limit === 5) {
        expect(blocked.stderr).toContain("The maximum supported limit is 5");
        expect(blocked.stderr).not.toContain("Use a higher --max-attempts");
        return;
      }
      expect(blocked.stderr).toContain("Use a higher --max-attempts (up to 5)");

      const resumed = await cli(["resume", run.runId, flag, "--max-attempts", "5"]);
      expect(resumed.code).toBe(0);
      expect(JSON.parse(resumed.stdout)).toMatchObject({
        completed: 12,
        failed: 0,
        uncertain: 0,
        attempts: 45,
      });
      expect(resumed.stderr).not.toContain("Retry blocked");
      expect(state.results()).toEqual(expect.arrayContaining(saved));
      expect(state.audit().slice(0, audit.length)).toEqual(audit);
      expect(await readFile(join(run.directory, "resolved.json"), "utf8")).toBe(snapshotText);
    } finally {
      state.close();
    }
  },
);

it("formats CLI usage failures and leaves help successful", async () => {
  const result = await cli(["--json", "resume", "missing", "--concurrency", "0"], {
    LLANG_LOG_FORMAT: "json",
    LLANG_LOG_FILE: "off",
  });
  expect(result.code).toBe(1);
  expect(JSON.parse(result.stdout)).toHaveProperty("error");
  expect(JSON.parse(result.stderr.trim()).properties.event).toBe("cli.usage_error");
  const help = await cli(["--help"]);
  expect(help.code).toBe(0);
  expect(help.stdout).toContain("Usage: bench");
});

it.each([
  ["SIGINT", 130],
  ["SIGTERM", 143],
] as const)("drains an active request on %s and returns exit %s", async (signal, exitCode) => {
  const run = await seed("openrouter");
  const preload = join(temp, "slow-transport.mjs");
  await writeFile(
    preload,
    `globalThis.fetch = async () => { await new Promise(resolve => setTimeout(resolve, 100)); return Response.json({ id: "req-drained", model: "fixtures/model", choices: [{ finish_reason: "stop", message: { content: "The answer is (B)" } }], usage: { prompt_tokens: 20, completion_tokens: 5 } }); };`,
  );
  let sent = false;
  const result = await cli(
    ["--json", "resume", run.runId, "--concurrency", "1"],
    { OPENROUTER_API_KEY: "fixture-api-key", LLANG_LOG_LEVEL: "debug" },
    preload,
    (child, text) => {
      if (!sent && text.includes("Request started")) {
        sent = true;
        child.kill(signal);
      }
    },
  );
  expect(sent).toBe(true);
  expect(result.code).toBe(exitCode);
  expect(JSON.parse(result.stdout)).toMatchObject({
    stopReason: "interrupted",
    completed: 2,
    running: 0,
    attempts: 2,
  });
  expect(result.stderr).toContain(`${signal}: stopping dispatch`);
  const logs = await readFile(join(run.directory, "runner.jsonl"), "utf8");
  expect(logs).toContain('"event":"request.completed"');
  expect(logs).toContain('"event":"run.finished"');
});

it("does not create a run journal when resume rejects an incompatible runtime", async () => {
  const run = await seed();
  const snapshotPath = join(run.directory, "resolved.json");
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  snapshot.implementation.sha256 = "0".repeat(64);
  const content = json(snapshot);
  await writeFile(snapshotPath, content);
  await writeFile(join(run.directory, "identity.json"), json({ configHash: hash(content) }));
  const database = await readFile(join(run.directory, "state.sqlite"));
  const refused = await cli(["--json", "resume", run.runId]);
  expect(refused.code).toBe(1);
  expect(JSON.parse(refused.stdout).error).toContain("restore the recorded implementation");
  await expect(readFile(join(run.directory, "runner.jsonl"))).rejects.toMatchObject({
    code: "ENOENT",
  });
  expect(await readFile(join(run.directory, "state.sqlite"))).toEqual(database);
});
