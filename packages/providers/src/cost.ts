import type { GenerationRequest, ModelConfig, Usage } from "@llang-gap/contracts";

export function calculateCost(usage: Usage, pricing: ModelConfig["pricing"]): number | null {
  if (!pricing) return null;
  const uncached =
    usage.inputTokens - usage.cachedInputTokens - usage.cacheWriteTokens - usage.cacheWrite1hTokens;
  return (
    (uncached * pricing.inputPerMillion +
      usage.cachedInputTokens * pricing.cachedInputPerMillion +
      usage.cacheWriteTokens * pricing.cacheWritePerMillion +
      usage.cacheWrite1hTokens * pricing.cacheWrite1hPerMillion +
      usage.outputTokens * pricing.outputPerMillion) /
    1_000_000
  );
}

export function reserveCost(
  request: GenerationRequest,
  pricing: ModelConfig["pricing"],
): number | null {
  if (!pricing) return null;
  // UTF-8 bytes bound text tokens conservatively; reserve additional API framing.
  // Restrict to short context pricing. Dataset prompts are far below this limit.
  const inputBound = Buffer.byteLength(request.prompt, "utf8") + 4096;
  if (inputBound > 200_000) throw new Error("Prompt exceeds supported short-context pricing bound");
  const inputRate = Math.max(
    pricing.inputPerMillion,
    pricing.cachedInputPerMillion,
    pricing.cacheWritePerMillion,
    pricing.cacheWrite1hPerMillion,
  );
  return (inputBound * inputRate + request.maxOutputTokens * pricing.outputPerMillion) / 1_000_000;
}
