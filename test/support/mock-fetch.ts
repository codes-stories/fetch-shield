export interface RecordedFetchCall {
  readonly input: unknown;
  readonly init: RequestInit | undefined;
}

export type FetchHandler = (
  call: RecordedFetchCall,
  index: number,
) => Response | Promise<Response>;

export interface FetchMock {
  readonly calls: RecordedFetchCall[];
  restore(): void;
}

export function installFetchMock(handler: FetchHandler): FetchMock {
  const original = globalThis.fetch;
  const calls: RecordedFetchCall[] = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const call: RecordedFetchCall = { input, init };
    const index = calls.length;
    calls.push(call);
    return handler(call, index);
  }) as typeof globalThis.fetch;
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

export function http(status: number, headers?: Record<string, string>): Response {
  return new Response(null, { status, headers });
}

export function hangUntilAborted(): FetchHandler {
  return ({ init }) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal ?? undefined;
      if (signal === undefined) {
        return;
      }
      const onAbort = (): void => {
        reject(signal.reason);
      };
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    });
}
