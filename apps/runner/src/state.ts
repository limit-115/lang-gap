import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { itemResultSchema, type GenerationResponse, type ItemResult } from "@llang-gap/contracts";
import type { Job } from "./plan";
import { json } from "./files";

const jobRowSchema = z.object({
  id: z.string(),
  payload: z.string(),
  status: z.string(),
  attempts: z.number(),
});
export type JobRow = z.infer<typeof jobRowSchema>;

export async function acquireLock(directory: string): Promise<() => Promise<void>> {
  const path = join(directory, "runner.lock");
  try {
    await mkdir(path);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    throw new Error("Run is locked. If its owner has exited, use `bench unlock <run-id>` first.");
  }
  await writeFile(
    join(path, "owner.json"),
    json({ pid: process.pid, hostname: hostname(), createdAt: new Date().toISOString() }),
  );
  return () => rm(path, { recursive: true });
}

export async function unlockRun(directory: string): Promise<void> {
  const path = join(directory, "runner.lock");
  const owner = z
    .object({ pid: z.number().int().positive(), hostname: z.string() })
    .parse(JSON.parse(await readFile(join(path, "owner.json"), "utf8")));
  if (owner.hostname !== hostname())
    throw new Error("Lock belongs to another host; unlock it on that host");
  try {
    process.kill(owner.pid, 0);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ESRCH") {
      await rm(path, { recursive: true });
      return;
    }
    throw error;
  }
  throw new Error(`Run owner ${owner.pid} is still alive`);
}

