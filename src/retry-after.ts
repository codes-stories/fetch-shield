const DELTA_SECONDS_PATTERN = /^\d+$/;
const NUMERIC_LOOKING_PATTERN = /^[+\-\d]/;

export function isRetryAfterStatus(status: number): boolean {
  return status === 429 || status === 503;
}

export function parseRetryAfter(
  value: string | null | undefined,
  nowMs: number = Date.now(),
): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  if (DELTA_SECONDS_PATTERN.test(trimmed)) {
    const delayMs = Number(trimmed) * 1000;
    return Number.isFinite(delayMs) ? delayMs : null;
  }
  if (NUMERIC_LOOKING_PATTERN.test(trimmed)) {
    return null;
  }
  const dateMs = Date.parse(trimmed);
  if (Number.isNaN(dateMs)) {
    return null;
  }
  return Math.max(0, dateMs - nowMs);
}
