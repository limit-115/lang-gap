import { afterEach, describe, expect, it, vi } from "vitest";
import { createOpenRouterAdapter } from "./openrouter";
import { createAdapter } from "./index";

const request = {
  model: "openai/gpt-5-nano",
  effort: "low" as const,
  language: "en" as const,
  prompt: "The complete prompt",
  maxOutputTokens: 2048,
  stopSequences: ["Question:"],
};
const response = {
  id: "gen-test",
  model: request.model,
  provider: "OpenAI",
  choices: [
    {
      finish_reason: "stop",
      message: { role: "assistant", content: "answer is (B)", reasoning: "private" },
    },
  ],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 50,
    prompt_tokens_details: { cached_tokens: 10, cache_write_tokens: 5 },
    completion_tokens_details: { reasoning_tokens: 30 },
  },
};
afterEach(() => vi.unstubAllEnvs());
describe("OpenRouter intercepted transport", () => {
  it.each(["low", "medium", "high", "xhigh", "max"] as const)(
    "forwards %s without changing prompt",
    async (effort) => {
      const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json(response));
      const result = await createOpenRouterAdapter("synthetic-key", 1000, transport).generate({
        ...request,
        effort,
      });
      expect(transport.mock.calls[0]![0]).toBe("https://openrouter.ai/api/v1/chat/completions");
      const init = transport.mock.calls[0]![1]!;
      expect(new Headers(init.headers).get("authorization")).toBe("Bearer synthetic-key");
      if (typeof init.body !== "string") throw new Error("Expected JSON request body");
      expect(JSON.parse(init.body)).toEqual({
        model: request.model,
        messages: [{ role: "user", content: request.prompt }],
        max_tokens: 2048,
        reasoning: { effort },
        provider: { allow_fallbacks: false, require_parameters: true },
        transforms: [],
      });
      expect(result).toMatchObject({
        requestId: "gen-test",
        model: request.model,
        text: "answer is (B)",
        outcome: "completed",
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          cachedInputTokens: 10,
          cacheWriteTokens: 5,
          reasoningTokens: 30,
        },
      });
      expect(result.raw).toEqual(response);
    },
  );
  it.each([
    ["length", "truncated"],
    ["content_filter", "refusal"],
  ])("maps %s", async (finish, outcome) => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        ...response,
        choices: [{ finish_reason: finish, message: { content: null } }],
      }),
    );
    expect(
      await createOpenRouterAdapter("synthetic", 1000, transport).generate(request),
    ).toMatchObject({ outcome, text: "" });
  });
  it.each([undefined, { prompt_tokens: -1, completion_tokens: 50 }])(
    "keeps missing or invalid usage unknown",
    async (usage) => {
      const transport = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ ...response, usage }));
      expect(
        (await createOpenRouterAdapter("synthetic", 1000, transport).generate(request)).usage,
      ).toBeNull();
    },
  );
  it.each([401, 402, 429, 503])("classifies HTTP %s and does not retry in SDK", async (status) => {
    const transport = vi.fn<typeof fetch>().mockImplementation(async () =>
      Response.json(
        {
          error: {
            message: "Model access denied for Bearer fixture-token",
            metadata: { raw: "PRIVATE_PROVIDER_BODY" },
          },
        },
        { status, headers: { "retry-after": "2" } },
      ),
    );
    await expect(
      createOpenRouterAdapter("synthetic", 1000, transport).generate(request),
    ).rejects.toMatchObject({
      message: `Transport HTTP ${status}: Model access denied for Bearer [REDACTED]`,
      status,
      retryable: status === 429 || status >= 500,
      uncertain: status >= 500,
      retryAfterMs: 2000,
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it.each([
    { error: { code: 503, message: "private" } },
    { ...response, choices: [] },
    { ...response, choices: [{ finish_reason: "tool_calls", message: { content: null } }] },
  ])("rejects error envelopes and invalid completions", async (body) => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body));
    await expect(
      createOpenRouterAdapter("synthetic", 1000, transport).generate(request),
    ).rejects.toMatchObject({ retryable: true, uncertain: true });
  });
  it.each([
    ["openai", "OPENAI_API_KEY", "https://api.openai.com/v1/responses"],
    ["anthropic", "ANTHROPIC_API_KEY", "https://api.anthropic.com/v1/messages"],
    ["openrouter", "OPENROUTER_API_KEY", "https://openrouter.ai/api/v1/chat/completions"],
  ] as const)(
    "selects the %s adapter and its own credential from transport alone",
    (transport, env, endpoint) => {
      vi.stubEnv("OPENAI_API_KEY", "synthetic-other");
      vi.stubEnv("ANTHROPIC_API_KEY", "synthetic-other");
      vi.stubEnv("OPENROUTER_API_KEY", "synthetic-other");
      vi.stubEnv(env, "");
      expect(() => createAdapter(transport, 1000)).toThrow(`Missing ${env}`);
      vi.stubEnv(env, "synthetic");
      expect(createAdapter(transport, 1000)).toMatchObject({ transport, endpoint });
    },
  );
});

it("omits the token parameter when the resolved cap is null", async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json(response));
  await createOpenRouterAdapter("synthetic-key", 1000, transport).generate({
    ...request,
    maxOutputTokens: null,
  });
  const rawBody = transport.mock.calls[0]![1]!.body;
  if (typeof rawBody !== "string") throw new Error("Expected JSON body");
  const body = JSON.parse(rawBody);
  expect(body).not.toHaveProperty("max_tokens");
  expect(body).not.toHaveProperty("max_completion_tokens");
  expect(body.messages).toEqual([{ role: "user", content: request.prompt }]);
});