export class RunState {
  readonly db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(
      `PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;`,
    );
    const version = z
      .object({ user_version: z.number() })
      .parse(this.db.prepare("PRAGMA user_version").get()).user_version;
    if (version > 1) {
      this.db.close();
      throw new Error("Unsupported future SQLite schema");
    }
    if (version === 0)
      this.db.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE jobs (id TEXT PRIMARY KEY, ordinal INTEGER NOT NULL UNIQUE, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0);
      CREATE INDEX idx_jobs_status_ordinal ON jobs(status, ordinal);
      CREATE TABLE attempts (id INTEGER PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id), number INTEGER NOT NULL, started_at TEXT NOT NULL, finished_at TEXT, status TEXT NOT NULL, reserve_usd REAL NOT NULL, charged_usd REAL NOT NULL, error TEXT, request_id TEXT, raw TEXT, result TEXT, UNIQUE(job_id, number));
      CREATE TABLE events (id INTEGER PRIMARY KEY, created_at TEXT NOT NULL, kind TEXT NOT NULL, detail TEXT NOT NULL);
      PRAGMA user_version=1;
      COMMIT;
      PRAGMA optimize;
    `);
  }
  transaction<T>(work: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = work();
      this.db.exec("COMMIT");
      return value;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  initialize(jobs: readonly Job[]) {
    this.transaction(() => {
      const insert = this.db.prepare("INSERT INTO jobs(id, ordinal, payload) VALUES (?, ?, ?)");
      jobs.forEach((job, i) => insert.run(job.id, i, JSON.stringify(job)));
    });
  }
  event(kind: string, detail: unknown) {
    this.db
      .prepare("INSERT INTO events(created_at, kind, detail) VALUES (?, ?, ?)")
      .run(new Date().toISOString(), kind, JSON.stringify(detail));
  }
  rows(): JobRow[] {
    return z
      .array(jobRowSchema)
      .parse(this.db.prepare("SELECT id,payload,status,attempts FROM jobs ORDER BY ordinal").all());
  }
  pendingIds(): Set<string> {
    return new Set(
      z
        .array(z.object({ id: z.string() }))
        .parse(this.db.prepare("SELECT id FROM jobs WHERE status='pending' ORDER BY ordinal").all())
        .map((row) => row.id),
    );
  }
  attemptsFor(id: string): number {
    return z
      .object({ attempts: z.number() })
      .parse(this.db.prepare("SELECT attempts FROM jobs WHERE id=?").get(id)).attempts;
  }
  assertJobs(jobs: readonly Job[]): void {
    let index = 0;
    for (const raw of this.db
      .prepare("SELECT id,payload,status,attempts FROM jobs ORDER BY ordinal")
      .iterate()) {
      const row = jobRowSchema.parse(raw);
      const job = jobs[index++];
      if (!job || row.id !== job.id || row.payload !== JSON.stringify(job))
        throw new Error("SQLite job payload differs from the resolved experiment");
    }
    if (index !== jobs.length)
      throw new Error("SQLite job matrix differs from the resolved experiment");
  }
  charged(): number {
    return z
      .object({ total: z.number() })
      .parse(this.db.prepare("SELECT COALESCE(SUM(charged_usd),0) AS total FROM attempts").get())
      .total;
  }
  begin(job: Job): number {
    return this.transaction(() => {
      const row = jobRowSchema.parse(
        this.db.prepare("SELECT id,payload,status,attempts FROM jobs WHERE id=?").get(job.id),
      );
      if (row.status !== "pending") throw new Error("Only pending jobs can start");
      const number = row.attempts + 1;
      this.db
        .prepare("UPDATE jobs SET status='running', attempts=? WHERE id=?")
        .run(number, job.id);
      const result = this.db
        .prepare(
          "INSERT INTO attempts(job_id,number,started_at,status,reserve_usd,charged_usd) VALUES (?,?,?,'running',?,?)",
        )
        .run(job.id, number, new Date().toISOString(), job.reservationUsd, job.reservationUsd);
      return Number(result.lastInsertRowid);
    });
  }
  complete(job: Job, attempt: number, response: GenerationResponse, result: ItemResult) {
    this.transaction(() => {
      this.db
        .prepare(
          "UPDATE attempts SET finished_at=?,status='completed',charged_usd=?,request_id=?,raw=?,result=? WHERE id=?",
        )
        .run(
          new Date().toISOString(),
          result.costUsd ?? job.reservationUsd,
          response.requestId,
          JSON.stringify(response.raw),
          JSON.stringify(result),
          attempt,
        );
      this.db.prepare("UPDATE jobs SET status='completed' WHERE id=?").run(job.id);
    });
  }
  fail(
    job: Job,
    attempt: number,
    error: { message: string; uncertain: boolean; requestId: string | null },
    retry: boolean,
  ) {
    this.transaction(() => {
      this.db
        .prepare(
          "UPDATE attempts SET finished_at=?,status=?,charged_usd=?,error=?,request_id=? WHERE id=?",
        )
        .run(
          new Date().toISOString(),
          error.uncertain ? "uncertain" : "failed",
          error.uncertain ? job.reservationUsd : 0,
          error.message,
          error.requestId,
          attempt,
        );
      this.db
        .prepare("UPDATE jobs SET status=? WHERE id=?")
        .run(retry ? "pending" : "failed", job.id);
    });
  }
  recover(retryUncertain: boolean, maxAttempts: number, retryFailed = false) {
    this.transaction(() => {
      this.db
        .prepare(
          "UPDATE attempts SET status='uncertain', error='Process exited before durable completion' WHERE status='running'",
        )
        .run();
      this.db.prepare("UPDATE jobs SET status='uncertain' WHERE status='running'").run();
      if (retryUncertain) {
        this.db
          .prepare("UPDATE jobs SET status='pending' WHERE status='uncertain' AND attempts < ?")
          .run(maxAttempts);
        this.event("retry-uncertain", { maxAttempts });
      }
      if (retryFailed) {
        this.db
          .prepare("UPDATE jobs SET status='pending' WHERE status='failed' AND attempts < ?")
          .run(maxAttempts);
        this.event("retry-failed", { maxAttempts });
      }
    });
  }
  results(): ItemResult[] {
    const rows = z
      .array(z.object({ result: z.string() }))
      .parse(
        this.db
          .prepare("SELECT result FROM attempts WHERE status='completed' ORDER BY job_id")
          .all(),
      );
    return rows.map((row) => itemResultSchema.parse(JSON.parse(row.result)));
  }
  audit() {
    return this.db
      .prepare(
        "SELECT job_id,number,started_at,finished_at,status,reserve_usd,charged_usd,error,request_id FROM attempts ORDER BY id",
      )
      .all();
  }
  summary() {
    const rows = z
      .array(z.object({ status: z.string(), count: z.number() }))
      .parse(this.db.prepare("SELECT status,COUNT(*) AS count FROM jobs GROUP BY status").all());
    const counts = new Map(rows.map((row) => [row.status, row.count]));
    const attempts = z
      .object({ count: z.number() })
      .parse(this.db.prepare("SELECT COUNT(*) AS count FROM attempts").get()).count;
    return {
      total: rows.reduce((sum, row) => sum + row.count, 0),
      completed: counts.get("completed") ?? 0,
      pending: counts.get("pending") ?? 0,
      running: counts.get("running") ?? 0,
      failed: counts.get("failed") ?? 0,
      uncertain: counts.get("uncertain") ?? 0,
      attempts,
      chargedOrReservedUsd: this.charged(),
    };
  }
  close() {
    this.db.close();
  }
}
