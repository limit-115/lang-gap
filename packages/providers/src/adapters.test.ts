import { describe, expect, it, vi } from "vitest";
import { createOpenAIAdapter } from "./openai";
import { createAnthropicAdapter } from "./anthropic";
import type { Effort, GenerationRequest } from "@llang-gap/contracts";

const request = (effort: Effort): GenerationRequest => ({
  model: "gpt-6-astra",
  effort,
  language: "en",
  maxOutputTokens: 1024,
  prompt: "The complete prompt",
});
const openAIResponse = {
  id: "resp_test",
  object: "response",
  created_at: 1,
  model: "gpt-6-astra",
  status: "completed",
  output: [
    {
      type: "message",
      id: "msg_test",
      role: "assistant",
      status: "completed",
      content: [{ type: "output_text", text: "The answer is (B)", annotations: [] }],
    },
  ],
  usage: {
    input_tokens: 100,
    output_tokens: 200,
    total_tokens: 300,
    input_tokens_details: { cached_tokens: 10, cache_write_tokens: 20 },
    output_tokens_details: { reasoning_tokens: 150 },
  },
};

describe("SDK adapters with intercepted HTTP transport", () => {
  it.each(["en", "ru"] as const)(
    "sends author stops to Anthropic and accepts the requested stop (%s)",
    async (language) => {
      const stopSequences = [
        "</s>",
        "Q:",
        language === "en" ? "Question:" : "Вопрос:",
        "<|im_end|>",
      ];
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          id: "msg_stop",
          type: "message",
          role: "assistant",
          model: "claude-fable-5-1",
          stop_reason: "stop_sequence",
          stop_sequence: stopSequences[2],
          content: [{ type: "text", text: "Ответ - (B)" }],
          usage: { input_tokens: 100, output_tokens: 20 },
        }),
      );
      const result = await createAnthropicAdapter("synthetic-test-key", 1000, fetcher).generate({
        ...request("low"),
        model: "claude-fable-5-1",
        language,
        maxOutputTokens: 2048,
        stopSequences,
      });
      expect(result.outcome).toBe("completed");
      const body = fetcher.mock.calls[0]?.[1]?.body;
      if (typeof body !== "string") throw new Error("Expected JSON request body");
      expect(JSON.parse(body)).toEqual({
        model: "claude-fable-5-1",
        messages: [{ role: "user", content: "The complete prompt" }],
        max_tokens: 2048,
        thinking: { type: "adaptive" },
        output_config: { effort: "low" },
        service_tier: "standard_only",
        stop_sequences: stopSequences,
      });
    },
  );

  it("does not send unsupported stop or sampling fields to OpenAI Responses", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(openAIResponse));
    await createOpenAIAdapter("synthetic-test-key", 1000, fetcher).generate({
      ...request("low"),
      maxOutputTokens: 2048,
      stopSequences: ["</s>", "Q:", "Question:", "<|im_end|>"],
    });
    const body = fetcher.mock.calls[0]?.[1]?.body;
    if (typeof body !== "string") throw new Error("Expected JSON request body");
    expect(JSON.parse(body)).toEqual({
      model: "gpt-6-astra",
      input: [{ role: "user", content: "The complete prompt" }],
      reasoning: { effort: "low" },
      max_output_tokens: 2048,
      service_tier: "default",
      store: false,
    });
  });
  it.each(["low", "medium", "high"] as const)(
    "sends OpenAI native effort %s without hidden sampling, tools or retries",
    async (effort) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json(openAIResponse, { headers: { "x-request-id": "request_test" } }),
        );
      const adapter = createOpenAIAdapter("synthetic-test-key", 1000, fetcher);
      const result = await adapter.generate(request(effort));
      expect(result).toMatchObject({
        text: "The answer is (B)",
        model: "gpt-6-astra",
        requestId: "request_test",
        outcome: "completed",
        usage: {
          inputTokens: 100,
          outputTokens: 200,
          reasoningTokens: 150,
          cachedInputTokens: 10,
          cacheWriteTokens: 20,
        },
      });
      const requestBody = fetcher.mock.calls[0]?.[1]?.body;
      if (typeof requestBody !== "string") throw new Error("Expected JSON request body");
      const body = JSON.parse(requestBody) as Record<string, unknown>;
      expect(body).toEqual({
        model: "gpt-6-astra",
        input: [{ role: "user", content: "The complete prompt" }],
        reasoning: { effort },
        max_output_tokens: 1024,
        service_tier: "default",
        store: false,
      });
    },
  );

  it.each(["low", "medium", "high"] as const)(
    "sends Anthropic adaptive thinking and native effort %s",
    async (effort) => {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        Response.json(
          {
            id: "msg_test",
            type: "message",
            role: "assistant",
            model: "claude-fable-5-1",
            stop_reason: "end_turn",
            stop_sequence: null,
            content: [
              { type: "thinking", thinking: "Internal reasoning", signature: "test-signature" },
              { type: "text", text: "Ответ - (B)" },
            ],
            usage: {
              input_tokens: 100,
              cache_read_input_tokens: 10,
              cache_creation_input_tokens: 20,
              cache_creation: { ephemeral_1h_input_tokens: 5, ephemeral_5m_input_tokens: 15 },
              output_tokens: 200,
            },
          },
          { headers: { "request-id": "anthropic-test" } },
        ),
      );
      const adapter = createAnthropicAdapter("synthetic-test-key", 1000, fetcher);
      const result = await adapter.generate({
        ...request(effort),
        model: "claude-fable-5-1",
        language: "ru",
      });
      expect(result).toMatchObject({
        text: "Ответ - (B)",
        model: "claude-fable-5-1",
        outcome: "completed",
        usage: {
          inputTokens: 130,
          cachedInputTokens: 10,
          cacheWriteTokens: 15,
          cacheWrite1hTokens: 5,
          reasoningTokens: null,
        },
      });
      const requestBody = fetcher.mock.calls[0]?.[1]?.body;
      if (typeof requestBody !== "string") throw new Error("Expected JSON request body");
      const body = JSON.parse(requestBody) as Record<string, unknown>;
      expect(body).toEqual({
        model: "claude-fable-5-1",
        messages: [{ role: "user", content: "The complete prompt" }],
        max_tokens: 1024,
        thinking: { type: "adaptive" },
        output_config: { effort },
        service_tier: "standard_only",
      });
    },
  );

  it("does not let SDK retry a rate limit independently of the runner", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () =>
        Response.json(
          { error: { message: "Rate limited", type: "rate_limit_error" } },
          { status: 429, headers: { "retry-after": "2" } },
        ),
      );
    await expect(
      createOpenAIAdapter("test-key", 1000, fetcher).generate(request("low")),
    ).rejects.toMatchObject({ retryable: true, uncertain: false, retryAfterMs: 2000 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("distinguishes refusal, token truncation and incomplete usage", async () => {
    for (const [reason, outcome] of [
      ["content_filter", "refusal"],
      ["max_output_tokens", "truncated"],
    ] as const) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          ...openAIResponse,
          status: "incomplete",
          incomplete_details: { reason },
          output: [],
          usage: null,
        }),
      );
      expect(
        await createOpenAIAdapter("test-key", 1000, fetcher).generate(request("low")),
      ).toMatchObject({ outcome, usage: null });
    }
  });
});
