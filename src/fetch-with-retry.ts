import { computeBackoffDelay, waitFor } from "./backoff.ts";
import {
  getRequestMethod,
  isBodyReplayable,
  isIdempotentMethod,
  isRequest,
} from "./body.ts";
import {
  AttemptTimeoutError,
  createAbortError,
  FetchShieldError,
  RetryNetworkError,
  RetryTimeoutError,
} from "./errors.ts";
import { resolveRetryOptions } from "./options.ts";
import { isRetryAfterStatus, parseRetryAfter } from "./retry-after.ts";
import type {
  FetchInput,
  FetchRetryOptions,
  RetryAttemptInfo,
} from "./types.ts";

type AttemptOutcome =
  | { readonly ok: true; readonly response: Response }
  | {
      readonly ok: false;
      readonly failure: "network" | "timeout";
      readonly error: unknown;
    };

export async function fetchWithRetry(
  input: FetchInput,
  init?: RequestInit,
  options?: FetchRetryOptions,
): Promise<Response> {
  const opts = resolveRetryOptions(options);
  if (typeof globalThis.fetch !== "function") {
    throw new FetchShieldError(
      "fetch-shield: globalThis.fetch is unavailable; use an environment with the Fetch API (Node.js >= 18 or a modern browser)",
    );
  }

  const callerSignal = getCallerSignal(input, init);
  const method = getRequestMethod(input, init);

  let maxAllowedAttempts = opts.maxAttempts;
  if (!isBodyReplayable(input, init)) {
    maxAllowedAttempts = 1;
  } else if (!isIdempotentMethod(method) && !opts.retryNonIdempotent) {
    maxAllowedAttempts = 1;
  }

  for (let attempt = 1; ; attempt += 1) {
    if (callerSignal?.aborted) {
      throw createAbortError(callerSignal);
    }

    const outcome = await performAttempt(
      input,
      init,
      opts.timeoutMs,
      callerSignal,
    );

    if (outcome.ok) {
      const { response } = outcome;
      const wouldRetry =
        attempt < maxAllowedAttempts &&
        opts.retryableStatuses.includes(response.status);
      if (!wouldRetry) {
        return response;
      }
      if (callerSignal?.aborted) {
        throw createAbortError(callerSignal);
      }

      const retryAfterValue = isRetryAfterStatus(response.status)
        ? response.headers.get("retry-after")
        : null;
      const retryAfterMs = parseRetryAfter(retryAfterValue);
      const delayMs =
        retryAfterMs === null
          ? computeBackoffDelay(attempt, opts)
          : Math.min(retryAfterMs, opts.maxDelayMs);

      const info: RetryAttemptInfo = {
        attempt,
        maxAttempts: opts.maxAttempts,
        delayMs,
        reason: { type: "http-status", status: response.status, retryAfterMs },
      };
      opts.onRetry?.(info);

      await discardBody(response);
      await waitFor(delayMs, callerSignal);
      continue;
    }

    if (callerSignal?.aborted) {
      throw createAbortError(callerSignal);
    }

    const isTimeout = outcome.failure === "timeout";
    const policyAllowsRetry = isTimeout
      ? opts.retryOnTimeout
      : opts.retryOnNetworkError;
    if (attempt >= maxAllowedAttempts || !policyAllowsRetry) {
      throw isTimeout
        ? new RetryTimeoutError(attempt, opts.timeoutMs, outcome.error)
        : new RetryNetworkError(attempt, outcome.error);
    }

    const delayMs = computeBackoffDelay(attempt, opts);
    const info: RetryAttemptInfo = {
      attempt,
      maxAttempts: opts.maxAttempts,
      delayMs,
      reason: isTimeout
        ? { type: "timeout", timeoutMs: opts.timeoutMs }
        : { type: "network-error", error: outcome.error },
    };
    opts.onRetry?.(info);
    await waitFor(delayMs, callerSignal);
  }
}

function getCallerSignal(
  input: FetchInput,
  init?: RequestInit,
): AbortSignal | null | undefined {
  if (init !== undefined && "signal" in init) {
    return init.signal;
  }
  if (isRequest(input)) {
    return input.signal;
  }
  return undefined;
}

async function performAttempt(
  input: FetchInput,
  init: RequestInit | undefined,
  timeoutMs: number,
  callerSignal: AbortSignal | null | undefined,
): Promise<AttemptOutcome> {
  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const onCallerAbort = (): void => {
    controller.abort(callerSignal?.reason);
  };
  if (callerSignal) {
    if (callerSignal.aborted) {
      throw createAbortError(callerSignal);
    }
    callerSignal.addEventListener("abort", onCallerAbort);
  }
  if (timeoutMs > 0) {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort(new AttemptTimeoutError(timeoutMs));
    }, timeoutMs);
  }

  try {
    const response = await globalThis.fetch(input, {
      ...init,
      signal: controller.signal,
    });
    return { ok: true, response };
  } catch (error) {
    if (callerSignal?.aborted) {
      throw createAbortError(callerSignal);
    }
    return { ok: false, failure: timedOut ? "timeout" : "network", error };
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    callerSignal?.removeEventListener("abort", onCallerAbort);
  }
}

async function discardBody(response: Response): Promise<void> {
  const body = response.body;
  if (body === null || body === undefined) {
    return;
  }
  try {
    await body.cancel();
  } catch {
    // The response is discarded before retrying; cancellation errors are irrelevant.
  }
}
