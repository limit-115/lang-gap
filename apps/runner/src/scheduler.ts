import type { Logger } from "@logtape/logtape";
import type { TransportAdapter, ItemResult } from "@llang-gap/contracts";
import { scoreAnswer } from "@llang-gap/evaluation";
import { calculateCost, normalizeError, diagnosticError } from "@llang-gap/transports";
import { setTimeout as delay } from "node:timers/promises";
import type { Job } from "./plan";
import { RunState } from "./state";
import { logger } from "./logging";
import { duration, money, reportConditions, RunProgress } from "./progress";

export interface ExecuteOptions {
  state: RunState;
  jobs: readonly Job[];
  adapters: ReadonlyMap<string, TransportAdapter>;
  concurrency: number;
  maxAttempts: number;
  signal?: AbortSignal;
  maxJobs?: number;
  onProgress?: (summary: ReturnType<RunState["summary"]>) => void;
  sleep?: (milliseconds: number) => Promise<void>;
  logger?: Logger;
}

export async function execute(options: ExecuteOptions) {
  const { state, jobs, adapters, concurrency, maxAttempts, signal } = options;
  const log = options.logger ?? logger;
  const retryStop = new AbortController();
  const retrySignal = signal ? AbortSignal.any([signal, retryStop.signal]) : retryStop.signal;
  const wait =
    options.sleep ??
    ((ms) =>
      delay(ms, undefined, { signal: retrySignal }).catch((error: unknown) => {
        if (!retrySignal.aborted) throw error;
      }));
  const pending = state.pendingIds();
  const queue = jobs.filter((job) => pending.has(job.id));
  let started = 0;
  let stopped = false;
  const errors: unknown[] = [];
  let transportStopped = false;
  const progress = new RunProgress(state, log);
  const stopDispatch = () => {
    stopped = true;
    retryStop.abort();
  };
  const canStart = () => !stopped && !signal?.aborted && started < (options.maxJobs ?? Infinity);

  async function runJob(job: Job, adapter: TransportAdapter) {
    while (!stopped && !signal?.aborted) {
      const prior = state.attemptsFor(job.id);
      if (prior >= maxAttempts) {
        log.warning(
          "Job {jobId} already reached the attempt limit ({maxAttempts}); raise --max-attempts to continue",
          { event: "request.attempt_limit", jobId: job.id, maxAttempts },
        );
        return;
      }
      const attempt = state.begin(job);
      const requestLog = log.with({
        jobId: job.id,
        questionId: job.questionId,
        transport: job.model.transport,
        model: job.model.model,
        effort: job.request.effort,
        language: job.request.language,
        repeat: job.repeat,
        attempt: prior + 1,
        maxAttempts,
      });
      requestLog.debug("Request started", { event: "request.started" });
      const start = performance.now();
      progress.active.set(job.id, { job, since: start });
      let response;
      try {
        response = await adapter.generate(job.request);
      } catch (cause) {
        const error = normalizeError(cause, [job.request.prompt]);
        const retry = error.retryable && prior + 1 < maxAttempts;
        state.fail(job, attempt, error, retry);
        if (!error.retryable) {
          transportStopped = true;
          stopDispatch();
        }
        const willRetry = retry && !stopped && !signal?.aborted;
        const retryDelayMs = Math.max(error.retryAfterMs, Math.min(30_000, 1000 * 2 ** prior));
        const action = willRetry
          ? `Retry in ${duration(retryDelayMs)}`
          : !error.retryable
            ? "Non-retryable; stopping dispatch"
            : retry
              ? "Retry deferred until resume"
              : "Attempt limit reached";
        const hint =
          error.status === 402
            ? "Check the API service account balance or credits, then resume with --retry-failed."
            : error.status === 401 || error.status === 403
              ? "Check this transport's API key and model access, then resume with --retry-failed."
              : error.status === 400 || error.status === 404 || error.status === 422
                ? "Check the model, effort and request settings; changing experiment inputs requires a new run."
                : !willRetry
                  ? "Inspect the error, then resume with --retry-failed and a higher --max-attempts if needed."
                  : undefined;
        requestLog[retry ? "warning" : "error"]("{errorMessage} · {action} · billing {billing}", {
          event: willRetry ? "request.retry" : "request.failed",
          errorMessage: error.message,
          status: error.status,
          code: error.code,
          requestId: error.requestId,
          retryable: error.retryable,
          uncertain: error.uncertain,
          retryDelayMs: willRetry ? retryDelayMs : null,
          latencyMs: performance.now() - start,
          action,
          billing: error.uncertain ? "unknown" : "no charge recorded",
          hint,
        });
        progress.active.delete(job.id);
        options.onProgress?.(state.summary());
        if (!willRetry) {
          progress.report();
          return;
        }
        progress.retrying.add(job.id);
        progress.report();
        try {
          await wait(retryDelayMs);
        } finally {
          progress.retrying.delete(job.id);
        }
        continue;
      }
      const result: ItemResult = {
        jobId: job.id,
        questionId: job.questionId,
        category: job.category,
        language: job.request.language,
        repeat: job.repeat,
        transport: job.model.transport,
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
          job.protocol,
        ),
        outcome: response.outcome,
        usage: response.usage,
        costUsd: response.usage ? calculateCost(response.usage, job.model.pricing) : null,
        latencyMs: performance.now() - start,
        requestId: response.requestId,
      };
      state.complete(job, attempt, response, result);
      progress.active.delete(job.id);
      const anomalies = [
        response.outcome === "truncated" ? "truncated response" : null,
        response.outcome === "refusal" ? "API refusal" : null,
        result.answer === null ? "unparseable answer" : null,
        response.usage === null ? "usage unknown" : null,
      ].filter(Boolean);
      requestLog[anomalies.length ? "warning" : "debug"](
        "Response saved · {latency} · {outcomeSummary} · cost {cost}",
        {
          event: "request.completed",
          latencyMs: result.latencyMs,
          latency: duration(result.latencyMs),
          outcome: response.outcome,
          parsed: result.answer !== null,
          correct: result.correct,
          outcomeSummary: anomalies.length
            ? anomalies.join(", ")
            : result.correct
              ? "correct"
              : "incorrect",
          usage: response.usage,
          costUsd: result.costUsd,
          cost: money(result.costUsd),
          requestId: response.requestId,
          returnedModel: response.model,
        },
      );
      options.onProgress?.(state.summary());
      progress.report();
      return;
    }
  }

  log.info(
    "Dispatching {pending}/{total} jobs · concurrency {concurrency} per transport · up to {maxAttempts} attempts/job",
    {
      event: "run.dispatch",
      pending: queue.length,
      total: jobs.length,
      concurrency,
      maxAttempts,
      maxJobs: options.maxJobs ?? null,
    },
  );
  progress.report(true);
  try {
    const workers = [...new Set(jobs.map((job) => job.model.transport))].flatMap((transport) =>
      Array.from({ length: concurrency }, async () => {
        try {
          while (canStart()) {
            const index = queue.findIndex((job) => job.model.transport === transport);
            if (index === -1) return;
            const [job] = queue.splice(index, 1);
            if (!job) return;
            const adapter = adapters.get(transport);
            if (!adapter) throw new Error(`Missing adapter: ${transport}/${job.model.model}`);
            started++;
            await runJob(job, adapter);
          }
        } catch (error) {
          stopDispatch();
          errors.push(error);
          log.error("Execution error: {message}; draining active calls", {
            event: "run.error",
            ...diagnosticError(error),
          });
        }
      }),
    );
    await Promise.all(workers);
    state.event("execution-ended", {
      started,
      interrupted: signal?.aborted ?? false,
    });
    const summary = state.summary();
    const stopReason = errors.length
      ? "execution-error"
      : transportStopped
        ? "transport-error"
        : signal?.aborted
          ? "interrupted"
          : summary.completed === summary.total
            ? "completed"
            : summary.failed > 0
              ? "failed"
              : summary.uncertain > 0
                ? "uncertain"
                : started >= (options.maxJobs ?? Infinity)
                  ? "max-jobs"
                  : "attempt-limit";
    progress.report(true);
    const failed =
      errors.length > 0 ||
      transportStopped ||
      summary.failed > 0 ||
      summary.uncertain > 0 ||
      stopReason === "attempt-limit";
    log[
      failed
        ? "error"
        : stopReason === "completed" || stopReason === "max-jobs"
          ? "info"
          : "warning"
    ](
      "Execution ended: {stopReason} · {completed}/{total} saved · {failed} failed · {pending} pending · {uncertain} uncertain · {elapsed} · {cost} charged",
      {
        event: "run.finished",
        ...summary,
        stopReason,
        elapsedMs: progress.elapsedMs,
        elapsed: duration(progress.elapsedMs),
        cost: money(summary.chargedUsd),
      },
    );
    reportConditions(state, log);
    if (errors.length) throw errors[0];
    return { ...summary, stopReason, interrupted: signal?.aborted ?? false };
  } finally {
    progress.close();
  }
}
