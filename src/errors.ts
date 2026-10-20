export class FetchShieldError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "FetchShieldError";
  }
}

export class InvalidRetryOptionsError extends FetchShieldError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRetryOptionsError";
  }
}

export class RetryNetworkError extends FetchShieldError {
  readonly attempts: number;

  constructor(attempts: number, cause: unknown) {
    super(
      `fetch-shield: network request failed after ${attempts} attempt(s): ${describeCause(cause)}`,
      {
        cause,
      },
    );
    this.name = "RetryNetworkError";
    this.attempts = attempts;
  }
}

export class RetryTimeoutError extends FetchShieldError {
  readonly attempts: number;
  readonly timeoutMs: number;

  constructor(attempts: number, timeoutMs: number, cause: unknown) {
    super(
      `fetch-shield: request timed out after ${timeoutMs}ms on attempt ${attempts}: ${describeCause(cause)}`,
      { cause },
    );
    this.name = "RetryTimeoutError";
    this.attempts = attempts;
    this.timeoutMs = timeoutMs;
  }
}

export class AttemptTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`fetch-shield: attempt timed out after ${timeoutMs}ms`);
    this.name = "AttemptTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export function createAbortError(signal?: AbortSignal | null): unknown {
  const reason = signal?.reason;
  if (reason !== undefined) {
    return reason;
  }
  if (typeof DOMException !== "undefined") {
    return new DOMException("This operation was aborted", "AbortError");
  }
  const error = new Error("This operation was aborted");
  error.name = "AbortError";
  return error;
}

function describeCause(cause: unknown): string {
  if (cause instanceof Error) {
    return `${cause.name}: ${cause.message}`;
  }
  return String(cause);
}
