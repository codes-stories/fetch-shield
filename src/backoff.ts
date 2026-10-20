import { createAbortError } from "./errors.ts";

export const JITTER_FLOOR_RATIO = 0.5;

export interface BackoffConfig {
  baseDelayMs: number;
  maxDelayMs: number;
  random?: () => number;
}

export function computeBackoffDelay(
  attempt: number,
  config: BackoffConfig,
): number {
  const safeAttempt =
    Number.isFinite(attempt) && attempt >= 1 ? Math.floor(attempt) : 1;
  const exponential = config.baseDelayMs * 2 ** (safeAttempt - 1);
  const capped = Math.min(config.maxDelayMs, exponential);
  const random = config.random ?? Math.random;
  return capped * jitterRatio(random());
}

export function waitFor(
  delayMs: number,
  signal?: AbortSignal | null,
): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(createAbortError(signal));
  }
  if (!(delayMs > 0)) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(createAbortError(signal));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    signal?.addEventListener("abort", onAbort);
  });
}

function jitterRatio(sample: number): number {
  if (!Number.isFinite(sample)) {
    return 1;
  }
  const clamped = Math.min(1, Math.max(0, sample));
  return JITTER_FLOOR_RATIO + (1 - JITTER_FLOOR_RATIO) * clamped;
}
