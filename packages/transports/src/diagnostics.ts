/** Only diagnostic text crosses this boundary; never pass SDK/request/response objects. */
export function redactDiagnostic(text: string, sensitive: readonly string[] = []): string {
  let safe = text;
  for (const value of sensitive) {
    if (value) safe = safe.replaceAll(value, "[REDACTED]");
  }
  for (const [key, value] of Object.entries(process.env)) {
    if (
      /(?:key|token|secret|password|credential|authorization)/i.test(key) &&
      value &&
      value.length >= 4
    )
      safe = safe.replaceAll(value, "[REDACTED]");
  }
  return (
    safe
      .replace(/\b(Bearer|Basic)\s+[\w+/=.:~-]+/gi, "$1 [REDACTED]")
      .replace(/\bsk-[\w-]+/g, "[REDACTED]")
      .replace(
        /((?:api[_-]?key|access[_-]?token|password|secret|authorization)\s*[=:]\s*)[^\s,;"'}]+/gi,
        "$1[REDACTED]",
      )
      .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, "$1[REDACTED]@")
      // Strip terminal control characters from untrusted API messages.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
  );
}

export function diagnosticMessage(error: unknown): string {
  return redactDiagnostic(
    error instanceof Error ? error.message : "Unexpected non-Error failure",
  ).slice(0, 1200);
}

export function diagnosticError(error: unknown) {
  if (!(error instanceof Error)) return { message: diagnosticMessage(error) };
  return {
    name: redactDiagnostic(error.name),
    message: diagnosticMessage(error),
    // Stack frames only: the first line can duplicate an unbounded API response body.
    stack: error.stack
      ?.split("\n")
      .filter((line) => /^\s+at /.test(line))
      .slice(0, 12)
      .map((frame) => redactDiagnostic(frame)),
    ...(error.cause instanceof Error ? { cause: diagnosticMessage(error.cause) } : {}),
  };
}
