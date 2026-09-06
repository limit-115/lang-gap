import { experimentSchema, questionSchema, type ItemResult } from "@llang-gap/contracts";
import questionData from "@tests/fixtures/questions.json";

export const questions = questionData.map((q) => questionSchema.parse(q));
export const experiment = experimentSchema.parse({
  schemaVersion: 1,
  id: "test-v1",
  dataset: "mmlu-prox-lite",
  protocol: "mmluprox-lite-5shot-native-reasoning-v1",
  languages: ["en", "ru"],
  repeats: 2,
  seed: 42,
  questionLimit: 3,
  models: [
    {
      provider: "fake",
      model: "fake-v1",
      efforts: ["low"],
      maxOutputTokens: 1024,
      pricing: {
        asOf: "2026-09-06",
        source: "https://example.org/pricing",
        inputPerMillion: 0,
        cachedInputPerMillion: 0,
        cacheWritePerMillion: 0,
        cacheWrite1hPerMillion: 0,
        outputPerMillion: 0,
      },
    },
  ],
  execution: { concurrency: 2, maxAttempts: 3, timeoutMs: 1000 },
});
export function item(overrides: Partial<ItemResult> = {}): ItemResult {
  return {
    jobId: "j",
    questionId: "q",
    category: "math",
    language: "en",
    repeat: 0,
    provider: "fake",
    model: "fake-v1",
    returnedModel: "fake-v1",
    effort: "low",
    prompt: "Question",
    output: "The answer is (B)",
    expected: "B",
    answer: "B",
    correct: true,
    outcome: "completed",
    usage: null,
    costUsd: null,
    latencyMs: 1,
    requestId: null,
    ...overrides,
  };
}
