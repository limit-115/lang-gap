import type { ProviderAdapter, ItemResult } from "@llang-gap/contracts";
import { protocolV1, scoreAnswer } from "@llang-gap/evaluation";
import { calculateCost, normalizeError } from "@llang-gap/providers";
import { setTimeout as delay } from "node:timers/promises";
import type { Job } from "./plan";
import { RunState } from "./state";

export interface ExecuteOptions {
  state: RunState;
  jobs: readonly Job[];
  adapters: ReadonlyMap<string, ProviderAdapter>;
  budgetUsd: number;
  concurrency: number;
  maxAttempts: number;
  signal?: AbortSignal;
  maxJobs?: number;
  onProgress?: (summary: ReturnType<RunState["summary"]>) => void;
  sleep?: (milliseconds: number) => Promise<void>;
}

export async function execute(options: ExecuteOptions) {
  const { state, jobs, adapters, budgetUsd, concurrency, maxAttempts, signal } = options;
  if (!Number.isFinite(budgetUsd) || budgetUsd < 0)
    throw new Error("Budget must be a finite nonnegative USD amount");
  if (budgetUsd < state.charged())
    throw new Error("Budget is below already charged or reserved costs");
  const wait = options.sleep ?? ((ms) => delay(ms));
  const pending = state.pendingIds();
  const queue = jobs.filter((job) => pending.has(job.id));
  let started = 0;
  let stopped = false;
  let budgetExhausted = false;
  let charged = state.charged();
  const errors: unknown[] = [];
  const canStart = () => !stopped && !signal?.aborted && started < (options.maxJobs ?? Infinity);

  async function runJob(job: Job, adapter: ProviderAdapter) {
    while (!stopped && !signal?.aborted) {
      const prior = state.attemptsFor(job.id);
      if (prior >= maxAttempts) return;
      // No await between budget check and durable reservation; all workers share this process.
      if (charged + job.reservationUsd > budgetUsd + 1e-10) {
        stopped = true;
        budgetExhausted = true;
        state.event("budget-stop", { budgetUsd, requiredReservation: job.reservationUsd });
        return;
      }
      const attempt = state.begin(job);
      charged += job.reservationUsd;
      const start = performance.now();
      let response;
      try {
        response = await adapter.generate(job.request);
      } catch (cause) {
        const error = normalizeError(cause);
        const retry = error.retryable && prior + 1 < maxAttempts;
        state.fail(job, attempt, error, retry);
        if (!error.uncertain) charged -= job.reservationUsd;
        if (!error.retryable) stopped = true;
        if (!retry || signal?.aborted) return;
        await wait(Math.max(error.retryAfterMs, Math.min(30_000, 1000 * 2 ** prior)));
        continue;
      }
      const result: ItemResult = {
        jobId: job.id,
        questionId: job.questionId,
        category: job.category,
        language: job.request.language,
        repeat: job.repeat,
        provider: job.model.provider,
        model: job.model.model,
        returnedModel: response.model,
        effort: job.request.effort,
        prompt: job.request.prompt,
        output: response.text,
        expected: job.expected,
        ...scoreAnswer(
          response.text,
          job.request.language,
          job.expected,
          job.optionCount,
          response.outcome,
          job.protocol ?? protocolV1.id,
        ),
        outcome: response.outcome,
        usage: response.usage,
        costUsd: response.usage ? calculateCost(response.usage, job.model.pricing) : null,
        latencyMs: performance.now() - start,
        requestId: response.requestId,
      };
      state.complete(job, attempt, response, result);
      charged += (result.costUsd ?? job.reservationUsd) - job.reservationUsd;
      if ((result.costUsd ?? 0) > job.reservationUsd + 1e-10) {
        state.event("reservation-exceeded", {
          jobId: job.id,
          actualUsd: result.costUsd,
          reservationUsd: job.reservationUsd,
        });
        stopped = true;
        throw new Error(
          "Provider usage exceeded the reservation bound; review pricing before continuing",
        );
      }
      options.onProgress?.(state.summary());
      return;
    }
  }

  const workers = [...adapters.entries()].flatMap(([provider, adapter]) =>
    Array.from({ length: concurrency }, async () => {
      try {
        while (canStart()) {
          const index = queue.findIndex((job) => job.model.provider === provider);
          if (index === -1) return;
          const [job] = queue.splice(index, 1);
          if (!job) return;
          started++;
          await runJob(job, adapter);
        }
      } catch (error) {
        stopped = true;
        errors.push(error);
      }
    }),
  );
  await Promise.all(workers);
  state.event("execution-ended", {
    budgetUsd,
    started,
    interrupted: signal?.aborted ?? false,
    budgetExhausted,
  });
  if (errors.length) throw errors[0];
  return { ...state.summary(), budgetExhausted, interrupted: signal?.aborted ?? false };
}
