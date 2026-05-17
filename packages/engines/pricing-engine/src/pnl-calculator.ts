import { Pnl, SignedSolAmount } from '@alexithymia/shared-domain';
import { type Result, ValidationError, err, ok } from '@alexithymia/shared-errors';

export type { Pnl, SignedSolAmount } from '@alexithymia/shared-domain';

const validateNonNegativeBigInt = (value: bigint, field: string): Result<void, ValidationError> => {
  if (value < 0n) {
    return err(new ValidationError(`${field} must be non-negative`, { context: { value } }));
  }
  return ok(undefined);
};

/**
 * Realized PnL = exit proceeds − cost basis. Result can be negative
 * (loss). Returns Err if either input is negative.
 */
export const realizedPnl = (
  costBasisLamports: bigint,
  exitProceedsLamports: bigint,
): Result<SignedSolAmount, ValidationError> => {
  const c = validateNonNegativeBigInt(costBasisLamports, 'costBasisLamports');
  if (!c.ok) return c;
  const e = validateNonNegativeBigInt(exitProceedsLamports, 'exitProceedsLamports');
  if (!e.ok) return e;
  return ok(SignedSolAmount.fromLamports(exitProceedsLamports - costBasisLamports));
};

/**
 * Unrealized PnL = current market value − cost basis. Negative if the
 * position is underwater at the current mark.
 */
export const unrealizedPnl = (
  costBasisLamports: bigint,
  currentValueLamports: bigint,
): Result<SignedSolAmount, ValidationError> => {
  const c = validateNonNegativeBigInt(costBasisLamports, 'costBasisLamports');
  if (!c.ok) return c;
  const v = validateNonNegativeBigInt(currentValueLamports, 'currentValueLamports');
  if (!v.ok) return v;
  return ok(SignedSolAmount.fromLamports(currentValueLamports - costBasisLamports));
};

export interface PositionPnlInput {
  /** Lamports spent to enter the position. */
  readonly costBasisLamports: bigint;
  /** Current marked-to-market value of the remaining LP exposure. */
  readonly currentValueLamports: bigint;
  /** Fees already claimed and converted to lamports SOL. */
  readonly claimedFeesLamports: bigint;
}

/**
 * Compose a Pnl value object for a position. `realized` = claimed fees
 * (booked profit). `unrealized` = mark-to-market on remaining exposure.
 *
 * This split intentionally treats unclaimed fees as part of *unrealized*
 * P&L — they only become realized once an on-chain claim settles.
 */
export const computePositionPnl = (input: PositionPnlInput): Result<Pnl, ValidationError> => {
  const cb = validateNonNegativeBigInt(input.costBasisLamports, 'costBasisLamports');
  if (!cb.ok) return cb;
  const cv = validateNonNegativeBigInt(input.currentValueLamports, 'currentValueLamports');
  if (!cv.ok) return cv;
  const cf = validateNonNegativeBigInt(input.claimedFeesLamports, 'claimedFeesLamports');
  if (!cf.ok) return cf;

  const realized = input.claimedFeesLamports;
  const unrealized = input.currentValueLamports - input.costBasisLamports;
  return ok(Pnl.create(realized, unrealized));
};
