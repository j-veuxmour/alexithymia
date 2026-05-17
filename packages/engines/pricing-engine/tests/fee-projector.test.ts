import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import {
  annualizedFeeYieldBps,
  feesEarnedFromVolume,
  projectFeesOverInterval,
} from '../src/fee-projector.js';

describe('feesEarnedFromVolume', () => {
  it('1e12 volume @ 30 bps fee @ 100 % share → 3e9 lamports', () => {
    const r = unwrap(
      feesEarnedFromVolume({
        effectiveVolumeLamports: 1_000_000_000_000n,
        baseFeeBps: 30,
        positionShareBps: 10_000,
      }),
    );
    expect(r).toBe(3_000_000_000n);
  });

  it('halves when share halves', () => {
    const r = unwrap(
      feesEarnedFromVolume({
        effectiveVolumeLamports: 1_000_000_000_000n,
        baseFeeBps: 30,
        positionShareBps: 5_000,
      }),
    );
    expect(r).toBe(1_500_000_000n);
  });

  it('zero volume → zero fees', () => {
    const r = unwrap(
      feesEarnedFromVolume({
        effectiveVolumeLamports: 0n,
        baseFeeBps: 30,
        positionShareBps: 10_000,
      }),
    );
    expect(r).toBe(0n);
  });

  it('zero fee bps → zero fees', () => {
    const r = unwrap(
      feesEarnedFromVolume({
        effectiveVolumeLamports: 1_000_000_000n,
        baseFeeBps: 0,
        positionShareBps: 10_000,
      }),
    );
    expect(r).toBe(0n);
  });

  it('rejects out-of-range bps', () => {
    expect(
      isErr(
        feesEarnedFromVolume({
          effectiveVolumeLamports: 1n,
          baseFeeBps: 10_001,
          positionShareBps: 1,
        }),
      ),
    ).toBe(true);
    expect(
      isErr(
        feesEarnedFromVolume({
          effectiveVolumeLamports: 1n,
          baseFeeBps: 1,
          positionShareBps: -1,
        }),
      ),
    ).toBe(true);
  });

  it('rejects negative volume', () => {
    expect(
      isErr(
        feesEarnedFromVolume({
          effectiveVolumeLamports: -1n,
          baseFeeBps: 1,
          positionShareBps: 1,
        }),
      ),
    ).toBe(true);
  });
});

describe('projectFeesOverInterval', () => {
  it('one-day horizon equals one-day volume × fee × share', () => {
    const ONE_DAY = 24 * 60 * 60 * 1_000;
    // 1e12 lamports/day * 30 bps * 100 % share = 3e9 earned
    // yieldBps = earned / costBasis * 10_000 = 3e9 / 1e10 * 10_000 = 3_000
    const r = unwrap(
      projectFeesOverInterval({
        dailyVolumeLamports: 1_000_000_000_000n,
        baseFeeBps: 30,
        positionShareBps: 10_000,
        intervalMs: ONE_DAY,
        costBasisLamports: 10_000_000_000n,
      }),
    );
    expect(r.earnedLamports).toBe(3_000_000_000n);
    expect(r.effectiveYieldBps).toBe(3_000);
    expect(r.periodMs).toBe(ONE_DAY);
  });

  it('rejects zero cost basis', () => {
    expect(
      isErr(
        projectFeesOverInterval({
          dailyVolumeLamports: 1n,
          baseFeeBps: 1,
          positionShareBps: 1,
          intervalMs: 1_000,
          costBasisLamports: 0n,
        }),
      ),
    ).toBe(true);
  });

  it('rejects non-positive interval', () => {
    expect(
      isErr(
        projectFeesOverInterval({
          dailyVolumeLamports: 1n,
          baseFeeBps: 1,
          positionShareBps: 1,
          intervalMs: 0,
          costBasisLamports: 1n,
        }),
      ),
    ).toBe(true);
  });
});

describe('annualizedFeeYieldBps', () => {
  it('1 % over 1 day → ~365 % APY simple', () => {
    // earned 1 % of 1 SOL over 24h. Annualized ≈ 365 % = 36_500 bps
    // (1 % = 100 bps, so 365 % = 36_500 bps).
    const ONE_DAY = 24 * 60 * 60 * 1_000;
    const r = unwrap(annualizedFeeYieldBps(10_000_000n, 1_000_000_000n, ONE_DAY));
    expect(r).toBe(36_500);
  });

  it('zero earned → 0 bps', () => {
    expect(unwrap(annualizedFeeYieldBps(0n, 1_000n, 1_000))).toBe(0);
  });

  it('rejects zero cost basis', () => {
    expect(isErr(annualizedFeeYieldBps(1n, 0n, 1_000))).toBe(true);
  });

  it('rejects non-positive interval', () => {
    expect(isErr(annualizedFeeYieldBps(1n, 1n, 0))).toBe(true);
  });
});
