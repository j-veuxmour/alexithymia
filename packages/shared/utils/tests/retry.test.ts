import { CancelledError, RetryExhaustedError, isErr, isOk } from '@alexithymia/shared-errors';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { retry } from '../src/retry.js';

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns Ok on first success', async () => {
    const fn = vi.fn().mockResolvedValue('hello');
    const r = await retry(fn, { maxAttempts: 3, initialDelayMs: 10 });
    expect(isOk(r)).toBe(true);
    if (r.ok) expect(r.value).toBe('hello');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries until success', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('a'))
      .mockRejectedValueOnce(new Error('b'))
      .mockResolvedValue('ok');
    const p = retry(fn, { maxAttempts: 5, initialDelayMs: 10, jitter: 0 });
    await vi.runAllTimersAsync();
    const r = await p;
    expect(isOk(r)).toBe(true);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('returns Err(RetryExhaustedError) when budget runs out', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always'));
    const p = retry(fn, { maxAttempts: 3, initialDelayMs: 5, jitter: 0 });
    await vi.runAllTimersAsync();
    const r = await p;
    expect(isErr(r)).toBe(true);
    if (!r.ok) expect(r.error).toBeInstanceOf(RetryExhaustedError);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('honors shouldRetry predicate', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fatal'));
    const p = retry(fn, {
      maxAttempts: 5,
      initialDelayMs: 5,
      jitter: 0,
      shouldRetry: () => false,
    });
    await vi.runAllTimersAsync();
    const r = await p;
    expect(isErr(r)).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('aborts when signal triggers during backoff', async () => {
    const ac = new AbortController();
    const fn = vi.fn().mockRejectedValue(new Error('x'));
    const p = retry(fn, {
      maxAttempts: 5,
      initialDelayMs: 1_000,
      jitter: 0,
      signal: ac.signal,
    });
    // first attempt runs and fails, then sleeps
    await vi.advanceTimersByTimeAsync(0);
    ac.abort();
    await vi.runAllTimersAsync();
    const r = await p;
    expect(isErr(r)).toBe(true);
    if (!r.ok) expect(r.error).toBeInstanceOf(CancelledError);
  });

  it('rejects invalid maxAttempts', async () => {
    await expect(retry(async () => 1, { maxAttempts: 0, initialDelayMs: 0 })).rejects.toThrow(
      RangeError,
    );
  });

  it('rejects invalid jitter', async () => {
    await expect(
      retry(async () => 1, { maxAttempts: 1, initialDelayMs: 0, jitter: 2 }),
    ).rejects.toThrow(RangeError);
  });
});
