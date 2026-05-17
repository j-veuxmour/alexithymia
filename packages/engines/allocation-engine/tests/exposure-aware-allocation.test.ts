import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import { remainingCapacityLamports, sizePosition } from '../src/exposure-aware-allocation.js';

describe('remainingCapacityLamports', () => {
  it('returns headroom under exposure cap when free capital is larger', () => {
    // equity 10 SOL, deployed 3 SOL, max 50 % → cap = 5 SOL → headroom = 2 SOL
    // free = 4 SOL → result = min(2, 4) = 2 SOL
    const r = unwrap(
      remainingCapacityLamports({
        totalEquityLamports: 10_000_000_000n,
        deployedLamports: 3_000_000_000n,
        freeLamports: 4_000_000_000n,
        maxExposureBps: 5_000,
      }),
    );
    expect(r).toBe(2_000_000_000n);
  });

  it('returns freeLamports when free is the tighter constraint', () => {
    // headroom = 8 SOL, free = 1 SOL → result = 1 SOL
    const r = unwrap(
      remainingCapacityLamports({
        totalEquityLamports: 10_000_000_000n,
        deployedLamports: 0n,
        freeLamports: 1_000_000_000n,
        maxExposureBps: 8_000,
      }),
    );
    expect(r).toBe(1_000_000_000n);
  });

  it('returns 0 when already at or above the exposure cap', () => {
    // deployed 6 SOL, cap 5 SOL → headroom = -1 → 0
    const r = unwrap(
      remainingCapacityLamports({
        totalEquityLamports: 10_000_000_000n,
        deployedLamports: 6_000_000_000n,
        freeLamports: 100n,
        maxExposureBps: 5_000,
      }),
    );
    expect(r).toBe(0n);
  });

  it('returns 0 when exactly at the cap', () => {
    const r = unwrap(
      remainingCapacityLamports({
        totalEquityLamports: 10_000_000_000n,
        deployedLamports: 5_000_000_000n,
        freeLamports: 100n,
        maxExposureBps: 5_000,
      }),
    );
    expect(r).toBe(0n);
  });

  it('rejects negative inputs', () => {
    const base = {
      totalEquityLamports: 1n,
      deployedLamports: 1n,
      freeLamports: 1n,
      maxExposureBps: 1_000,
    };
    expect(isErr(remainingCapacityLamports({ ...base, totalEquityLamports: -1n }))).toBe(true);
    expect(isErr(remainingCapacityLamports({ ...base, deployedLamports: -1n }))).toBe(true);
    expect(isErr(remainingCapacityLamports({ ...base, freeLamports: -1n }))).toBe(true);
  });

  it('rejects out-of-range maxExposureBps', () => {
    const base = {
      totalEquityLamports: 1n,
      deployedLamports: 1n,
      freeLamports: 1n,
      maxExposureBps: 10_001,
    };
    expect(isErr(remainingCapacityLamports(base))).toBe(true);
    expect(isErr(remainingCapacityLamports({ ...base, maxExposureBps: -1 }))).toBe(true);
    expect(isErr(remainingCapacityLamports({ ...base, maxExposureBps: 1.5 }))).toBe(true);
  });
});

describe('sizePosition', () => {
  const limits = {
    freeLamports: 10_000_000_000n,
    perPositionCapLamports: 2_000_000_000n,
    minTicketLamports: 100_000_000n,
  };

  it('applies the Kelly fraction when below per-position cap', () => {
    // 10 % of 10 SOL = 1 SOL, under 2 SOL cap → kelly wins
    const r = unwrap(sizePosition({ targetFraction: 0.1, limits }));
    expect(r.recommendedLamports).toBe(1_000_000_000n);
    expect(r.capApplied).toBe('kelly');
    expect(r.fractionUsed).toBeCloseTo(0.1, 4);
  });

  it('applies the per-position cap when Kelly would exceed it', () => {
    // 50 % of 10 SOL = 5 SOL, exceeds 2 SOL cap → cap wins
    const r = unwrap(sizePosition({ targetFraction: 0.5, limits }));
    expect(r.recommendedLamports).toBe(2_000_000_000n);
    expect(r.capApplied).toBe('per-position-cap');
  });

  it('returns below-min-ticket when capped result is too small', () => {
    // 0.5 % of 10 SOL = 50_000_000 lamports < 100_000_000 minTicket
    const r = unwrap(sizePosition({ targetFraction: 0.005, limits }));
    expect(r.recommendedLamports).toBe(0n);
    expect(r.capApplied).toBe('below-min-ticket');
    expect(r.fractionUsed).toBe(0);
  });

  it('zero free capital with zero min-ticket reaches the fractionUsed = 0 branch', () => {
    // freeLamports = 0 and minTicket = 0: capped = 0 passes the floor, then
    // the fractionUsed denominator guard returns 0 instead of dividing by 0.
    const r = unwrap(
      sizePosition({
        targetFraction: 0.5,
        limits: {
          freeLamports: 0n,
          perPositionCapLamports: 1n,
          minTicketLamports: 0n,
        },
      }),
    );
    expect(r.recommendedLamports).toBe(0n);
    expect(r.fractionUsed).toBe(0);
    expect(r.capApplied).toBe('kelly');
  });

  it('zero free capital → below-min-ticket', () => {
    const r = unwrap(
      sizePosition({
        targetFraction: 0.5,
        limits: { ...limits, freeLamports: 0n },
      }),
    );
    expect(r.recommendedLamports).toBe(0n);
    expect(r.capApplied).toBe('below-min-ticket');
  });

  it('zero targetFraction → below-min-ticket', () => {
    const r = unwrap(sizePosition({ targetFraction: 0, limits }));
    expect(r.recommendedLamports).toBe(0n);
    expect(r.capApplied).toBe('below-min-ticket');
  });

  it('rejects targetFraction outside [0, 1]', () => {
    expect(isErr(sizePosition({ targetFraction: -0.01, limits }))).toBe(true);
    expect(isErr(sizePosition({ targetFraction: 1.01, limits }))).toBe(true);
  });

  it('rejects non-finite targetFraction', () => {
    expect(isErr(sizePosition({ targetFraction: Number.NaN, limits }))).toBe(true);
  });

  it('rejects negative limit fields', () => {
    expect(
      isErr(sizePosition({ targetFraction: 0.1, limits: { ...limits, freeLamports: -1n } })),
    ).toBe(true);
    expect(
      isErr(
        sizePosition({
          targetFraction: 0.1,
          limits: { ...limits, perPositionCapLamports: -1n },
        }),
      ),
    ).toBe(true);
    expect(
      isErr(
        sizePosition({
          targetFraction: 0.1,
          limits: { ...limits, minTicketLamports: -1n },
        }),
      ),
    ).toBe(true);
  });
});
