import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { configure, getLogger, reset, type LogRecord } from "@logtape/logtape";
import { createFakeAdapter, normalizeError, TransportError } from "@llang-gap/transports";
import { experiment, questions } from "@tests/fixtures";
import { createJobs } from "./plan";
import { execute } from "./scheduler";
import { RunState } from "./state";
import { configureLogging, formatConsole, formatJson } from "./logging";

let directory: string;
let state: RunState;
const records: LogRecord[] = [];
const log = getLogger(["llang-gap", "test"]).with({ runId: "synthetic-run", dataset: "fixture" });
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "llang-logging-"));
  state = new RunState(join(directory, "state.sqlite"));
  records.length = 0;
  await configure({
    sinks: {
      test: (record) => {
        records.push(record);
      },
    },
    loggers: [
      { category: ["llang-gap"], lowestLevel: "debug", sinks: ["test"] },
      { category: ["logtape", "meta"], lowestLevel: "warning", sinks: [] },
    ],
  });
});
afterEach(async () => {
  await reset();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  state.close();
  await rm(directory, { recursive: true, force: true });
});
const event = (name: string) => records.filter((r) => r.properties.event === name);
const options = () => {
  const jobs = createJobs(experiment, questions, "logs").slice(0, 2);
  state.initialize(jobs);
  return { jobs, state, concurrency: 1, maxAttempts: 3, logger: log };
};

it("reports a slow in-flight request before any response, then clears the heartbeat", async () => {
  vi.useFakeTimers();
  const input = options();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fake = createFakeAdapter();
  const work = execute({
    ...input,
    adapters: new Map([
      [
        "fake",
        {
          ...fake,
          async generate(request) {
            await gate;
            return fake.generate(request);
          },
        },
      ],
    ]),
  });
  await vi.advanceTimersByTimeAsync(10_000);
  expect(event("run.progress").at(-1)?.properties).toMatchObject({
    completed: 0,
    running: 1,
    elapsedMs: 10_000,
  });
  expect(event("run.progress").at(-1)?.properties.waiting).toContain("10.0s");
  release();
  expect((await work).stopReason).toBe("completed");
  expect(event("request.started")).toHaveLength(2);
  expect(event("request.completed").every((record) => record.level === "debug")).toBe(true);
  expect(event("run.finished")).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(0);
  const text = records.map(formatJson).join("");
  expect(text).not.toContain(input.jobs[0]!.request.prompt);
  expect(text).not.toContain('"expected"');
  expect(event("request.started")[0]?.properties).toMatchObject({
    runId: "synthetic-run",
    dataset: "fixture",
    jobId: input.jobs[0]!.id,
    attempt: 1,
    maxAttempts: 3,
  });
});

