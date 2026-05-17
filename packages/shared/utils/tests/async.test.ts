import { CancelledError, TimeoutError } from '@alexithymia/shared-errors';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defer, parallelLimit, sleep, withTimeout } from '../src/async.js';

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves after the specified delay', async () => {
    const p = sleep(100);
    await vi.advanceTimersByTimeAsync(100);
    await expect(p).resolves.toBeUndefined();
  });

  it('rejects with CancelledError when signal is pre-aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(sleep(50, ac.signal)).rejects.toBeInstanceOf(CancelledError);
  });

  it('rejects with CancelledError when signal aborts mid-flight', async () => {
    const ac = new AbortController();
    const p = sleep(1_000, ac.signal);
    ac.abort();
    await expect(p).rejects.toBeInstanceOf(CancelledError);
  });

  it('completes normally when a non-aborting signal is supplied', async () => {
    // Exercises the timer path that detaches the abort listener.
    const ac = new AbortController();
    const p = sleep(100, ac.signal);
    await vi.advanceTimersByTimeAsync(100);
    await expect(p).resolves.toBeUndefined();
  });
});

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves when promise wins', async () => {
    const p = withTimeout(Promise.resolve('fast'), 100);
    await expect(p).resolves.toBe('fast');
  });

  it('rejects with TimeoutError when timer wins', async () => {
    const slow = new Promise<string>((resolve) => {
      setTimeout(() => resolve('late'), 10_000);
    });
    const p = withTimeout(slow, 100);
    // Attach the assertion synchronously so the rejection never goes unhandled.
    const assertion = expect(p).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });
});

describe('defer', () => {
  it('externalizes resolve', async () => {
    const d = defer<number>();
    d.resolve(7);
    await expect(d.promise).resolves.toBe(7);
  });

  it('externalizes reject', async () => {
    const d = defer<number>();
    d.reject(new Error('nope'));
    await expect(d.promise).rejects.toThrow('nope');
  });
});

describe('parallelLimit', () => {
  it('preserves order of results', async () => {
    const items = [1, 2, 3, 4, 5];
    const result = await parallelLimit(items, 2, async (n) => n * 10);
    expect(result).toEqual([10, 20, 30, 40, 50]);
  });

  it('respects concurrency limit', async () => {
    let active = 0;
    let peak = 0;
    const items = [1, 2, 3, 4, 5, 6];
    await parallelLimit(items, 2, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active -= 1;
    });
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('rejects invalid limit', async () => {
    await expect(parallelLimit([1], 0, async (n) => n)).rejects.toThrow(RangeError);
  });

  it('returns empty array on empty input', async () => {
    const r = await parallelLimit<number, number>([], 3, async (n) => n);
    expect(r).toEqual([]);
  });
});
