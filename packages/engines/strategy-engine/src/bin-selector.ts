import { err, ok, type Result, ValidationError } from '@alexithymia/shared-errors';
import { BinRange } from '@alexithymia/shared-domain';
import {
  type BinSelection,
  DLMM_NARROW_RANGE_MAX_WIDTH,
  type RangeBudget,
} from './strategy.types.js';

const validateNonNegativeInt = (value: number, field: string): Result<void, ValidationError> => {
  if (!Number.isInteger(value) || value < 0) {
    return err(
      new ValidationError(`${field} must be a non-negative integer`, { context: { value } }),
    );
  }
  return ok(undefined);
};

const validateActiveBin = (activeBinId: number): Result<void, ValidationError> => {
  if (!Number.isInteger(activeBinId)) {
    return err(
      new ValidationError('activeBinId must be an integer', { context: { activeBinId } }),
    );
  }
  if (activeBinId < BinRange.MIN_BIN_ID || activeBinId > BinRange.MAX_BIN_ID) {
    return err(
      new ValidationError(
        `activeBinId must be in [${BinRange.MIN_BIN_ID}, ${BinRange.MAX_BIN_ID}]`,
        { context: { activeBinId } },
      ),
    );
  }
  return ok(undefined);
};

/**
 * Place a bin-count budget around the active bin and clamp to the
 * domain bounds. Returns the concrete (lower, upper) bin ids plus
 * metadata used by downstream layers:
 *
 *   - `width = upper - lower + 1` (inclusive bin count).
 *   - `requiresWideRangePath` is set when `width > 69`, which forces
 *     the chunked deploy path in DLMM Engine.
 *   - `clampedBy` records which domain bound (min/max) clipped the
 *     range — useful for explainability when the policy would have
 *     produced a wider span than the bin-id domain allows.
 *
 * If `binsBelow + binsAbove + 1 > MAX - MIN + 1` (entire bin space)
 * the result is the full domain with `clampedBy = 'max'` (the side
 * that first hit the bound is reported; ties favor 'min').
 */
export const selectBinRange = (
  activeBinId: number,
  budget: RangeBudget,
): Result<BinSelection, ValidationError> => {
  const active = validateActiveBin(activeBinId);
  if (!active.ok) return active;
  const below = validateNonNegativeInt(budget.binsBelow, 'binsBelow');
  if (!below.ok) return below;
  const above = validateNonNegativeInt(budget.binsAbove, 'binsAbove');
  if (!above.ok) return above;

  const desiredLower = activeBinId - budget.binsBelow;
  const desiredUpper = activeBinId + budget.binsAbove;
  const lower = desiredLower < BinRange.MIN_BIN_ID ? BinRange.MIN_BIN_ID : desiredLower;
  const upper = desiredUpper > BinRange.MAX_BIN_ID ? BinRange.MAX_BIN_ID : desiredUpper;

  let clampedBy: 'min' | 'max' | 'none' = 'none';
  if (desiredLower < BinRange.MIN_BIN_ID) clampedBy = 'min';
  else if (desiredUpper > BinRange.MAX_BIN_ID) clampedBy = 'max';

  // Smart-constructor validation enforces lower <= upper and domain bounds.
  // The earlier validations make failure unreachable, but BinRange remains
  // the authority on bin-id invariants so we route through it regardless.
  const range = BinRange.create(lower, upper);
  /* v8 ignore next */
  if (!range.ok) return err(range.error);

  const width = BinRange.width(range.value);
  return ok({
    lower,
    upper,
    width,
    requiresWideRangePath: width > DLMM_NARROW_RANGE_MAX_WIDTH,
    clampedBy,
  });
};
