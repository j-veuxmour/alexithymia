import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import {
  isVolatilityTimeframeAdequate,
  normalizeVolatilityTimeframe,
  scaleVolatility,
} from '../src/volatility-normalizer.js';

describe('normalizeVolatilityTimeframe', () => {
  it('5m → 30m by default floor', () => {
    expect(unwrap(normalizeVolatilityTimeframe('5m'))).toBe('30m');
  });
  it('15m → 30m', () => {
    expect(unwrap(normalizeVolatilityTimeframe('15m'))).toBe('30m');
  });
  it('30m → 30m (boundary stays)', () => {
    expect(unwrap(normalizeVolatilityTimeframe('30m'))).toBe('30m');
  });
  it('1h → 1h (already above floor)', () => {
    expect(unwrap(normalizeVolatilityTimeframe('1h'))).toBe('1h');
  });
  it('honors custom floor', () => {
    expect(unwrap(normalizeVolatilityTimeframe('30m', '1h'))).toBe('1h');
    expect(unwrap(normalizeVolatilityTimeframe('4h', '1h'))).toBe('4h');
  });
  it('rejects unknown source', () => {
    expect(isErr(normalizeVolatilityTimeframe('7m' as unknown as '5m'))).toBe(true);
  });
  it('rejects unknown floor', () => {
    expect(
      isErr(normalizeVolatilityTimeframe('1h', 'bogus' as unknown as '30m')),
    ).toBe(true);
  });
});

describe('scaleVolatility', () => {
  it('same timeframe returns same volatility', () => {
    expect(unwrap(scaleVolatility(0.05, '1h', '1h'))).toBe(0.05);
  });

  it('scales up by sqrt(4) when going 1h → 4h', () => {
    expect(unwrap(scaleVolatility(0.05, '1h', '4h'))).toBeCloseTo(0.05 * 2, 10);
  });

  it('scales down 4h → 1h by sqrt(1/4)', () => {
    expect(unwrap(scaleVolatility(0.10, '4h', '1h'))).toBeCloseTo(0.05, 10);
  });

  it('zero stays zero across timeframes', () => {
    expect(unwrap(scaleVolatility(0, '30m', '24h'))).toBe(0);
  });

  it('rejects negative volatility', () => {
    expect(isErr(scaleVolatility(-0.01, '1h', '1h'))).toBe(true);
  });

  it('rejects non-finite volatility', () => {
    expect(isErr(scaleVolatility(Number.NaN, '1h', '1h'))).toBe(true);
    expect(isErr(scaleVolatility(Number.POSITIVE_INFINITY, '1h', '1h'))).toBe(true);
  });

  it('rejects unknown timeframes', () => {
    expect(isErr(scaleVolatility(0.05, 'bogus' as unknown as '1h', '1h'))).toBe(true);
    expect(isErr(scaleVolatility(0.05, '1h', 'bogus' as unknown as '4h'))).toBe(true);
  });
});

describe('isVolatilityTimeframeAdequate', () => {
  it('30m is adequate by default', () => {
    expect(unwrap(isVolatilityTimeframeAdequate('30m'))).toBe(true);
  });
  it('5m is inadequate by default', () => {
    expect(unwrap(isVolatilityTimeframeAdequate('5m'))).toBe(false);
  });
  it('honours custom minimum', () => {
    expect(unwrap(isVolatilityTimeframeAdequate('30m', '1h'))).toBe(false);
    expect(unwrap(isVolatilityTimeframeAdequate('4h', '1h'))).toBe(true);
  });
  it('rejects unknown inputs', () => {
    expect(
      isErr(isVolatilityTimeframeAdequate('weird' as unknown as '1h')),
    ).toBe(true);
    expect(
      isErr(isVolatilityTimeframeAdequate('1h', 'weird' as unknown as '30m')),
    ).toBe(true);
  });
});
