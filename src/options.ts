import { InvalidRetryOptionsError } from "./errors.ts";
import type { FetchRetryOptions, RetryAttemptInfo } from "./types.ts";

export interface ResolvedRetryOptions {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly timeoutMs: number;
  readonly retryableStatuses: readonly number[];
  readonly retryOnNetworkError: boolean;
  readonly retryOnTimeout: boolean;
  readonly retryNonIdempotent: boolean;
  readonly onRetry?: (info: RetryAttemptInfo) => void;
}

export const DEFAULT_RETRYABLE_STATUSES: readonly number[] = Object.freeze([
  429, 500, 502, 503, 504,
]);

export const DEFAULT_RETRY_OPTIONS: ResolvedRetryOptions = Object.freeze({
  maxAttempts: 3,
  baseDelayMs: 300,
  maxDelayMs: 5000,
  timeoutMs: 10_000,
  retryableStatuses: DEFAULT_RETRYABLE_STATUSES,
  retryOnNetworkError: true,
  retryOnTimeout: true,
  retryNonIdempotent: false,
});

const KNOWN_OPTION_KEYS: ReadonlySet<string> = new Set([
  "maxAttempts",
  "baseDelayMs",
  "maxDelayMs",
  "timeoutMs",
  "retryableStatuses",
  "retryOnNetworkError",
  "retryOnTimeout",
  "retryNonIdempotent",
  "onRetry",
]);

export function resolveRetryOptions(
  options?: FetchRetryOptions,
): ResolvedRetryOptions {
  if (options === undefined) {
    return DEFAULT_RETRY_OPTIONS;
  }
  if (
    options === null ||
    typeof options !== "object" ||
    Array.isArray(options)
  ) {
    throw new InvalidRetryOptionsError(
      `Invalid fetch-shield options: expected an options object, received ${describe(options)}`,
    );
  }

  const input = options as Record<string, unknown>;
  const issues: string[] = [];

  for (const key of Object.keys(input)) {
    if (!KNOWN_OPTION_KEYS.has(key)) {
      issues.push(`"${key}" is not a recognized option`);
    }
  }

  const maxAttempts = validatePositiveInteger(
    input.maxAttempts,
    "maxAttempts",
    1,
    issues,
  );
  const baseDelayMs = validateNonNegativeNumber(
    input.baseDelayMs,
    "baseDelayMs",
    DEFAULT_RETRY_OPTIONS.baseDelayMs,
    issues,
  );
  const maxDelayMs = validateNonNegativeNumber(
    input.maxDelayMs,
    "maxDelayMs",
    DEFAULT_RETRY_OPTIONS.maxDelayMs,
    issues,
  );
  const timeoutMs = validateNonNegativeNumber(
    input.timeoutMs,
    "timeoutMs",
    DEFAULT_RETRY_OPTIONS.timeoutMs,
    issues,
  );
  const retryableStatuses = validateRetryableStatuses(
    input.retryableStatuses,
    issues,
  );
  const retryOnNetworkError = validateBoolean(
    input.retryOnNetworkError,
    "retryOnNetworkError",
    true,
    issues,
  );
  const retryOnTimeout = validateBoolean(
    input.retryOnTimeout,
    "retryOnTimeout",
    true,
    issues,
  );
  const retryNonIdempotent = validateBoolean(
    input.retryNonIdempotent,
    "retryNonIdempotent",
    false,
    issues,
  );
  const onRetry = validateOnRetry(input.onRetry, issues);

  if (issues.length > 0) {
    throw new InvalidRetryOptionsError(
      `Invalid fetch-shield options: ${issues.join("; ")}`,
    );
  }

  return {
    maxAttempts,
    baseDelayMs,
    maxDelayMs,
    timeoutMs,
    retryableStatuses,
    retryOnNetworkError,
    retryOnTimeout,
    retryNonIdempotent,
    onRetry,
  };
}

function validatePositiveInteger(
  value: unknown,
  name: string,
  min: number,
  issues: string[],
): number {
  if (value === undefined) {
    return DEFAULT_RETRY_OPTIONS.maxAttempts;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < min) {
    issues.push(
      `"${name}" must be an integer >= ${min}, received ${describe(value)}`,
    );
    return DEFAULT_RETRY_OPTIONS.maxAttempts;
  }
  return value;
}

function validateNonNegativeNumber(
  value: unknown,
  name: string,
  fallback: number,
  issues: string[],
): number {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    issues.push(
      `"${name}" must be a finite number >= 0, received ${describe(value)}`,
    );
    return fallback;
  }
  return value;
}

function validateRetryableStatuses(
  value: unknown,
  issues: string[],
): readonly number[] {
  if (value === undefined) {
    return DEFAULT_RETRYABLE_STATUSES;
  }
  if (!Array.isArray(value)) {
    issues.push(
      `"retryableStatuses" must be an array of HTTP status codes, received ${describe(value)}`,
    );
    return DEFAULT_RETRYABLE_STATUSES;
  }
  const statuses = new Set<number>();
  value.forEach((entry, index) => {
    if (
      typeof entry !== "number" ||
      !Number.isInteger(entry) ||
      entry < 100 ||
      entry > 599
    ) {
      issues.push(
        `"retryableStatuses" must contain integer status codes between 100 and 599, received ${describe(entry)} at index ${index}`,
      );
      return;
    }
    statuses.add(entry);
  });
  return Object.freeze([...statuses]);
}

function validateBoolean(
  value: unknown,
  name: string,
  fallback: boolean,
  issues: string[],
): boolean {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    issues.push(`"${name}" must be a boolean, received ${describe(value)}`);
    return fallback;
  }
  return value;
}

function validateOnRetry(
  value: unknown,
  issues: string[],
): ((info: RetryAttemptInfo) => void) | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "function") {
    issues.push(`"onRetry" must be a function, received ${describe(value)}`);
    return undefined;
  }
  return value as (info: RetryAttemptInfo) => void;
}

function describe(value: unknown): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "an array";
  }
  if (typeof value === "function") {
    return "a function";
  }
  if (typeof value === "object") {
    return "an object";
  }
  return String(value);
}
