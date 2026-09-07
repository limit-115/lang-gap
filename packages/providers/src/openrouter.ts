import OpenAI from "openai";
import { usageSchema, type TransportAdapter } from "@llang-gap/contracts";
import { normalizeError, ProviderError } from "./errors";
import sdk from "#package.json";

export function createOpenRouterAdapter(
  apiKey: string,
  timeoutMs: number,
  transport?: typeof fetch,
): TransportAdapter {
  const client = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    timeout: timeoutMs,
    maxRetries: 0,
    ...(transport ? { fetch: transport } : {}),
  });
  return {
    transport: "openrouter",
    sdkVersion: sdk.dependencies.openai,
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    async generate(request) {
      try {
        // Extra OpenRouter fields are sent through the existing SDK unchanged.
        const body = {
          model: request.model,
          messages: [{ role: "user" as const, content: request.prompt }],
          ...(request.maxOutputTokens === null ? {} : { max_tokens: request.maxOutputTokens }),
          reasoning: { effort: request.effort },
          provider: { allow_fallbacks: false, require_parameters: true },
          // Preserve prompt bytes; task stops are applied by the protocol scorer.
          transforms: [],
        };
        const response = await client.chat.completions.create(body);
        // Gateways can return an error envelope with HTTP 200.
        if ("error" in response) {
          const error = response.error;
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            typeof error.code === "number"
          )
            throw normalizeError(
              Object.assign(new Error("OpenRouter error"), { status: error.code }),
            );
          throw new ProviderError("OpenRouter error response", true, true);
        }
        const choice = response.choices?.[0];
        if (
          response.choices?.length !== 1 ||
          !choice ||
          !["stop", "length", "content_filter"].includes(choice.finish_reason) ||
          typeof response.id !== "string" ||
          typeof response.model !== "string" ||
          !choice.message ||
          (choice.message.content !== null && typeof choice.message.content !== "string")
        )
          throw new ProviderError("Invalid OpenRouter completion", true, true);
        const details = response.usage?.prompt_tokens_details;
        const write = details && "cache_write_tokens" in details ? details.cache_write_tokens : 0;
        const usage = response.usage
          ? usageSchema.safeParse({
              inputTokens: response.usage.prompt_tokens,
              cachedInputTokens: details?.cached_tokens ?? 0,
              cacheWriteTokens: write ?? 0,
              cacheWrite1hTokens: 0,
              outputTokens: response.usage.completion_tokens,
              reasoningTokens: response.usage.completion_tokens_details?.reasoning_tokens ?? null,
            })
          : null;
        return {
          model: response.model,
          requestId: response.id,
          text: choice.message.content ?? "",
          outcome:
            choice.finish_reason === "length"
              ? "truncated"
              : choice.finish_reason === "content_filter" || choice.message.refusal
                ? "refusal"
                : "completed",
          usage: usage?.success ? usage.data : null,
          raw: response,
        };
      } catch (error) {
        throw normalizeError(error);
      }
    },
  };
}
