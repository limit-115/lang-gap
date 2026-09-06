import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderAdapter } from "@llang-gap/contracts";
import { createFakeAdapter, ProviderError } from "@llang-gap/providers";
import { experiment, questions } from "../../../tests/fixtures";
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

  it("retries only technical failures, recording each attempt", async () => {
    const jobs = createJobs(experiment, questions, "fixed").slice(0, 2);
    state.initialize(jobs);
    const fake = createFakeAdapter();
    let calls = 0;
    const generate = vi.fn(async (request: Parameters<ProviderAdapter["generate"]>[0]) => {
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
    const generate = vi.fn(async (request: Parameters<ProviderAdapter["generate"]>[0]) => {
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
    const adapter: ProviderAdapter = {
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
    const adapter: ProviderAdapter = {
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
    const generate = vi.fn(async (request: Parameters<ProviderAdapter["generate"]>[0]) => {
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
