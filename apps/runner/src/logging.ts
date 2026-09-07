import { Console } from "node:console";
import { mkdir, open } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import {
  configure,
  getConsoleSink,
  getLogger,
  reset,
  withFilter,
  type LogRecord,
  type Sink,
} from "@logtape/logtape";
import { getFileSink } from "@logtape/file";
import { diagnosticMessage, redactDiagnostic } from "@llang-gap/providers";

export const logger = getLogger(["llang-gap", "runner"]);
const levels = ["debug", "info", "warning", "error"] as const;
const colors = { trace: 90, debug: 90, info: 36, warning: 33, error: 31, fatal: 31 };

function safeValue(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return redactDiagnostic(value);
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= 5) return "[omitted]";
  if (Array.isArray(value)) return value.slice(0, 100).map((v) => safeValue(v, depth + 1));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            !/^(?:prompt|output|expected|answer|raw|body|headers|apiKey|authorization|password|secret)$/i.test(
              key,
            ),
        )
        .map(([key, v]) => [key, safeValue(v, depth + 1)]),
    );
  return undefined;
}

function safeRecord(record: LogRecord): LogRecord {
  return {
    ...record,
    message: record.message.map((value) => safeValue(value)),
    properties: safeValue(record.properties) as Record<string, unknown>,
  };
}
const render = (record: LogRecord) =>
  record.message.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join("");

export function formatJson(record: LogRecord): string {
  const safe = safeRecord(record);
  return `${JSON.stringify({ timestamp: new Date(safe.timestamp).toISOString(), level: safe.level, category: safe.category.join("."), message: render(safe), properties: safe.properties })}\n`;
}

export function formatConsole(record: LogRecord, color = false): string {
  const safe = safeRecord(record);
  const p = safe.properties;
  const time = new Date(safe.timestamp).toISOString().slice(11, 19);
  const label = safe.level.toUpperCase().padEnd(7);
  const badge = color ? `\x1b[${colors[safe.level]}m${label}\x1b[0m` : label;
  const display = (value: unknown) =>
    typeof value === "string" || typeof value === "number" ? `${value}` : "?";
  const context =
    p.jobId && p.questionId
      ? `\n                 ${display(p.transport)}/${display(p.model)} · ${display(p.effort)} · ${display(p.language)} · q=${display(p.questionId)} · repeat=${display(p.repeat)} · try=${display(p.attempt)}/${display(p.maxAttempts)}`
      : "";
  const request = p.requestId ? ` · request=${display(p.requestId)}` : "";
  const hint = p.hint ? `\n                 ${display(p.hint)}` : "";
  return `${time} ${badge} ${render(safe)}${context}${request}${hint}\n`;
}

/** Configure only at the CLI boundary. Library calls remain silent until configured by their host. */
export async function configureLogging(env: NodeJS.ProcessEnv = process.env) {
  const requestedLevel = env.LLANG_LOG_LEVEL || "info";
  const level = levels.find((level) => level === requestedLevel);
  if (!level) throw new Error("LLANG_LOG_LEVEL must be debug, info, warning or error");
  const format = env.LLANG_LOG_FORMAT || "pretty";
  if (format !== "pretty" && format !== "json")
    throw new Error("LLANG_LOG_FORMAT must be pretty or json");
  const file = env.LLANG_LOG_FILE || "auto";
  const color = !!process.stderr.isTTY && env.NO_COLOR === undefined && env.TERM !== "dumb";
  const sessionId = randomUUID();
  const consoleSink = getConsoleSink({
    console: new Console({ stdout: process.stderr, stderr: process.stderr }),
    formatter: format === "json" ? formatJson : (record) => formatConsole(record, color),
  });
  let fileSink: (Sink & Disposable) | undefined;
  let fileFailed = false;
  let activeRunId: string | undefined;
  const routeToFile: Sink = (record) => {
    if (!fileSink || fileFailed) return;
    try {
      fileSink(record);
    } catch (error) {
      fileFailed = true;
      // Logging must not turn a saved/billable response into an execution failure.
      consoleSink({
        ...record,
        level: "error",
        message: [
          `Log file write failed: ${diagnosticMessage(error)}. Continuing with console logging; SQLite is still authoritative.`,
        ],
        properties: { event: "log.file_failed", sessionId },
      });
    }
  };
  const sessionSink =
    (sink: Sink): Sink =>
    (record) =>
      sink({
        ...record,
        properties: {
          ...(activeRunId ? { runId: activeRunId } : {}),
          ...record.properties,
          sessionId,
        },
      });
  async function openLog(path: string) {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const handle = await open(path, "a", 0o600);
    await handle.close();
    fileSink = getFileSink(path, { formatter: formatJson, bufferSize: 0, flushInterval: 0 });
    return path;
  }
  // An explicitly configured destination must be usable before any provider call.
  const explicitPath = file !== "auto" && file !== "off" ? await openLog(resolve(file)) : null;
  try {
    await configure({
      sinks: {
        console: sessionSink(withFilter(consoleSink, level)),
        file: sessionSink(routeToFile),
      },
      loggers: [
        { category: ["llang-gap"], lowestLevel: "debug", sinks: ["console", "file"] },
        { category: ["logtape", "meta"], lowestLevel: "warning", sinks: ["console"] },
      ],
    });
  } catch (error) {
    fileSink?.[Symbol.dispose]();
    throw error;
  }
  return {
    async openRun(runId: string, directory: string) {
      activeRunId = runId;
      const path = file === "auto" ? await openLog(join(directory, "runner.jsonl")) : explicitPath;
      logger.info("Run {runId} · saved in {directory}", { event: "run.ready", runId, directory });
      if (path) logger.info("Debug journal: {path}", { event: "log.file", runId, path });
    },
    async close() {
      try {
        await reset();
      } finally {
        try {
          fileSink?.[Symbol.dispose]();
        } catch (error) {
          process.stderr.write(`ERROR Log file close failed: ${diagnosticMessage(error)}\n`);
        }
      }
    },
  };
}
