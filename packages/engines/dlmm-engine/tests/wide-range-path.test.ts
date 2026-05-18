import { BinRange } from '@alexithymia/shared-domain';
import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import { WIDE_RANGE_THRESHOLD_BINS } from '../src/dlmm.types.js';
import { isWideRange, planWideRangePhases } from '../src/wide-range-path.js';

const range = (lower: number, upper: number) => unwrap(BinRange.create(lower, upper));

describe('isWideRange', () => {
  it('69 bins → not wide', () => {
    expect(isWideRange(WIDE_RANGE_THRESHOLD_BINS)).toBe(false);
  });
  it('70 bins → wide', () => {
    expect(isWideRange(WIDE_RANGE_THRESHOLD_BINS + 1)).toBe(true);
  });
});

describe('planWideRangePhases', () => {
  it('narrow range collapses to single create + add chunk', () => {
    const plan = unwrap(
      planWideRangePhases({
        binRange: range(0, 30), // 31 bins
        maxBinsPerCreateTx: 70,
        maxBinsPerAddLiquidityTx: 70,
      }),
    );
    expect(plan.isWideRange).toBe(false);
    expect(plan.totalBins).toBe(31);
    expect(plan.createPositionChunks).toEqual([{ minBinId: 0, maxBinId: 30, binCount: 31 }]);
    expect(plan.addLiquidityChunks).toEqual([{ minBinId: 0, maxBinId: 30, binCount: 31 }]);
  });

  it('boundary 69 bins stays single-tx', () => {
    const plan = unwrap(
      planWideRangePhases({
        binRange: range(0, 68), // 69 bins
        maxBinsPerCreateTx: 70,
        maxBinsPerAddLiquidityTx: 70,
      }),
    );
    expect(plan.isWideRange).toBe(false);
    expect(plan.totalBins).toBe(69);
    expect(plan.createPositionChunks).toHaveLength(1);
  });

  it('70 bins is wide and chunks at the cap', () => {
    const plan = unwrap(
      planWideRangePhases({
        binRange: range(0, 69), // 70 bins
        maxBinsPerCreateTx: 70,
        maxBinsPerAddLiquidityTx: 70,
      }),
    );
    expect(plan.isWideRange).toBe(true);
    expect(plan.totalBins).toBe(70);
    expect(plan.createPositionChunks).toEqual([{ minBinId: 0, maxBinId: 69, binCount: 70 }]);
    expect(plan.addLiquidityChunks).toEqual([{ minBinId: 0, maxBinId: 69, binCount: 70 }]);
  });

  it('150 bins chunks into 3 (70 + 70 + 10)', () => {
    const plan = unwrap(
      planWideRangePhases({
        binRange: range(-50, 99), // 150 bins
        maxBinsPerCreateTx: 70,
        maxBinsPerAddLiquidityTx: 70,
      }),
    );
    expect(plan.isWideRange).toBe(true);
    expect(plan.totalBins).toBe(150);
    expect(plan.createPositionChunks).toEqual([
      { minBinId: -50, maxBinId: 19, binCount: 70 },
      { minBinId: 20, maxBinId: 89, binCount: 70 },
      { minBinId: 90, maxBinId: 99, binCount: 10 },
    ]);
    expect(plan.addLiquidityChunks).toEqual(plan.createPositionChunks);
  });

  it('different chunk caps for create vs add', () => {
    const plan = unwrap(
      planWideRangePhases({
        binRange: range(0, 99), // 100 bins, wide
        maxBinsPerCreateTx: 50,
        maxBinsPerAddLiquidityTx: 25,
      }),
    );
    expect(plan.createPositionChunks).toHaveLength(2);
    expect(plan.addLiquidityChunks).toHaveLength(4);
    expect(plan.addLiquidityChunks.every((c) => c.binCount <= 25)).toBe(true);
  });

  it('rejects non-positive chunk caps', () => {
    expect(
      isErr(
        planWideRangePhases({
          binRange: range(0, 100),
          maxBinsPerCreateTx: 0,
          maxBinsPerAddLiquidityTx: 70,
        }),
      ),
    ).toBe(true);
    expect(
      isErr(
        planWideRangePhases({
          binRange: range(0, 100),
          maxBinsPerCreateTx: 70,
          maxBinsPerAddLiquidityTx: -1,
        }),
      ),
    ).toBe(true);
    expect(
      isErr(
        planWideRangePhases({
          binRange: range(0, 100),
          maxBinsPerCreateTx: 1.5,
          maxBinsPerAddLiquidityTx: 70,
        }),
      ),
    ).toBe(true);
  });
});
