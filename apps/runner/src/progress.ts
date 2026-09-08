import type { Logger } from "@logtape/logtape";
import type { Job } from "./plan";
import type { RunState } from "./state";

export const duration = (ms: number) =>
  ms < 1000
    ? `${Math.round(ms)}ms`
    : ms < 60_000
      ? `${(ms / 1000).toFixed(1)}s`
      : `${Math.floor(ms / 60_000)}m ${Math.floor(ms / 1000) % 60}s`;
export const money = (usd: number | null) => (usd === null ? "unknown" : `$${usd.toFixed(4)}`);

/** One periodic line, even when every worker is waiting on a slow provider or retry. */
export class RunProgress {
  readonly active = new Map<string, { job: Job; since: number }>();
  readonly retrying = new Set<string>();
  private readonly started = performance.now();
  private readonly initialCompleted: number;
  private lastReport = -Infinity;
  private readonly timer: ReturnType<typeof setInterval>;

  constructor(
    private readonly state: RunState,
    private readonly log: Logger,
  ) {
    this.initialCompleted = state.summary().completed;
    this.timer = setInterval(() => this.report(), 10_000);
    this.timer.unref();
  }
  report(force = false) {
    const now = performance.now();
    if (!force && now - this.lastReport < 5000) return;
    this.lastReport = now;
    const summary = this.state.summary();
    const oldest = [...this.active.values()].sort((a, b) => a.since - b.since)[0];
    const elapsedMs = now - this.started;
    const completedPerMinute =
      elapsedMs > 0 ? ((summary.completed - this.initialCompleted) * 60_000) / elapsedMs : 0;
    const waiting = oldest
      ? ` · oldest ${oldest.job.model.transport}/${oldest.job.model.model} ${oldest.job.request.language} ${duration(now - oldest.since)}`
      : "";
    this.log.info(
      "{completed}/{total} saved · {running} active · {retrying} retrying · {queued} queued · {failed} failed · {uncertain} uncertain · {cost} charged/reserved · {elapsed} elapsed{waiting}",
      {
        event: "run.progress",
        ...summary,
        running: this.active.size,
        retrying: this.retrying.size,
        queued: Math.max(0, summary.pending - this.retrying.size),
        cost: money(summary.chargedOrReservedUsd),
        elapsed: duration(elapsedMs),
        elapsedMs,
        completedPerMinute,
        waiting,
      },
    );
  }
  close() {
    clearInterval(this.timer);
  }
  get elapsedMs() {
    return performance.now() - this.started;
  }
}

export function reportConditions(state: RunState, log: Logger) {
  const conditions = state.conditionSummary();
  if (!conditions.some((condition) => condition.completed > 0)) return;
  log.info(
    "Observed answers by condition (saved responses only; incomplete coverage is provisional)",
    { event: "run.results" },
  );
  for (const condition of conditions) {
    const accuracy = condition.completed
      ? `${((100 * condition.correct) / condition.completed).toFixed(1)}%`
      : "n/a";
    log.info(
      "{transport}/{model} · {effort} · {language} | {completed}/{total} saved | {correct} correct ({accuracy}) | {unparsed} unparsed · {refusals} refused · {truncated} truncated",
      {
        event: "run.condition",
        ...condition,
        accuracy,
      },
    );
    log.debug(
      "{transport}/{model} · {effort} · {language} | tokens {inputTokens} in / {outputTokens} out · {usageMissing} responses with unknown usage",
      { event: "run.usage", ...condition },
    );
  }
}