it("reports retries while waiting and cancels backoff immediately on interruption", async () => {
  vi.useFakeTimers();
  const input = options();
  const stop = new AbortController();
  const generate = vi.fn(() =>
    Promise.reject(
      normalizeError(
        Object.assign(new Error("Rate limit exceeded"), {
          status: 429,
          headers: new Headers({ "retry-after": "300", "x-request-id": "req-limit" }),
        }),
      ),
    ),
  );
  const work = execute({
    ...input,
    signal: stop.signal,
    adapters: new Map([["fake", { ...createFakeAdapter(), generate }]]),
  });
  await vi.advanceTimersByTimeAsync(10_000);
  expect(event("request.retry")[0]).toMatchObject({
    level: "warning",
    properties: {
      status: 429,
      requestId: "req-limit",
      retryDelayMs: 300_000,
      errorMessage: "Transport HTTP 429: Rate limit exceeded",
    },
  });
  expect(event("run.progress").at(-1)?.properties).toMatchObject({
    running: 0,
    retrying: 1,
    completed: 0,
  });
  stop.abort();
  expect(await work).toMatchObject({ stopReason: "interrupted", pending: 2, attempts: 1 });
  expect(generate).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it("reports the final failed attempt as error and retains the diagnostic in status", async () => {
  const input = options();
  const generate = vi.fn(() =>
    Promise.reject(new TransportError("upstream overloaded", true, true, "req-failure")),
  );
  const result = await execute({
    ...input,
    maxAttempts: 2,
    sleep: async () => {},
    adapters: new Map([["fake", { ...createFakeAdapter(), generate }]]),
  });
  expect(result).toMatchObject({ stopReason: "failed", failed: 2, attempts: 4 });
  expect(event("request.retry")).toHaveLength(2);
  expect(event("request.failed")).toHaveLength(2);
  expect(event("request.failed").every((r) => r.level === "error")).toBe(true);
  expect(event("run.finished")[0]).toMatchObject({ level: "error", properties: { failed: 2 } });
  expect(state.recentFailures(1)[0]).toMatchObject({
    error: "upstream overloaded",
    attempt: 2,
    requestId: "req-failure",
  });
});

it("records answer-quality warnings as completed answers without retrying", async () => {
  const input = options();
  const fake = createFakeAdapter();
  const generate = vi.fn(async (request: Parameters<typeof fake.generate>[0]) => ({
    ...(await fake.generate(request)),
    text: "NO_PARSE_SYNTHETIC_RESPONSE",
    outcome: "truncated" as const,
    usage: null,
  }));
  const result = await execute({ ...input, adapters: new Map([["fake", { ...fake, generate }]]) });
  expect(result).toMatchObject({ completed: 2, failed: 0, attempts: 2 });
  expect(event("request.completed").every((r) => r.level === "warning")).toBe(true);
  expect(state.conditionSummary().reduce((sum, row) => sum + row.truncated, 0)).toBe(2);
  expect(state.conditionSummary().reduce((sum, row) => sum + row.usageMissing, 0)).toBe(2);
  expect(records.map(formatJson).join("")).not.toContain("NO_PARSE_SYNTHETIC_RESPONSE");
});

it("separates console severity from the appended debug journal and respects NO_COLOR", async () => {
  await reset();
  const writes = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  const logging = await configureLogging({ LLANG_LOG_LEVEL: "warning", NO_COLOR: "1" });
  try {
    await logging.openRun("synthetic-run", directory);
    log.debug("Request fixture", { event: "fixture.debug" });
    log.warning("Warning fixture", { event: "fixture.warning" });
  } finally {
    await logging.close();
  }
  expect(writes.mock.calls.map(([text]) => String(text)).join("")).toContain("Warning fixture");
  expect(writes.mock.calls.map(([text]) => String(text)).join("")).not.toContain("Request fixture");
  const path = join(directory, "runner.jsonl");
  const first = await readFile(path, "utf8");
  expect(first).toContain('"event":"fixture.debug"');
  expect((await stat(path)).mode & 0o777).toBe(0o600);
  const resumed = await configureLogging({ LLANG_LOG_FILE: path, NO_COLOR: "1" });
  try {
    log.info("Resumed fixture", { event: "fixture.resumed" });
  } finally {
    await resumed.close();
  }
  expect((await readFile(path, "utf8")).startsWith(first)).toBe(true);
  const rows = (await readFile(path, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(new Set(rows.map((row) => row.properties.sessionId)).size).toBe(2);
});

it("redacts diagnostic secrets and control characters in both formats", () => {
  vi.stubEnv("OPENROUTER_API_KEY", "synthetic-secret-9876");
  log.error("Failure {message}", {
    event: "test.error",
    message: "synthetic-secret-9876 Bearer private-token sk-abcdef\n\x1b[31m",
    raw: { secret: "PRIVATE_RAW" },
    prompt: "PRIVATE_PROMPT",
  });
  for (const rendered of [formatConsole(records[0]!), formatJson(records[0]!)]) {
    expect(rendered).not.toMatch(
      /synthetic-secret-9876|private-token|sk-abcdef|PRIVATE_RAW|PRIVATE_PROMPT/,
    );
    expect(rendered).not.toContain(String.fromCharCode(27));
    expect(rendered).toContain("[REDACTED]");
  }
});

it("validates logging configuration before dispatch and supports disabling file logging", async () => {
  await reset();
  await expect(configureLogging({ LLANG_LOG_LEVEL: "verbose" })).rejects.toThrow("LLANG_LOG_LEVEL");
  await expect(configureLogging({ LLANG_LOG_FORMAT: "yaml" })).rejects.toThrow("LLANG_LOG_FORMAT");
  await expect(configureLogging({ LLANG_LOG_FILE: directory })).rejects.toThrow();
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
  const logging = await configureLogging({ LLANG_LOG_FILE: "off" });
  try {
    await logging.openRun("synthetic-run", directory);
  } finally {
    await logging.close();
  }
  await expect(stat(join(directory, "runner.jsonl"))).rejects.toThrow();
});
