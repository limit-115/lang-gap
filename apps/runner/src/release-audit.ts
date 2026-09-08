import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { ItemResult } from "@llang-gap/contracts";
import type { Job } from "./plan";
import { readJson } from "./files";

const attemptSchema = z.strictObject({
  job_id: z.string(),
  number: z.number().int().positive(),
  started_at: z.iso.datetime(),
  finished_at: z.iso.datetime().nullable(),
  status: z.enum(["completed", "failed", "uncertain"]),
  charged_usd: z.number().nonnegative().nullable(),
  error: z.string().nullable(),
  request_id: z.string().nullable(),
});

export async function verifyAttemptLedger(
  directory: string,
  jobs: readonly Job[],
  items: readonly ItemResult[],
) {
  const rows = (await readFile(join(directory, "attempts.jsonl"), "utf8"))
    .trimEnd()
    .split("\n")
    .map((line) => attemptSchema.parse(JSON.parse(line)));
  const jobMap = new Map(jobs.map((job) => [job.id, job]));
  const itemMap = new Map(items.map((item) => [item.jobId, item]));
  const numbers = new Map<string, number>();
  const completed = new Set<string>();
  let total = 0;
  let unknown = false;
  for (const attempt of rows) {
    const job = jobMap.get(attempt.job_id);
    if (!job || attempt.number !== (numbers.get(job.id) ?? 0) + 1 || completed.has(job.id))
      throw new Error("Invalid attempt ledger sequence");
    numbers.set(job.id, attempt.number);
    const item = itemMap.get(job.id);
    const charged =
      attempt.status === "completed"
        ? (item?.costUsd ?? null)
        : attempt.status === "uncertain"
          ? null
          : 0;
    if (attempt.charged_usd !== charged) throw new Error("Attempt ledger cost does not reproduce");
    if (charged === null) unknown = true;
    else total += charged;
    if (attempt.status === "completed") {
      if (!item || !attempt.finished_at || attempt.request_id !== item.requestId)
        throw new Error("Attempt ledger does not match selected response");
      completed.add(job.id);
    }
  }
  if (completed.size !== jobs.length) throw new Error("Attempt ledger is incomplete");
  const execution = z
    .object({
      summary: z.strictObject({
        total: z.number(),
        completed: z.number(),
        pending: z.literal(0),
        running: z.literal(0),
        failed: z.literal(0),
        uncertain: z.literal(0),
        attempts: z.number(),
        chargedUsd: z.number().nullable(),
      }),
    })
    .parse(await readJson(join(directory, "execution.json")));
  if (
    execution.summary.total !== jobs.length ||
    execution.summary.completed !== jobs.length ||
    execution.summary.attempts !== rows.length ||
    (unknown
      ? execution.summary.chargedUsd !== null
      : execution.summary.chargedUsd === null ||
        Math.abs(execution.summary.chargedUsd - total) > 1e-9)
  )
    throw new Error("Execution totals do not reproduce from the attempt ledger");
}
