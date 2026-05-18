import { type Result, ValidationError, err, ok } from '@alexithymia/shared-errors';
import type { BinRange } from '@alexithymia/shared-domain';
import {
  BIN_ARRAY_BITMAP_SIZE,
  BIN_ARRAY_SIZE,
  type BinArrayIndex,
  type BinArrayPreflightInput,
  type BinArrayPreflightResult,
  type MissingBinArray,
} from './dlmm.types.js';

/**
 * Bin-array index that contains the given bin id.
 *
 * Each on-chain bin-array account holds {@link BIN_ARRAY_SIZE} bins.
 * Indexing matches Meteora's SDK: negative bin ids are floor-divided
 * (e.g. binId=-1 → index=-1, binId=-70 → index=-1, binId=-71 → index=-2).
 */
export const binArrayIndexFromBinId = (binId: number): BinArrayIndex => {
  return Math.floor(binId / BIN_ARRAY_SIZE) as BinArrayIndex;
};

/**
 * Ascending list of bin-array indexes touched by `range` (inclusive).
 * Empty input is impossible — BinRange enforces `lower <= upper`.
 */
export const coveredBinArrayIndexes = (range: BinRange): readonly BinArrayIndex[] => {
  const first = binArrayIndexFromBinId(range.lower) as number;
  const last = binArrayIndexFromBinId(range.upper) as number;
  const out: BinArrayIndex[] = [];
  for (let i = first; i <= last; i += 1) {
    out.push(i as unknown as BinArrayIndex);
  }
  return out;
};

/**
 * True if `index` is addressable by the pool's default bitmap (no
 * bitmap-extension account required). The bitmap covers
 * `[-BIN_ARRAY_BITMAP_SIZE, BIN_ARRAY_BITMAP_SIZE - 1]`.
 */
export const isWithinDefaultBitmap = (index: number): boolean => {
  return index >= -BIN_ARRAY_BITMAP_SIZE && index <= BIN_ARRAY_BITMAP_SIZE - 1;
};

const validateNonNegativeBigInt = (value: bigint, field: string): Result<void, ValidationError> => {
  if (value < 0n) {
    return err(new ValidationError(`${field} must be non-negative`, { context: { value } }));
  }
  return ok(undefined);
};

/**
 * Determine whether a deploy into `binRange` would silently incur
 * non-refundable bin-array initialization rent.
 *
 * The engine performs no I/O: callers fetch the set of existing
 * bin-array accounts (and whether the bitmap-extension account exists)
 * and pass them in. Output is a fully-evaluated deploy decision with
 * an explicit rent total — the policy layer then chooses whether to
 * proceed.
 */
export const preflightBinArrayInitialization = (
  input: BinArrayPreflightInput,
): Result<BinArrayPreflightResult, ValidationError> => {
  const rent = validateNonNegativeBigInt(input.binArrayRentLamports, 'binArrayRentLamports');
  if (!rent.ok) return rent;
  const bitmapRent = validateNonNegativeBigInt(
    input.bitmapExtensionRentLamports,
    'bitmapExtensionRentLamports',
  );
  if (!bitmapRent.ok) return bitmapRent;

  const coveredIndexes = coveredBinArrayIndexes(input.binRange);

  const missing: MissingBinArray[] = [];
  let anyOutsideDefaultBitmap = false;
  for (const idx of coveredIndexes) {
    const insideBitmap = isWithinDefaultBitmap(idx);
    if (!insideBitmap) anyOutsideDefaultBitmap = true;
    if (!input.existingArrayIndexes.has(idx)) {
      missing.push({ index: idx, requiresBitmapExtension: !insideBitmap });
    }
  }

  const needsBitmapExtensionInit = anyOutsideDefaultBitmap && !input.bitmapExtensionExists;

  let totalRent = BigInt(missing.length) * input.binArrayRentLamports;
  if (needsBitmapExtensionInit) totalRent += input.bitmapExtensionRentLamports;

  return ok({
    coveredIndexes,
    missing,
    needsBitmapExtensionInit,
    totalRentLamports: totalRent,
    canDeployWithoutInit: missing.length === 0 && !needsBitmapExtensionInit,
  });
};
