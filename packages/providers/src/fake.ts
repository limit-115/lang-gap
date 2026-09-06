import { createHash } from "node:crypto";
import type { ProviderAdapter } from "@llang-gap/contracts";

export function createFakeAdapter(): ProviderAdapter {
  return {
    name: "fake",
    sdkVersion: "1",
    endpoint: "local:fake",
    generate(request) {
      const hex = createHash("sha256")
        .update(request.prompt + request.effort)
        .digest("hex");
      const answer = String.fromCharCode(65 + (Number.parseInt(hex.slice(0, 2), 16) % 4));
      const text =
        request.language === "en"
          ? `Synthetic test response. The answer is (${answer})`
          : `Синтетический тестовый ответ. Ответ - (${answer})`;
      return Promise.resolve({
        model: "fake-v1",
        requestId: `fake-${hex.slice(0, 16)}`,
        text,
        outcome: "completed",
        usage: {
          inputTokens: 100,
          cachedInputTokens: 0,
          cacheWriteTokens: 0,
          cacheWrite1hTokens: 0,
          outputTokens: 20,
          reasoningTokens: 0,
        },
        raw: { synthetic: true, text },
      });
    },
  };
}
