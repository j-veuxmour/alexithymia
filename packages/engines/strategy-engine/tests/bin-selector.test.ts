import { BinRange } from '@alexithymia/shared-domain';
import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import { selectBinRange } from '../src/bin-selector.js';
import { DLMM_NARROW_RANGE_MAX_WIDTH } from '../src/strategy.types.js';

describe('selectBinRange', () => {
  it('centers the range on the active bin when no clamping is needed', () => {
    const r = unwrap(selectBinRange(0, { binsBelow: 30, binsAbove: 20 }));
    expect(r.lower).toBe(-30);
    expect(r.upper).toBe(20);
    expect(r.width).toBe(51);
    expect(r.clampedBy).toBe('none');
    expect(r.requiresWideRangePath).toBe(false);
  });

  it('flags wide-range when width > 69', () => {
    // 35 below + 35 above + 1 active = 71 bins
    const r = unwrap(selectBinRange(0, { binsBelow: 35, binsAbove: 35 }));
    expect(r.width).toBe(71);
    expect(r.requiresWideRangePath).toBe(true);
  });

  it('does not flag wide-range at the boundary (width = 69)', () => {
    const r = unwrap(selectBinRange(0, { binsBelow: 34, binsAbove: 34 }));
    expect(r.width).toBe(DLMM_NARROW_RANGE_MAX_WIDTH);
    expect(r.requiresWideRangePath).toBe(false);
  });

  it("clamps lower to MIN_BIN_ID and reports clampedBy='min'", () => {
    const r = unwrap(selectBinRange(BinRange.MIN_BIN_ID + 5, { binsBelow: 50, binsAbove: 10 }));
    expect(r.lower).toBe(BinRange.MIN_BIN_ID);
    expect(r.clampedBy).toBe('min');
  });

  it("clamps upper to MAX_BIN_ID and reports clampedBy='max'", () => {
    const r = unwrap(selectBinRange(BinRange.MAX_BIN_ID - 5, { binsBelow: 10, binsAbove: 50 }));
    expect(r.upper).toBe(BinRange.MAX_BIN_ID);
    expect(r.clampedBy).toBe('max');
  });

  it('supports single-side (binsAbove = 0) → upper == active bin', () => {
    const r = unwrap(selectBinRange(100, { binsBelow: 30, binsAbove: 0 }));
    expect(r.upper).toBe(100);
    expect(r.lower).toBe(70);
    expect(r.width).toBe(31);
  });

  it('zero budget reduces to a single-bin position', () => {
    const r = unwrap(selectBinRange(0, { binsBelow: 0, binsAbove: 0 }));
    expect(r.lower).toBe(0);
    expect(r.upper).toBe(0);
    expect(r.width).toBe(1);
  });

  it('rejects non-integer activeBinId', () => {
    expect(isErr(selectBinRange(1.5, { binsBelow: 1, binsAbove: 1 }))).toBe(true);
  });

  it('rejects activeBinId below the domain', () => {
    expect(
      isErr(selectBinRange(BinRange.MIN_BIN_ID - 1, { binsBelow: 1, binsAbove: 1 })),
    ).toBe(true);
  });

  it('rejects activeBinId above the domain', () => {
    expect(
      isErr(selectBinRange(BinRange.MAX_BIN_ID + 1, { binsBelow: 1, binsAbove: 1 })),
    ).toBe(true);
  });

  it('rejects negative binsBelow', () => {
    expect(isErr(selectBinRange(0, { binsBelow: -1, binsAbove: 1 }))).toBe(true);
  });

  it('rejects non-integer binsBelow', () => {
    expect(isErr(selectBinRange(0, { binsBelow: 1.5, binsAbove: 1 }))).toBe(true);
  });

  it('rejects negative binsAbove', () => {
    expect(isErr(selectBinRange(0, { binsBelow: 1, binsAbove: -1 }))).toBe(true);
  });

  it('rejects non-integer binsAbove', () => {
    expect(isErr(selectBinRange(0, { binsBelow: 1, binsAbove: 1.5 }))).toBe(true);
  });
});
