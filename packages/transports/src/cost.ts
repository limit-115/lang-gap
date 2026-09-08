import type { ModelConfig, Usage } from "@llang-gap/contracts";

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
