import { isErr } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import { annualizedFeeYieldBps, projectFeesOverInterval } from '../src/fee-projector.js';
import { computeCurrentIL, lpValueLamports } from '../src/il-calculator.js';
import {
  medianPriceLamports,
  priceDivergenceBps,
  reconcileOraclePrices,
} from '../src/oracle-reconciler.js';
import type { OracleReading } from '../src/pricing.types.js';
import { dilutionBps } from '../src/tvl-impact.js';

// ── fee-projector propagation paths ──────────────────────────────────────

describe('projectFeesOverInterval — error propagation', () => {
  const baseInput = {
    dailyVolumeLamports: 1n,
    baseFeeBps: 30,
    positionShareBps: 5_000,
    intervalMs: 1_000,
    costBasisLamports: 1_000n,
  };

  it('rejects negative costBasisLamports', () => {
    expect(isErr(projectFeesOverInterval({ ...baseInput, costBasisLamports: -1n }))).toBe(true);
  });

  it('rejects negative dailyVolumeLamports', () => {
    expect(isErr(projectFeesOverInterval({ ...baseInput, dailyVolumeLamports: -1n }))).toBe(true);
  });

  it('propagates Err from feesEarnedFromVolume (bad bps)', () => {
    expect(isErr(projectFeesOverInterval({ ...baseInput, baseFeeBps: 10_001 }))).toBe(true);
    expect(isErr(projectFeesOverInterval({ ...baseInput, positionShareBps: -1 }))).toBe(true);
  });
});

describe('annualizedFeeYieldBps — error propagation', () => {
  it('rejects negative earnedLamports', () => {
    expect(isErr(annualizedFeeYieldBps(-1n, 1_000n, 1_000))).toBe(true);
  });

  it('rejects negative costBasisLamports (not zero)', () => {
    expect(isErr(annualizedFeeYieldBps(0n, -1n, 1_000))).toBe(true);
  });
});

// ── il-calculator propagation paths ──────────────────────────────────────

describe('lpValueLamports — error propagation', () => {
  it('propagates Err from the quote leg', () => {
    const r = lpValueLamports(
      { amount: 1n, decimals: 9 },
      { amount: -1n, decimals: 9 }, // quote invalid
      1n,
      1n,
    );
    expect(isErr(r)).toBe(true);
  });
});

describe('computeCurrentIL — error propagation', () => {
  const valid = { amount: 1_000_000_000n, decimals: 9 };

  it('propagates Err when current LP value computation fails', () => {
    const r = computeCurrentIL({
      initialBase: valid,
      initialQuote: valid,
      currentBase: { amount: -1n, decimals: 9 }, // invalid
      currentQuote: valid,
      currentBasePriceLamports: 1n,
      currentQuotePriceLamports: 1n,
    });
    expect(isErr(r)).toBe(true);
  });

  it('propagates Err when HODL value computation fails', () => {
    const r = computeCurrentIL({
      initialBase: { amount: -1n, decimals: 9 }, // invalid
      initialQuote: valid,
      currentBase: valid,
      currentQuote: valid,
      currentBasePriceLamports: 1n,
      currentQuotePriceLamports: 1n,
    });
    expect(isErr(r)).toBe(true);
  });

  it('propagates Err when impermanentLossBps fails (hodl = 0)', () => {
    const zero = { amount: 0n, decimals: 9 };
    const r = computeCurrentIL({
      initialBase: zero,
      initialQuote: zero,
      currentBase: valid,
      currentQuote: valid,
      currentBasePriceLamports: 1_000_000_000n,
      currentQuotePriceLamports: 1_000_000_000n,
    });
    expect(isErr(r)).toBe(true);
  });
});

// ── oracle-reconciler additional branches ───────────────────────────────

describe('medianPriceLamports — equal-price sort branch', () => {
  it('handles all-equal readings (covers comparator equality branch)', () => {
    const r = medianPriceLamports([
      { source: 'a', priceLamports: 100n, timestamp: 0 },
      { source: 'b', priceLamports: 100n, timestamp: 0 },
      { source: 'c', priceLamports: 100n, timestamp: 0 },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(100n);
  });
});

describe('reconcileOraclePrices — divergence Err propagation', () => {
  it('propagates Err from priceDivergenceBps when a reading has price 0', () => {
    // A 0-priced reading slips past staleness, divergence call fails.
    const readings: readonly OracleReading[] = [
      { source: 'pyth', priceLamports: 1_000n, timestamp: 0 },
      { source: 'bad', priceLamports: 0n, timestamp: 0 },
    ];
    const r = reconcileOraclePrices(readings, {
      maxDivergenceBps: 100,
      maxAgeMs: 1_000_000,
      now: 0,
    });
    expect(isErr(r)).toBe(true);
  });
});

describe('priceDivergenceBps — sort branches', () => {
  it('returns same result regardless of arg order', () => {
    const r1 = priceDivergenceBps(100n, 110n);
    const r2 = priceDivergenceBps(110n, 100n);
    expect(r1.ok && r2.ok && r1.value === r2.value).toBe(true);
  });
});

// ── tvl-impact ──────────────────────────────────────────────────────────

describe('dilutionBps — negative TVL', () => {
  it('rejects negative preDepositTvlLamports', () => {
    expect(isErr(dilutionBps(1_000, 100n, -1n))).toBe(true);
  });
});
