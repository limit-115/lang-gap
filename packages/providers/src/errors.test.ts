import { afterEach, expect, it, vi } from "vitest";
import { normalizeError } from "./errors";
import { createOpenRouterAdapter } from "./openrouter";
import { createAnthropicAdapter } from "./anthropic";

afterEach(() => vi.unstubAllEnvs());

it("keeps the provider diagnostic and correlation without SDK metadata or credentials", () => {
  vi.stubEnv("OPENAI_API_KEY", "fixture-secret");
  const error = normalizeError(
    Object.assign(new Error("RAW_SDK_BODY"), {
      status: 400,
      request_id: "req-invalid",
      code: "unsupported_value",
      error: {
        message: "Unsupported effort max; api_key=fixture-secret",
        metadata: { raw: "PRIVATE_RAW" },
      },
    }),
  );
  expect(error).toMatchObject({
    message: "Provider HTTP 400: Unsupported effort max; api_key=[REDACTED]",
    status: 400,
    code: "unsupported_value",
    requestId: "req-invalid",
    retryable: false,
  });
  expect(JSON.stringify(error)).not.toMatch(/fixture-secret|PRIVATE_RAW|RAW_SDK_BODY/);
});

it("retains connection causes and bounds malformed or excessive Retry-After values", () => {
  expect(
    normalizeError(new Error("Connection failed", { cause: new Error("ECONNRESET") })).message,
  ).toContain("ECONNRESET");
  for (const [retry, expected] of [
    ["invalid", 0],
    ["999999", 300000],
    ["2.5", 2500],
  ] as const) {
    expect(
      normalizeError(
        Object.assign(new Error("busy"), {
          status: 503,
          headers: new Headers({ "retry-after": retry }),
        }),
      ).retryAfterMs,
    ).toBe(expected);
  }
});

it("redacts directly supplied keys and echoed prompts in gateway HTTP-200 errors", async () => {
  const prompt = "SYNTHETIC_PRIVATE_PROMPT".repeat(100);
  const key = "direct-key-not-from-env";
  const transport = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json({
      id: "gateway-request",
      error: { code: 400, message: `Unsupported effort; credential ${key}; request ${prompt}` },
    }),
  );
  await expect(
    createOpenRouterAdapter(key, 1000, transport).generate({
      model: "fixtures/model",
      language: "ja",
      effort: "max",
      prompt,
      maxOutputTokens: null,
    }),
  ).rejects.toMatchObject({
    message: "Provider HTTP 400: Unsupported effort; credential [REDACTED]; request [REDACTED]",
    status: 400,
    requestId: "gateway-request",
    retryable: false,
  });
});

it("extracts native Anthropic diagnostics without serializing its error envelope", async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json(
      {
        type: "error",
        error: { type: "invalid_request_error", message: "Unsupported effort max" },
        metadata: { raw: "PRIVATE_NATIVE_BODY" },
      },
      { status: 400, headers: { "request-id": "req-native-fixture" } },
    ),
  );
  await expect(
    createAnthropicAdapter("synthetic-key", 1000, transport).generate({
      model: "fixture-model",
      language: "de",
      effort: "max",
      prompt: "PRIVATE_PROMPT",
      maxOutputTokens: 1024,
    }),
  ).rejects.toMatchObject({
    message: "Provider HTTP 400: Unsupported effort max",
    code: "invalid_request_error",
    requestId: "req-native-fixture",
  });
});
