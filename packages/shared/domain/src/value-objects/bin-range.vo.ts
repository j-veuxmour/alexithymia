import { type Result, ValidationError, err, ok } from '@alexithymia/shared-errors';

declare const __binRange: unique symbol;

/**
 * Inclusive DLMM bin range [lower, upper]. Both bounds are signed integers
 * within Meteora's bin-id domain (roughly ±443_636).
 *
 * The brand is type-only and is never materialized on the runtime object;
 * construction goes through the smart constructor below.
 */
export type BinRange = {
  readonly lower: number;
  readonly upper: number;
} & { readonly [__binRange]: 'BinRange' };

const MIN_BIN_ID = -443_636;
const MAX_BIN_ID = 443_636;

const isBinId = (n: number): boolean => Number.isInteger(n) && n >= MIN_BIN_ID && n <= MAX_BIN_ID;

export const BinRange = {
  MIN_BIN_ID,
  MAX_BIN_ID,

  create(lower: number, upper: number): Result<BinRange, ValidationError> {
    if (!isBinId(lower)) {
      return err(new ValidationError('invalid lower bin id', { context: { lower } }));
    }
    if (!isBinId(upper)) {
      return err(new ValidationError('invalid upper bin id', { context: { upper } }));
    }
    if (lower > upper) {
      return err(new ValidationError('lower must be <= upper', { context: { lower, upper } }));
    }
    return ok({ lower, upper } as BinRange);
  },

  /** Inclusive bin count (upper − lower + 1). */
  width(range: BinRange): number {
    return range.upper - range.lower + 1;
  },

  contains(range: BinRange, binId: number): boolean {
    return binId >= range.lower && binId <= range.upper;
  },
};
