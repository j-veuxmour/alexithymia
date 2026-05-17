import {
  CancelledError,
  type Result,
  RetryExhaustedError,
  err,
  ok,
} from '@alexithymia/shared-errors';
import { sleep } from './async.js';

export interface RetryOptions {
  /** Maximum number of attempts including the initial one. Must be >= 1. */
  readonly maxAttempts: number;
  /** Base delay before the second attempt, in milliseconds. */
  readonly initialDelayMs: number;
  /** Hard upper bound for delay between attempts. Defaults to no cap. */
  readonly maxDelayMs?: number;
  /** Multiplier applied to the delay after each failed attempt. Default 2. */
  readonly backoffMultiplier?: number;
  /** Jitter as a fraction of current delay (0..1). Default 0.1 (±10 %). */
  readonly jitter?: number;
  /** Caller-supplied abort signal to short-circuit retries. */
  readonly signal?: AbortSignal;
  /** Predicate to gate retry on a specific error. Default: always retry. */
  readonly shouldRetry?: (error: unknown, attempt: number) => boolean;
}

/**
 * Retry an async operation with exponential backoff and bounded jitter.
 *
 * Returns Ok with the first successful value, or Err(RetryExhaustedError)
 * when the budget is consumed. Aborts immediately on signal cancellation.
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<Result<T, RetryExhaustedError | CancelledError>> => {
  const {
    maxAttempts,
    initialDelayMs,
    maxDelayMs = Number.POSITIVE_INFINITY,
    backoffMultiplier = 2,
    jitter = 0.1,
    signal,
    shouldRetry = () => true,
  } = options;

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError('retry: maxAttempts must be a positive integer');
  }
  if (initialDelayMs < 0) throw new RangeError('retry: initialDelayMs must be >= 0');
  if (jitter < 0 || jitter > 1) throw new RangeError('retry: jitter must be in [0, 1]');

  let delay = initialDelayMs;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (signal?.aborted) {
      return err(new CancelledError('retry aborted', { cause: signal.reason }));
    }
    try {
      return ok(await fn());
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts || !shouldRetry(error, attempt)) break;
      const jitterMs = delay * jitter * (Math.random() * 2 - 1);
      const wait = Math.max(0, delay + jitterMs);
      try {
        await sleep(wait, signal);
      } catch (e) {
        if (e instanceof CancelledError) return err(e);
        throw e;
      }
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  return err(
    new RetryExhaustedError('retry budget exhausted', {
      cause: lastError,
      context: { attempts: maxAttempts },
    }),
  );
};
