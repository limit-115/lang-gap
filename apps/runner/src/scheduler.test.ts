import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TransportAdapter } from "@llang-gap/contracts";
import { createFakeAdapter, ProviderError } from "@llang-gap/providers";
import { experiment, questions } from "@tests/fixtures";
import { createJobs } from "./plan";
import { execute } from "./scheduler";
import { acquireLock, RunState } from "./state";

describe("durable execution", () => {
  let directory: string;
  let state: RunState;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "llang-runner-"));
    state = new RunState(join(directory, "state.sqlite"));
  });
  afterEach(async () => {
    state.close();
    await rm(directory, { recursive: true, force: true });
  });

  it("dispatches multiple models through one transport adapter with shared concurrency", async () => {
    const models = ["openai/gpt-5-nano", "anthropic/test-model"].map((model) => ({
      ...experiment.models[0]!,
      transport: "openrouter" as const,
      model,
    }));
    const jobs = createJobs({ ...experiment, models }, questions, "router");
    state.initialize(jobs);
    const fake = createFakeAdapter();
    let active = 0;
    let peak = 0;
    const adapter: TransportAdapter = {
      ...fake,
      transport: "openrouter",
      generate: vi.fn(async (request) => {
        peak = Math.max(peak, ++active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active--;
        return fake.generate(request);
      }),
    };
    const adapters = new Map([["openrouter", adapter]]);
    const options = { state, jobs, adapters, budgetUsd: 0, concurrency: 2, maxAttempts: 1 };
    await execute({ ...options, maxJobs: 3 });
    const result = await execute(options);
    expect(result.completed).toBe(jobs.length);
    expect(peak).toBeLessThanOrEqual(2);
    expect(adapter.generate).toHaveBeenCalledTimes(jobs.length);
    for (const model of models) {
      expect(state.results().filter((result) => result.model === model.model)).toHaveLength(
        jobs.length / 2,
      );
    }
  });

  it("retries only technical failures, recording each attempt", async () => {
    const jobs = createJobs(experiment, questions, "fixed").slice(0, 2);
    state.initialize(jobs);
    const fake = createFakeAdapter();
    let calls = 0;
    const generate = vi.fn(async (request: Parameters<TransportAdapter["generate"]>[0]) => {
      if (++calls === 1) throw new ProviderError("429", true, false);
      return { ...(await fake.generate(request)), text: "Unparseable answer" };
    });
    const result = await execute({
      state,
      jobs,
      adapters: new Map([["fake", { ...fake, generate }]]),
      budgetUsd: 0,
      concurrency: 1,
      maxAttempts: 3,
      sleep: async () => {},
    });
    expect(result).toMatchObject({ completed: 2, attempts: 3, failed: 0 });
    expect(generate).toHaveBeenCalledTimes(3);
    expect(state.results().every((r) => !r.correct && r.answer === null)).toBe(true);
    expect(state.audit()).toHaveLength(3);
  });

  it("reserves concurrent requests before dispatching and stops at the budget", async () => {
    const jobs = createJobs(experiment, questions, "budget")
      .slice(0, 4)
      .map((job) => ({ ...job, reservationUsd: 1 }));
    state.initialize(jobs);
    const fake = createFakeAdapter();
    let finish: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const generate = vi.fn(async (request: Parameters<TransportAdapter["generate"]>[0]) => {
      await gate;
      return { ...(await fake.generate(request)), usage: null };
    });
    const pending = execute({
      state,
      jobs,
      adapters: new Map([["fake", { ...fake, generate }]]),
      budgetUsd: 1.5,
      concurrency: 3,
      maxAttempts: 3,
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(state.charged()).toBe(1);
    finish?.();
    const result = await pending;
    expect(result).toMatchObject({
      completed: 1,
      pending: 3,
      budgetExhausted: true,
      chargedOrReservedUsd: 1,
    });
    expect(state.results()[0]?.costUsd).toBeNull();
  });

  it("retains a conservative charge for ambiguous transport retries", async () => {
    const jobs = createJobs(experiment, questions, "uncertain")
      .slice(0, 1)
      .map((job) => ({ ...job, reservationUsd: 1 }));
    state.initialize(jobs);
    const fake = createFakeAdapter();
    let calls = 0;
    const adapter: TransportAdapter = {
      ...fake,
      async generate(request) {
        if (++calls === 1) throw new ProviderError("timeout", true, true);
        return fake.generate(request);
      },
    };
    const result = await execute({
      state,
      jobs,
      adapters: new Map([["fake", adapter]]),
      budgetUsd: 2,
      concurrency: 1,
      maxAttempts: 2,
      sleep: async () => {},
    });
    expect(result).toMatchObject({ completed: 1, attempts: 2, chargedOrReservedUsd: 1 });
  });

  it("stops new dispatch on authentication failures", async () => {
    const jobs = createJobs(experiment, questions, "auth");
    state.initialize(jobs);
    const adapter: TransportAdapter = {
      ...createFakeAdapter(),
      generate: vi.fn(() => Promise.reject(new ProviderError("401", false, false))),
    };
    const result = await execute({
      state,
      jobs,
      adapters: new Map([["fake", adapter]]),
      budgetUsd: 0,
      concurrency: 1,
      maxAttempts: 3,
    });
    expect(result).toMatchObject({ failed: 1, pending: 11, attempts: 1 });
    expect(adapter.generate).toHaveBeenCalledTimes(1);
  });

  it("drains active calls on cancellation and preserves completed responses on resume", async () => {
    const jobs = createJobs(experiment, questions, "stop");
    state.initialize(jobs);
    const stop = new AbortController();
    const fake = createFakeAdapter();
    const generate = vi.fn(async (request: Parameters<TransportAdapter["generate"]>[0]) => {
      stop.abort();
      return fake.generate(request);
    });
    await execute({
      state,
      jobs,
      adapters: new Map([["fake", { ...fake, generate }]]),
      budgetUsd: 0,
      concurrency: 1,
      maxAttempts: 3,
      signal: stop.signal,
    });
    expect(state.summary().completed).toBe(1);
    const saved = state.results()[0];
    const more = vi.fn(fake.generate);
    await execute({
      state,
      jobs,
      adapters: new Map([["fake", { ...fake, generate: more }]]),
      budgetUsd: 0,
      concurrency: 2,
      maxAttempts: 3,
    });
    expect(more).toHaveBeenCalledTimes(11);
    expect(state.results()).toContainEqual(saved);
  });

  it("marks unfinished durable requests uncertain after restart", async () => {
    const jobs = createJobs(experiment, questions, "crash")
      .slice(0, 2)
      .map((job) => ({ ...job, reservationUsd: 1 }));
    state.initialize(jobs);
    state.begin(jobs[0]!);
    state.close();
    state = new RunState(join(directory, "state.sqlite"));
    state.recover(false, 3);
    expect(state.summary()).toMatchObject({ uncertain: 1, pending: 1, chargedOrReservedUsd: 1 });
    state.recover(true, 3);
    expect(state.summary()).toMatchObject({ uncertain: 0, pending: 2, chargedOrReservedUsd: 1 });
  });

  it("runs and resumes without rates or budget while preserving unknown charges", async () => {
    const config = {
      ...experiment,
      models: experiment.models.map(({ pricing: _pricing, ...model }) => model),
    };
    const jobs = createJobs(config, questions, "unpriced").slice(0, 3);
    state.initialize(jobs);
    const fake = createFakeAdapter();
    let calls = 0;
    const generate = vi.fn(async (request: Parameters<TransportAdapter["generate"]>[0]) => {
      if (++calls === 1) throw new ProviderError("timeout", true, true);
      return fake.generate(request);
    });
    const options = {
      state,
      jobs,
      adapters: new Map([["fake", { ...fake, generate }]]),
      concurrency: 1,
      maxAttempts: 3,
      sleep: async () => {},
    };
    const first = await execute({ ...options, maxJobs: 1 });
    expect(first).toMatchObject({ completed: 1, attempts: 2, chargedOrReservedUsd: null });
    await expect(execute({ ...options, budgetUsd: 100 })).rejects.toThrow("requires prices");
    const resumed = await execute(options);
    expect(resumed).toMatchObject({ completed: 3, attempts: 4, chargedOrReservedUsd: null });
    expect(generate).toHaveBeenCalledTimes(4);
    expect(state.results().every((item) => item.costUsd === null && item.usage !== null)).toBe(
      true,
    );
    expect(state.audit().every((row) => row.reserve_usd === null && row.charged_usd === null)).toBe(
      true,
    );
  });

  it("does not impose a reservation stop without a budget", async () => {
    const jobs = createJobs(experiment, questions, "unbounded")
      .slice(0, 1)
      .map((job) => ({
        ...job,
        reservationUsd: 0,
        model: {
          ...job.model,
          pricing: { ...experiment.models[0]!.pricing!, outputPerMillion: 100 },
        },
      }));
    state.initialize(jobs);
    const result = await execute({
      state,
      jobs,
      adapters: new Map([["fake", createFakeAdapter()]]),
      concurrency: 1,
      maxAttempts: 1,
    });
    expect(result.completed).toBe(1);
    expect(result.chargedOrReservedUsd).toBeGreaterThan(0);
  });

  it("enforces exclusive run ownership", async () => {
    const unlock = await acquireLock(directory);
    try {
      await expect(acquireLock(directory)).rejects.toThrow("locked");
    } finally {
      await unlock();
    }
    const again = await acquireLock(directory);
    await again();
  });
});
