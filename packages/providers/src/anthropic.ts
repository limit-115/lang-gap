import Anthropic from "@anthropic-ai/sdk";
import { usageSchema, type GenerationRequest, type TransportAdapter } from "@llang-gap/contracts";
import { normalizeError, ProviderError } from "./errors";
import sdk from "#package.json";

export function createAnthropicAdapter(
  apiKey: string,
  timeoutMs: number,
  transport?: typeof fetch,
): TransportAdapter {
  const client = new Anthropic({
    apiKey,
    timeout: timeoutMs,
    maxRetries: 0,
    ...(transport ? { fetch: transport } : {}),
  });
  return {
    transport: "anthropic",
    sdkVersion: sdk.dependencies["@anthropic-ai/sdk"],
    endpoint: "https://api.anthropic.com/v1/messages",
    async generate(request: GenerationRequest) {
      if (request.maxOutputTokens === null)
        throw new ProviderError("Anthropic requires an explicit maxOutputTokens cap", false, false);
      try {
        const { data: response, request_id } = await client.messages
          .create({
            model: request.model,
            messages: [{ role: "user", content: request.prompt }],
            max_tokens: request.maxOutputTokens,
            thinking: { type: "adaptive" },
            output_config: { effort: request.effort },
            service_tier: "standard_only",
            ...(request.stopSequences ? { stop_sequences: [...request.stopSequences] } : {}),
          })
          .withResponse();
        const truncated = response.stop_reason === "max_tokens";
        const refusal = response.stop_reason === "refusal";
        const requestedStop =
          response.stop_reason === "stop_sequence" &&
          response.stop_sequence !== null &&
          request.stopSequences?.includes(response.stop_sequence);
        if (
          !requestedStop &&
          !["end_turn", "refusal", "max_tokens"].includes(response.stop_reason ?? "")
        )
          throw new ProviderError(
            `Generation stop: ${response.stop_reason ?? "missing"}`,
            true,
            true,
            request_id,
          );
        const read = response.usage.cache_read_input_tokens ?? 0;
        const write = response.usage.cache_creation_input_tokens ?? 0;
        const write1h = response.usage.cache_creation?.ephemeral_1h_input_tokens ?? 0;
        const usage = usageSchema.safeParse({
          inputTokens: response.usage.input_tokens + read + write,
          cachedInputTokens: read,
          cacheWriteTokens: write - write1h,
          cacheWrite1hTokens: write1h,
          outputTokens: response.usage.output_tokens,
          reasoningTokens: null,
        });
        return {
          model: response.model,
          requestId: request_id ?? null,
          text: response.content
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("\n"),
          outcome: truncated ? "truncated" : refusal ? "refusal" : "completed",
          usage: usage.success ? usage.data : null,
          raw: response,
        };
      } catch (error) {
        throw normalizeError(error, [apiKey, request.prompt]);
      }
    },
  };
}
