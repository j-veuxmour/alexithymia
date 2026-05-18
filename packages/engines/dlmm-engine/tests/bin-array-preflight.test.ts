import { BinRange } from '@alexithymia/shared-domain';
import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import {
  binArrayIndexFromBinId,
  coveredBinArrayIndexes,
  isWithinDefaultBitmap,
  preflightBinArrayInitialization,
} from '../src/bin-array-preflight.js';
import { BIN_ARRAY_BITMAP_SIZE, BIN_ARRAY_SIZE } from '../src/dlmm.types.js';

const range = (lower: number, upper: number) => unwrap(BinRange.create(lower, upper));

describe('binArrayIndexFromBinId', () => {
  it('zero falls in index 0', () => {
    expect(binArrayIndexFromBinId(0)).toBe(0);
  });
  it('bin 69 (last of first array) is index 0', () => {
    expect(binArrayIndexFromBinId(BIN_ARRAY_SIZE - 1)).toBe(0);
  });
  it('bin 70 rolls to index 1', () => {
    expect(binArrayIndexFromBinId(BIN_ARRAY_SIZE)).toBe(1);
  });
  it('bin -1 floors to index -1', () => {
    expect(binArrayIndexFromBinId(-1)).toBe(-1);
  });
  it('bin -70 floors to index -1', () => {
    expect(binArrayIndexFromBinId(-BIN_ARRAY_SIZE)).toBe(-1);
  });
  it('bin -71 floors to index -2', () => {
    expect(binArrayIndexFromBinId(-BIN_ARRAY_SIZE - 1)).toBe(-2);
  });
});

describe('coveredBinArrayIndexes', () => {
  it('range fully inside one array → single index', () => {
    expect(coveredBinArrayIndexes(range(10, 40))).toEqual([0]);
  });
  it('range across two arrays → two indexes', () => {
    expect(coveredBinArrayIndexes(range(60, 80))).toEqual([0, 1]);
  });
  it('range spanning negative + positive zero crossing', () => {
    expect(coveredBinArrayIndexes(range(-10, 10))).toEqual([-1, 0]);
  });
  it('wide range produces correct contiguous index list', () => {
    expect(coveredBinArrayIndexes(range(0, 209))).toEqual([0, 1, 2]);
  });
});

describe('isWithinDefaultBitmap', () => {
  it('zero is inside', () => {
    expect(isWithinDefaultBitmap(0)).toBe(true);
  });
  it('positive edge index 511 is inside', () => {
    expect(isWithinDefaultBitmap(BIN_ARRAY_BITMAP_SIZE - 1)).toBe(true);
  });
  it('positive index 512 is outside', () => {
    expect(isWithinDefaultBitmap(BIN_ARRAY_BITMAP_SIZE)).toBe(false);
  });
  it('negative edge index -512 is inside', () => {
    expect(isWithinDefaultBitmap(-BIN_ARRAY_BITMAP_SIZE)).toBe(true);
  });
  it('negative index -513 is outside', () => {
    expect(isWithinDefaultBitmap(-BIN_ARRAY_BITMAP_SIZE - 1)).toBe(false);
  });
});

describe('preflightBinArrayInitialization', () => {
  const RENT = 71_437_440n; // ~0.07143744 SOL
  const BITMAP_RENT = 11_804_160n; // ~0.01180416 SOL

  it('all arrays exist → canDeployWithoutInit, zero rent', () => {
    const r = unwrap(
      preflightBinArrayInitialization({
        binRange: range(10, 60),
        existingArrayIndexes: new Set([0]),
        bitmapExtensionExists: false,
        binArrayRentLamports: RENT,
        bitmapExtensionRentLamports: BITMAP_RENT,
      }),
    );
    expect(r.coveredIndexes).toEqual([0]);
    expect(r.missing).toEqual([]);
    expect(r.needsBitmapExtensionInit).toBe(false);
    expect(r.totalRentLamports).toBe(0n);
    expect(r.canDeployWithoutInit).toBe(true);
  });

  it('missing arrays charged once each', () => {
    const r = unwrap(
      preflightBinArrayInitialization({
        binRange: range(0, 209), // indexes 0, 1, 2
        existingArrayIndexes: new Set([0]), // missing 1 and 2
        bitmapExtensionExists: false,
        binArrayRentLamports: RENT,
        bitmapExtensionRentLamports: BITMAP_RENT,
      }),
    );
    expect(r.missing.map((m) => m.index)).toEqual([1, 2]);
    expect(r.missing.every((m) => !m.requiresBitmapExtension)).toBe(true);
    expect(r.totalRentLamports).toBe(RENT * 2n);
    expect(r.canDeployWithoutInit).toBe(false);
  });

  it('index outside default bitmap → needsBitmapExtensionInit + bitmap rent', () => {
    const lower = BIN_ARRAY_BITMAP_SIZE * BIN_ARRAY_SIZE; // first bin in index 512
    const r = unwrap(
      preflightBinArrayInitialization({
        binRange: range(lower, lower + 10),
        existingArrayIndexes: new Set(),
        bitmapExtensionExists: false,
        binArrayRentLamports: RENT,
        bitmapExtensionRentLamports: BITMAP_RENT,
      }),
    );
    expect(r.coveredIndexes).toEqual([512]);
    expect(r.missing).toEqual([{ index: 512, requiresBitmapExtension: true }]);
    expect(r.needsBitmapExtensionInit).toBe(true);
    expect(r.totalRentLamports).toBe(RENT + BITMAP_RENT);
  });

  it('out-of-bitmap index but extension exists → no extension charge', () => {
    const lower = BIN_ARRAY_BITMAP_SIZE * BIN_ARRAY_SIZE;
    const r = unwrap(
      preflightBinArrayInitialization({
        binRange: range(lower, lower + 10),
        existingArrayIndexes: new Set([512]),
        bitmapExtensionExists: true,
        binArrayRentLamports: RENT,
        bitmapExtensionRentLamports: BITMAP_RENT,
      }),
    );
    expect(r.needsBitmapExtensionInit).toBe(false);
    expect(r.totalRentLamports).toBe(0n);
    expect(r.canDeployWithoutInit).toBe(true);
  });

  it('rejects negative rent', () => {
    expect(
      isErr(
        preflightBinArrayInitialization({
          binRange: range(0, 10),
          existingArrayIndexes: new Set(),
          bitmapExtensionExists: false,
          binArrayRentLamports: -1n,
          bitmapExtensionRentLamports: BITMAP_RENT,
        }),
      ),
    ).toBe(true);
    expect(
      isErr(
        preflightBinArrayInitialization({
          binRange: range(0, 10),
          existingArrayIndexes: new Set(),
          bitmapExtensionExists: false,
          binArrayRentLamports: RENT,
          bitmapExtensionRentLamports: -5n,
        }),
      ),
    ).toBe(true);
  });
});
