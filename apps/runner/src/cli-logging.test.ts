import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, expect, it } from "vitest";
import { readManifest } from "@llang-gap/datasets";
import { createFakeAdapter } from "@llang-gap/providers";
import { experiment, questions } from "@tests/fixtures";
import { createRun } from "./run";
import { workspace } from "./files";

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

it("exits nonzero on a provider failure and exposes the saved reason through status", async () => {
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
    stopReason: "provider-error",
    failed: 1,
    completed: 1,
  });
  expect(failed.stderr).toContain("Provider HTTP 401: Access denied");
  expect(failed.stderr).toContain("req-auth-fixture");
  expect(failed.stderr).not.toMatch(/fixture-api-key|PRIVATE_BODY/);
  const status = await cli(["status", run.runId]);
  expect(JSON.parse(status.stdout).recentFailures[0]).toMatchObject({
    requestId: "req-auth-fixture",
    error: "Provider HTTP 401: Access denied for Bearer [REDACTED]",
  });
  expect(status.stderr).toContain("Provider HTTP 401: Access denied");
});

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
