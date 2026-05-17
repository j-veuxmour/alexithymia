import { isErr, unwrap } from '@alexithymia/shared-errors';
import type { UnixMs } from '@alexithymia/shared-utils';
import { describe, expect, it } from 'vitest';
import {
  isOracleStale,
  medianPriceLamports,
  priceDivergenceBps,
  reconcileOraclePrices,
} from '../src/oracle-reconciler.js';
import type { OracleReading } from '../src/pricing.types.js';

const NOW = 1_700_000_000_000 as UnixMs;

const reading = (source: string, priceLamports: bigint, ageMs = 0): OracleReading => ({
  source,
  priceLamports,
  timestamp: (NOW - ageMs) as UnixMs,
});

describe('medianPriceLamports', () => {
  it('odd-length picks the middle', () => {
    const r = unwrap(
      medianPriceLamports([reading('a', 10n), reading('b', 20n), reading('c', 15n)]),
    );
    expect(r).toBe(15n);
  });

  it('even-length floor-averages two middles', () => {
    const r = unwrap(
      medianPriceLamports([
        reading('a', 10n),
        reading('b', 20n),
        reading('c', 30n),
        reading('d', 40n),
      ]),
    );
    expect(r).toBe(25n);
  });

  it('rejects empty input', () => {
    expect(isErr(medianPriceLamports([]))).toBe(true);
  });

  it('rejects negative prices', () => {
    expect(isErr(medianPriceLamports([reading('a', -1n)]))).toBe(true);
  });

  it('single-reading returns that price', () => {
    expect(unwrap(medianPriceLamports([reading('a', 7n)]))).toBe(7n);
  });
});

describe('priceDivergenceBps', () => {
  it('identical → 0 bps', () => {
    expect(unwrap(priceDivergenceBps(1_000n, 1_000n))).toBe(0);
  });

  it('1 % gap → 100 bps', () => {
    // a=100, b=101 → diff=1, min=100 → 1/100 * 10000 = 100 bps
    expect(unwrap(priceDivergenceBps(100n, 101n))).toBe(100);
  });

  it('100 % gap → 10_000 bps', () => {
    expect(unwrap(priceDivergenceBps(100n, 200n))).toBe(10_000);
  });

  it('rejects zero or negative input', () => {
    expect(isErr(priceDivergenceBps(0n, 1n))).toBe(true);
    expect(isErr(priceDivergenceBps(1n, 0n))).toBe(true);
    expect(isErr(priceDivergenceBps(-1n, 1n))).toBe(true);
  });
});

describe('isOracleStale', () => {
  it('returns false when within budget', () => {
    expect(isOracleStale(reading('a', 1n, 500), 1_000, NOW)).toBe(false);
  });

  it('returns true when older than budget', () => {
    expect(isOracleStale(reading('a', 1n, 2_000), 1_000, NOW)).toBe(true);
  });

  it('returns false at exactly the budget boundary', () => {
    expect(isOracleStale(reading('a', 1n, 1_000), 1_000, NOW)).toBe(false);
  });

  it('throws on negative or non-finite maxAgeMs', () => {
    expect(() => isOracleStale(reading('a', 1n), -1, NOW)).toThrow(RangeError);
    expect(() => isOracleStale(reading('a', 1n), Number.NaN, NOW)).toThrow(RangeError);
  });
});

describe('reconcileOraclePrices', () => {
  const opts = { maxDivergenceBps: 100, maxAgeMs: 5_000, now: NOW };

  it('returns median when all readings agree within tolerance', () => {
    const r = unwrap(
      reconcileOraclePrices(
        [reading('pyth', 1_000n), reading('birdeye', 1_005n), reading('jupiter', 1_002n)],
        opts,
      ),
    );
    expect(r.consensusLamports).toBe(1_002n);
    expect(r.usedReadings).toHaveLength(3);
  });

  it('rejects when any pair diverges past threshold', () => {
    // 1000 vs 1100 → 1000 bps > 100 bps cap.
    const result = reconcileOraclePrices(
      [reading('pyth', 1_000n), reading('birdeye', 1_100n)],
      opts,
    );
    expect(isErr(result)).toBe(true);
  });

  it('drops stale readings before checking divergence', () => {
    // The 1_100n reading is 10 s old → discarded. Surviving fresh ones agree.
    const r = unwrap(
      reconcileOraclePrices(
        [reading('pyth', 1_000n), reading('birdeye', 1_005n), reading('stale', 1_100n, 10_000)],
        opts,
      ),
    );
    expect(r.usedReadings).toHaveLength(2);
    expect(r.consensusLamports).toBe(1_002n); // floor-average of 1_000 and 1_005
  });

  it('errors when all readings are stale', () => {
    const r = reconcileOraclePrices(
      [reading('pyth', 1_000n, 10_000), reading('birdeye', 1_005n, 10_000)],
      opts,
    );
    expect(isErr(r)).toBe(true);
  });

  it('rejects invalid options', () => {
    expect(
      isErr(
        reconcileOraclePrices([reading('a', 1n)], {
          maxDivergenceBps: -1,
          maxAgeMs: 1_000,
          now: NOW,
        }),
      ),
    ).toBe(true);
    expect(
      isErr(
        reconcileOraclePrices([reading('a', 1n)], {
          maxDivergenceBps: 100,
          maxAgeMs: -1,
          now: NOW,
        }),
      ),
    ).toBe(true);
  });
});
