export class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly uncertain: boolean,
    readonly requestId: string | null = null,
    readonly retryAfterMs = 0,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
export function normalizeError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof Error && "status" in error && typeof error.status === "number") {
    const requestId =
      "request_id" in error && typeof error.request_id === "string" ? error.request_id : null;
    let retryAfterMs = 0;
    if ("headers" in error && error.headers instanceof Headers) {
      const retry = error.headers.get("retry-after");
      if (retry)
        retryAfterMs = /^\d+(\.\d+)?$/.test(retry)
          ? Number(retry) * 1000
          : Math.max(0, Date.parse(retry) - Date.now());
    }
    return new ProviderError(
      `Provider HTTP ${error.status}`,
      error.status === 429 || error.status >= 500 || error.status === 408,
      error.status >= 500 || error.status === 408,
      requestId,
      Number.isFinite(retryAfterMs) ? Math.min(retryAfterMs, 300_000) : 0,
    );
  }
  return new ProviderError(
    "Provider transport failure; billing outcome may be unknown",
    true,
    true,
  );
}
