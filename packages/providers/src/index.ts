import {
  getModelIdentity,
  modelSchema,
  type ModelConfig,
  type Transport,
  type TransportAdapter,
} from "@llang-gap/contracts";
import { createOpenRouterAdapter } from "./openrouter";
import { createOpenAIAdapter } from "./openai";
import { createAnthropicAdapter } from "./anthropic";
import { createFakeAdapter } from "./fake";

export { calculateCost, reserveCost } from "./cost";
export { ProviderError, normalizeError } from "./errors";
export { createFakeAdapter } from "./fake";

export function validateModel(model: ModelConfig): void {
  modelSchema.parse(model);
  if (model.transport !== "openrouter" && getModelIdentity(model).owner !== model.transport)
    throw new Error(`Model capabilities are not registered: ${model.transport}/${model.model}`);
  if (
    model.transport !== "fake" &&
    (model.pricing.inputPerMillion === 0 || model.pricing.outputPerMillion === 0)
  )
    throw new Error("Live model pricing must be positive");
}

const transports = {
  openai: { key: "OPENAI_API_KEY", create: createOpenAIAdapter },
  anthropic: { key: "ANTHROPIC_API_KEY", create: createAnthropicAdapter },
  openrouter: { key: "OPENROUTER_API_KEY", create: createOpenRouterAdapter },
};
export function createAdapter(transport: Transport, timeoutMs: number): TransportAdapter {
  if (transport === "fake") return createFakeAdapter();
  const adapter = transports[transport];
  const key = process.env[adapter.key];
  if (!key) throw new Error(`Missing ${adapter.key}`);
  return adapter.create(key, timeoutMs);
}
