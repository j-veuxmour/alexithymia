import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDuration, isExpired, now, parseDuration } from '../src/time.js';

describe('parseDuration', () => {
  it.each([
    ['100ms', 100],
    ['5s', 5_000],
    ['2m', 120_000],
    ['3h', 10_800_000],
    ['1d', 86_400_000],
    ['1.5s', 1_500],
    ['  10m ', 600_000],
  ])('%s parses to %d ms', (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });

  it.each(['', 'abc', '10', '10x', '5min', 'h5'])('rejects %s', (bad) => {
    expect(() => parseDuration(bad)).toThrow(RangeError);
  });
});

describe('formatDuration', () => {
  it('formats sub-second', () => {
    expect(formatDuration(250)).toBe('250ms');
  });
  it('formats seconds', () => {
    expect(formatDuration(2_500)).toBe('2.5s');
  });
  it('formats minutes', () => {
    expect(formatDuration(150_000)).toBe('2.5m');
  });
  it('formats hours', () => {
    expect(formatDuration(2 * 3_600_000)).toBe('2.0h');
  });
  it('formats days', () => {
    expect(formatDuration(2 * 86_400_000)).toBe('2.0d');
  });
  it('rejects non-finite', () => {
    expect(() => formatDuration(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('isExpired / now', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('now returns current Date.now()', () => {
    expect(now()).toBe(Date.parse('2026-01-01T00:00:00Z'));
  });

  it('isExpired true when deadline <= now', () => {
    const t = now();
    expect(isExpired(t)).toBe(true);
    expect(isExpired(t - 1)).toBe(true);
  });

  it('isExpired false when deadline > now', () => {
    expect(isExpired(now() + 1_000)).toBe(false);
  });
});
