import { redactDiagnostic } from "./diagnostics";

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly uncertain: boolean,
    readonly requestId: string | null = null,
    readonly retryAfterMs = 0,
    readonly status: number | null = null,
    readonly code: string | null = null,
  ) {
    super(redactDiagnostic(message).slice(0, 1200));
    this.name = "ProviderError";
  }
}
export function normalizeError(error: unknown, sensitive: readonly string[] = []): ProviderError {
  if (error instanceof ProviderError) {
    error.message = redactDiagnostic(error.message, sensitive);
    return error;
  }
  if (error instanceof Error && "status" in error && typeof error.status === "number") {
    const headers = "headers" in error && error.headers instanceof Headers ? error.headers : null;
    const requestId =
      "request_id" in error && typeof error.request_id === "string"
        ? error.request_id
        : (headers?.get("x-request-id") ?? headers?.get("request-id") ?? null);
    const payload = "error" in error ? error.error : undefined;
    const envelope = payload && typeof payload === "object" ? payload : null;
    const body =
      envelope && "error" in envelope && envelope.error && typeof envelope.error === "object"
        ? envelope.error
        : envelope;
    const message =
      body && "message" in body && typeof body.message === "string"
        ? body.message
        : payload === undefined || payload === null
          ? error.message
          : "Provider returned no diagnostic message";
    const code =
      "code" in error && typeof error.code === "string"
        ? error.code
        : body && "type" in body && typeof body.type === "string"
          ? body.type
          : null;
    let retryAfterMs = 0;
    const retry = headers?.get("retry-after");
    if (retry)
      retryAfterMs = /^\d+(\.\d+)?$/.test(retry)
        ? Number(retry) * 1000
        : Math.max(0, Date.parse(retry) - Date.now());
    return new ProviderError(
      redactDiagnostic(`Provider HTTP ${error.status}: ${message}`, sensitive),
      error.status === 429 || error.status >= 500 || error.status === 408,
      error.status >= 500 || error.status === 408,
      requestId === null ? null : redactDiagnostic(requestId, sensitive),
      Number.isFinite(retryAfterMs) ? Math.min(retryAfterMs, 300_000) : 0,
      error.status,
      code === null ? null : redactDiagnostic(code, sensitive),
    );
  }
  const cause =
    error instanceof Error && error.cause instanceof Error ? `; ${error.cause.message}` : "";
  return new ProviderError(
    redactDiagnostic(
      `Provider transport failure: ${error instanceof Error ? error.message : "Unexpected non-Error failure"}${cause}; billing outcome may be unknown`,
      sensitive,
    ),
    true,
    true,
    null,
    0,
    null,
    error instanceof Error && "code" in error && typeof error.code === "string"
      ? redactDiagnostic(error.code, sensitive)
      : null,
  );
}
