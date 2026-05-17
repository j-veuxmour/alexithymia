import { CancelledError, TimeoutError } from '@alexithymia/shared-errors';

/**
 * Promise-based sleep. Resolves after `ms` milliseconds, or rejects with
 * CancelledError if `signal` aborts.
 */
export const sleep = (ms: number, signal?: AbortSignal): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new CancelledError('sleep aborted', { cause: signal.reason }));
      return;
    }
    const timer = setTimeout(() => {
      if (signal !== undefined) signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new CancelledError('sleep aborted', { cause: signal?.reason }));
    };
    if (signal !== undefined) signal.addEventListener('abort', onAbort, { once: true });
  });
};

/**
 * Race a promise against a timeout. Rejects with TimeoutError if the
 * promise does not settle in time. The underlying promise is not cancelled.
 */
export const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  message = 'operation timed out',
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(message, { context: { timeoutMs } }));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

export interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T | PromiseLike<T>) => void;
  readonly reject: (reason?: unknown) => void;
}

/** Externalize a Promise's resolve/reject. */
export const defer = <T>(): Deferred<T> => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

/**
 * Run `worker` over `items` with at most `limit` in flight. Preserves input
 * order in the returned results array.
 */
export const parallelLimit = async <T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError('parallelLimit: limit must be a positive integer');
  }
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runnerCount = Math.min(limit, items.length);
  const runners = Array.from({ length: runnerCount }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      const item = items[index] as T;
      results[index] = await worker(item, index);
    }
  });
  await Promise.all(runners);
  return results;
};
