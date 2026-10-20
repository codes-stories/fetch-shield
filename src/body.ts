import type { FetchInput } from "./types.ts";

const IDEMPOTENT_METHODS: ReadonlySet<string> = new Set([
  "GET",
  "HEAD",
  "OPTIONS",
  "TRACE",
  "PUT",
  "DELETE",
]);

export function isRequest(value: FetchInput): value is Request {
  return typeof Request !== "undefined" && value instanceof Request;
}

export function getRequestMethod(
  input: FetchInput,
  init?: RequestInit,
): string {
  let method = init?.method;
  if (method === undefined || method === "") {
    method = isRequest(input) ? input.method : "GET";
  }
  const normalized = method.trim().toUpperCase();
  return normalized === "" ? "GET" : normalized;
}

export function isIdempotentMethod(method: string): boolean {
  return IDEMPOTENT_METHODS.has(method.toUpperCase());
}

export function isBodyReplayable(
  input: FetchInput,
  init?: RequestInit,
): boolean {
  const body = init?.body;
  if (body !== undefined && body !== null) {
    return !isStreamBody(body);
  }
  if (isRequest(input)) {
    return input.body === null;
  }
  return true;
}

function isStreamBody(body: NonNullable<RequestInit["body"]>): boolean {
  if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) {
    return true;
  }
  if (typeof body === "object" && body !== null && "pipe" in body) {
    const candidate = body as { pipe?: unknown };
    if (typeof candidate.pipe === "function") {
      return true;
    }
  }
  return false;
}
