import type { ModelConfig, ProviderAdapter } from "@llang-gap/contracts";
import { createOpenAIAdapter } from "./openai";
import { createAnthropicAdapter } from "./anthropic";
import { createFakeAdapter } from "./fake";

export { calculateCost, reserveCost } from "./cost";
export { ProviderError, normalizeError } from "./errors";
export { createFakeAdapter } from "./fake";

const capabilities = {
  openai: ["gpt-6-astra", "gpt-5-nano", "gpt-5-nano-2025-08-07"],
  anthropic: ["claude-fable-5-1"],
  fake: ["fake-v1"],
} as const;
export function validateModel(model: ModelConfig): void {
  if (!(capabilities[model.provider] as readonly string[]).includes(model.model))
    throw new Error(`Model capabilities are not registered: ${model.provider}/${model.model}`);
  if (
    model.provider !== "fake" &&
    (model.pricing.inputPerMillion === 0 || model.pricing.outputPerMillion === 0)
  )
    throw new Error("Live model pricing must be positive");
}
export function createAdapter(model: ModelConfig, timeoutMs: number): ProviderAdapter {
  validateModel(model);
  if (model.provider === "fake") return createFakeAdapter();
  const env = model.provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
  const key = process.env[env];
  if (!key) throw new Error(`Missing ${env}`);
  return model.provider === "openai"
    ? createOpenAIAdapter(key, timeoutMs)
    : createAnthropicAdapter(key, timeoutMs);
}
