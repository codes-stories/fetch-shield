export interface TimerTracker {
  readonly created: number;
  readonly cleared: number;
  readonly pendingCount: number;
  restore(): void;
}

export function trackTimers(): TimerTracker {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const pending = new Set<object>();
  let created = 0;
  let cleared = 0;

  globalThis.setTimeout = function (
    callback: (...args: unknown[]) => void,
    ms?: number,
    ...args: unknown[]
  ) {
    created += 1;
    const wrapped = (...callArgs: unknown[]): void => {
      pending.delete(handle);
      callback(...callArgs);
    };
    const handle = originalSetTimeout(wrapped, ms, ...args);
    pending.add(handle);
    return handle;
  } as typeof globalThis.setTimeout;

  globalThis.clearTimeout = function (handle?: object) {
    if (handle !== undefined && pending.delete(handle)) {
      cleared += 1;
    }
    originalClearTimeout(handle as never);
  } as typeof globalThis.clearTimeout;

  return {
    get created() {
      return created;
    },
    get cleared() {
      return cleared;
    },
    get pendingCount() {
      return pending.size;
    },
    restore() {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    },
  };
}
