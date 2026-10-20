export type FetchInput = string | URL | Request;

export type RetryReason =
  | {
      readonly type: "http-status";
      readonly status: number;
      readonly retryAfterMs: number | null;
    }
  | { readonly type: "network-error"; readonly error: unknown }
  | { readonly type: "timeout"; readonly timeoutMs: number };

export interface RetryAttemptInfo {
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly delayMs: number;
  readonly reason: RetryReason;
}

export interface FetchRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
  retryableStatuses?: readonly number[];
  retryOnNetworkError?: boolean;
  retryOnTimeout?: boolean;
  retryNonIdempotent?: boolean;
  onRetry?: (info: RetryAttemptInfo) => void;
}
