import { type Result, ValidationError, err, ok } from '@alexithymia/shared-errors';
import { BinRange } from '@alexithymia/shared-domain';
import {
  WIDE_RANGE_THRESHOLD_BINS,
  type WideRangeChunk,
  type WideRangePlan,
  type WideRangePlanInput,
} from './dlmm.types.js';

/** True if the deploy must use Meteora's multi-tx wide-range path. */
export const isWideRange = (totalBins: number): boolean =>
  totalBins > WIDE_RANGE_THRESHOLD_BINS;

const validatePositiveInt = (value: number, field: string): Result<void, ValidationError> => {
  if (!Number.isInteger(value) || value <= 0) {
    return err(new ValidationError(`${field} must be a positive integer`, { context: { value } }));
  }
  return ok(undefined);
};

const chunkRange = (lower: number, upper: number, maxBinsPerChunk: number): WideRangeChunk[] => {
  const chunks: WideRangeChunk[] = [];
  let cursor = lower;
  while (cursor <= upper) {
    const chunkEnd = Math.min(cursor + maxBinsPerChunk - 1, upper);
    chunks.push({ minBinId: cursor, maxBinId: chunkEnd, binCount: chunkEnd - cursor + 1 });
    cursor = chunkEnd + 1;
  }
  return chunks;
};

/**
 * Build the multi-phase deploy plan for a (possibly wide) bin range.
 *
 * - Ranges with `totalBins <= 69` collapse to a single create + single
 *   addLiquidity chunk; `isWideRange = false`.
 * - Wider ranges emit phase-1 chunks (createExtendedEmptyPosition) and
 *   phase-2 chunks (addLiquidityByStrategyChunkable). The engine emits
 *   the chunk boundaries; the service layer assembles transactions.
 *
 * Both chunk-size caps must be positive integers. Solana's 10_240-byte
 * inner-realloc limit makes BIN_ARRAY_SIZE (70) the typical cap.
 */
export const planWideRangePhases = (
  input: WideRangePlanInput,
): Result<WideRangePlan, ValidationError> => {
  const createCheck = validatePositiveInt(input.maxBinsPerCreateTx, 'maxBinsPerCreateTx');
  if (!createCheck.ok) return createCheck;
  const addCheck = validatePositiveInt(
    input.maxBinsPerAddLiquidityTx,
    'maxBinsPerAddLiquidityTx',
  );
  if (!addCheck.ok) return addCheck;

  const totalBins = BinRange.width(input.binRange);
  const wide = isWideRange(totalBins);

  if (!wide) {
    const single: WideRangeChunk = {
      minBinId: input.binRange.lower,
      maxBinId: input.binRange.upper,
      binCount: totalBins,
    };
    return ok({
      isWideRange: false,
      totalBins,
      createPositionChunks: [single],
      addLiquidityChunks: [single],
    });
  }

  return ok({
    isWideRange: true,
    totalBins,
    createPositionChunks: chunkRange(
      input.binRange.lower,
      input.binRange.upper,
      input.maxBinsPerCreateTx,
    ),
    addLiquidityChunks: chunkRange(
      input.binRange.lower,
      input.binRange.upper,
      input.maxBinsPerAddLiquidityTx,
    ),
  });
};
