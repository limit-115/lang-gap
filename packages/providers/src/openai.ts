import OpenAI from "openai";
import { usageSchema, type GenerationRequest, type TransportAdapter } from "@llang-gap/contracts";
import { normalizeError, ProviderError } from "./errors";
import sdk from "#package.json";

export function createOpenAIAdapter(
  apiKey: string,
  timeoutMs: number,
  transport?: typeof fetch,
): TransportAdapter {
  const client = new OpenAI({
    apiKey,
    timeout: timeoutMs,
    maxRetries: 0,
    ...(transport ? { fetch: transport } : {}),
  });
  return {
    transport: "openai",
    sdkVersion: sdk.dependencies.openai,
    endpoint: "https://api.openai.com/v1/responses",
    async generate(request: GenerationRequest) {
      try {
        const { data: response, request_id } = await client.responses
          .create({
            model: request.model,
            input: [{ role: "user", content: request.prompt }],
            reasoning: { effort: request.effort },
            ...(request.maxOutputTokens === null
              ? {}
              : { max_output_tokens: request.maxOutputTokens }),
            service_tier: "default",
            store: false,
          })
          .withResponse();
        const refusal =
          response.incomplete_details?.reason === "content_filter" ||
          response.output.some(
            (item) =>
              item.type === "message" && item.content.some((content) => content.type === "refusal"),
          );
        const truncated =
          response.status === "incomplete" &&
          response.incomplete_details?.reason === "max_output_tokens";
        if (response.status !== "completed" && !truncated && !refusal)
          throw new ProviderError(
            `Generation status: ${response.status ?? "missing"}`,
            true,
            true,
            request_id,
          );
        const usage = response.usage
          ? usageSchema.safeParse({
              inputTokens: response.usage.input_tokens,
              cachedInputTokens: response.usage.input_tokens_details.cached_tokens,
              cacheWriteTokens: response.usage.input_tokens_details.cache_write_tokens ?? 0,
              cacheWrite1hTokens: 0,
              outputTokens: response.usage.output_tokens,
              reasoningTokens: response.usage.output_tokens_details.reasoning_tokens,
            })
          : null;
        return {
          model: response.model,
          requestId: request_id,
          text: response.output_text,
          outcome: truncated ? "truncated" : refusal ? "refusal" : "completed",
          usage: usage?.success ? usage.data : null,
          raw: response,
        };
      } catch (error) {
        throw normalizeError(error);
      }
    },
  };
}
