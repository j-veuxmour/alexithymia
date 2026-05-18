import { type Result, ValidationError, err, ok } from '@alexithymia/shared-errors';
import type { SingleSideSolDeploy, SingleSideSolDeployInput } from './dlmm.types.js';

/**
 * Enforce the single-side SOL deploy invariants.
 *
 * ALEXITHYMIA only supports single-side SOL LPs into DLMM. This rules
 * out token-side liquidity at deploy and keeps the upper edge of the
 * position pinned to the SDK's active bin (so price moves *up* simply
 * out-of-range without selling SOL into the token at deploy).
 *
 * Invariants enforced:
 *   - amountX must be zero (no token side at deploy).
 *   - amountY must be strictly positive.
 *   - binsAbove must be zero; the upper bin is the active bin.
 *   - upsidePct, if present, must be zero.
 *   - maxBinId must equal activeBinId.
 *   - minBinId must be <= maxBinId.
 *
 * All inputs are validated; nothing throws.
 */
export const enforceSingleSideSolDeploy = (
  input: SingleSideSolDeployInput,
): Result<SingleSideSolDeploy, ValidationError> => {
  if (input.amountXLamports < 0n) {
    return err(
      new ValidationError('amountXLamports must be non-negative', {
        context: { amountXLamports: input.amountXLamports },
      }),
    );
  }
  if (input.amountXLamports !== 0n) {
    return err(
      new ValidationError(
        'single-side SOL deploy requires amountXLamports = 0n; token-side liquidity is not allowed',
        { context: { amountXLamports: input.amountXLamports } },
      ),
    );
  }
  if (input.amountYLamports <= 0n) {
    return err(
      new ValidationError('amountYLamports must be > 0n for single-side SOL deploy', {
        context: { amountYLamports: input.amountYLamports },
      }),
    );
  }

  if (!Number.isInteger(input.binsAbove) || input.binsAbove < 0) {
    return err(
      new ValidationError('binsAbove must be a non-negative integer', {
        context: { binsAbove: input.binsAbove },
      }),
    );
  }
  if (input.binsAbove !== 0) {
    return err(
      new ValidationError(
        'single-side SOL deploy must set binsAbove = 0; the upper edge is the active bin',
        { context: { binsAbove: input.binsAbove } },
      ),
    );
  }

  if (input.upsidePct !== undefined) {
    if (!Number.isFinite(input.upsidePct)) {
      return err(
        new ValidationError('upsidePct must be finite when provided', {
          context: { upsidePct: input.upsidePct },
        }),
      );
    }
    if (input.upsidePct !== 0) {
      return err(
        new ValidationError(
          'single-side SOL deploy cannot use upsidePct; the upper edge is the active bin',
          { context: { upsidePct: input.upsidePct } },
        ),
      );
    }
  }

  if (!Number.isInteger(input.activeBinId)) {
    return err(
      new ValidationError('activeBinId must be an integer', {
        context: { activeBinId: input.activeBinId },
      }),
    );
  }
  if (!Number.isInteger(input.minBinId) || !Number.isInteger(input.maxBinId)) {
    return err(
      new ValidationError('minBinId and maxBinId must be integers', {
        context: { minBinId: input.minBinId, maxBinId: input.maxBinId },
      }),
    );
  }
  if (input.minBinId > input.maxBinId) {
    return err(
      new ValidationError('minBinId must be <= maxBinId', {
        context: { minBinId: input.minBinId, maxBinId: input.maxBinId },
      }),
    );
  }
  if (input.maxBinId !== input.activeBinId) {
    return err(
      new ValidationError(
        `single-side SOL deploy must end at the active bin (expected maxBinId=${input.activeBinId}, got ${input.maxBinId})`,
        { context: { activeBinId: input.activeBinId, maxBinId: input.maxBinId } },
      ),
    );
  }

  return ok({
    amountYLamports: input.amountYLamports,
    activeBinId: input.activeBinId,
    minBinId: input.minBinId,
    maxBinId: input.maxBinId,
    binsBelow: input.maxBinId - input.minBinId,
  });
};
