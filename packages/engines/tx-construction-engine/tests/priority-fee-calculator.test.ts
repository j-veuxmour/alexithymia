import { isErr, unwrap } from '@alexithymia/shared-errors';
import type { UnixMs } from '@alexithymia/shared-domain';
import { describe, expect, it } from 'vitest';
import {
  escalateFee,
  percentileMicroLamports,
  recommendPriorityFee,
} from '../src/priority-fee-calculator.js';
import type { PriorityFeeSample } from '../src/tx-construction.types.js';

const sample = (value: bigint, ts = 0): PriorityFeeSample => ({
  microLamportsPerCu: value,
  timestamp: ts as UnixMs,
});

describe('percentileMicroLamports', () => {
  it('single sample returns its value', () => {
    expect(percentileMicroLamports([sample(1_000n)], 50)).toBe(1_000n);
  });

  it('p=0 returns min, p=100 returns max', () => {
    const samples = [sample(100n), sample(500n), sample(50n), sample(200n)];
    expect(percentileMicroLamports(samples, 0)).toBe(50n);
    expect(percentileMicroLamports(samples, 100)).toBe(500n);
  });

  it('p=50 of [10, 20, 30, 40] interpolates to 25', () => {
    const samples = [sample(10n), sample(20n), sample(30n), sample(40n)];
    expect(percentileMicroLamports(samples, 50)).toBe(25n);
  });

  it('throws on empty input', () => {
    expect(() => percentileMicroLamports([], 50)).toThrow(RangeError);
  });
});

describe('recommendPriorityFee', () => {
  const baseInput = {
    samples: [sample(1_000n), sample(2_000n), sample(3_000n), sample(4_000n), sample(5_000n)],
    percentile: 75,
    multiplierBps: 12_000, // 1.2×
    maxMicroLamportsPerCu: 10_000_000n,
    fallbackMicroLamportsPerCu: 1_000n,
  };

  it('picks percentile and applies multiplier', () => {
    const rec = unwrap(recommendPriorityFee(baseInput));
    // 75th percentile of [1k, 2k, 3k, 4k, 5k] = 4000; ×1.2 = 4800
    expect(rec.microLamportsPerCu).toBe(4_800n);
    expect(rec.source).toBe('samples');
    expect(rec.cappedByMax).toBe(false);
  });

  it('caps at max', () => {
    const rec = unwrap(
      recommendPriorityFee({ ...baseInput, maxMicroLamportsPerCu: 3_000n }),
    );
    expect(rec.microLamportsPerCu).toBe(3_000n);
    expect(rec.cappedByMax).toBe(true);
  });

  it('falls back when samples empty', () => {
    const rec = unwrap(
      recommendPriorityFee({ ...baseInput, samples: [] }),
    );
    // 1000 × 1.2 = 1200
    expect(rec.source).toBe('fallback');
    expect(rec.microLamportsPerCu).toBe(1_200n);
  });

  it('fallback also subject to cap', () => {
    const rec = unwrap(
      recommendPriorityFee({
        ...baseInput,
        samples: [],
        fallbackMicroLamportsPerCu: 100_000n,
        maxMicroLamportsPerCu: 5_000n,
      }),
    );
    expect(rec.microLamportsPerCu).toBe(5_000n);
    expect(rec.cappedByMax).toBe(true);
  });

  it('rejects bad percentile', () => {
    expect(isErr(recommendPriorityFee({ ...baseInput, percentile: -1 }))).toBe(true);
    expect(isErr(recommendPriorityFee({ ...baseInput, percentile: 101 }))).toBe(true);
    expect(
      isErr(recommendPriorityFee({ ...baseInput, percentile: Number.NaN })),
    ).toBe(true);
  });

  it('rejects negative multiplier / cap / fallback / sample', () => {
    expect(isErr(recommendPriorityFee({ ...baseInput, multiplierBps: -1 }))).toBe(true);
    expect(
      isErr(recommendPriorityFee({ ...baseInput, maxMicroLamportsPerCu: -1n })),
    ).toBe(true);
    expect(
      isErr(recommendPriorityFee({ ...baseInput, fallbackMicroLamportsPerCu: -1n })),
    ).toBe(true);
    expect(
      isErr(recommendPriorityFee({ ...baseInput, samples: [sample(-1n)] })),
    ).toBe(true);
  });

  it('rejects non-integer multiplier', () => {
    expect(
      isErr(recommendPriorityFee({ ...baseInput, multiplierBps: 1.5 })),
    ).toBe(true);
  });
});

describe('escalateFee', () => {
  it('attempt=0 returns base unchanged', () => {
    expect(
      unwrap(
        escalateFee({
          baseMicroLamportsPerCu: 1_000n,
          attempt: 0,
          escalationFactorBps: 15_000,
          ceilingMicroLamportsPerCu: 1_000_000n,
        }),
      ),
    ).toBe(1_000n);
  });

  it('compounds geometrically per attempt', () => {
    // 1000 → 1500 → 2250 → 3375
    expect(
      unwrap(
        escalateFee({
          baseMicroLamportsPerCu: 1_000n,
          attempt: 3,
          escalationFactorBps: 15_000,
          ceilingMicroLamportsPerCu: 1_000_000n,
        }),
      ),
    ).toBe(3_375n);
  });

  it('caps at ceiling and short-circuits', () => {
    expect(
      unwrap(
        escalateFee({
          baseMicroLamportsPerCu: 1_000n,
          attempt: 100,
          escalationFactorBps: 20_000, // 2×
          ceilingMicroLamportsPerCu: 5_000n,
        }),
      ),
    ).toBe(5_000n);
  });

  it('factor below 10_000 decays towards zero', () => {
    expect(
      unwrap(
        escalateFee({
          baseMicroLamportsPerCu: 1_000n,
          attempt: 2,
          escalationFactorBps: 5_000, // 0.5×
          ceilingMicroLamportsPerCu: 1_000_000n,
        }),
      ),
    ).toBe(250n);
  });

  it('rejects invalid inputs', () => {
    expect(
      isErr(
        escalateFee({
          baseMicroLamportsPerCu: -1n,
          attempt: 1,
          escalationFactorBps: 15_000,
          ceilingMicroLamportsPerCu: 1_000n,
        }),
      ),
    ).toBe(true);
    expect(
      isErr(
        escalateFee({
          baseMicroLamportsPerCu: 1n,
          attempt: -1,
          escalationFactorBps: 15_000,
          ceilingMicroLamportsPerCu: 1_000n,
        }),
      ),
    ).toBe(true);
    expect(
      isErr(
        escalateFee({
          baseMicroLamportsPerCu: 1n,
          attempt: 1,
          escalationFactorBps: -1,
          ceilingMicroLamportsPerCu: 1_000n,
        }),
      ),
    ).toBe(true);
    expect(
      isErr(
        escalateFee({
          baseMicroLamportsPerCu: 1n,
          attempt: 1,
          escalationFactorBps: 1,
          ceilingMicroLamportsPerCu: -1n,
        }),
      ),
    ).toBe(true);
  });
});
