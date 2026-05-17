import { type Result, ValidationError, err, ok } from '@alexithymia/shared-errors';

const validateNonNegativeBigInt = (value: bigint, field: string): Result<void, ValidationError> => {
  if (value < 0n) {
    return err(new ValidationError(`${field} must be non-negative`, { context: { value } }));
  }
  return ok(undefined);
};

const validateBps = (value: number, field: string): Result<void, ValidationError> => {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    return err(
      new ValidationError(`${field} must be an integer in [0, 10000]`, {
        context: { value },
      }),
    );
  }
  return ok(undefined);
};

/**
 * Share of the post-deposit pool TVL the deposit will own, in basis points:
 *
 *   share_bps = deposit / (deposit + preDepositTvl) · 10_000
 *
 * Returns Err if both inputs are zero (undefined denominator).
 */
export const shareAfterDepositBps = (
  depositLamports: bigint,
  preDepositTvlLamports: bigint,
): Result<number, ValidationError> => {
  const d = validateNonNegativeBigInt(depositLamports, 'depositLamports');
  if (!d.ok) return d;
  const t = validateNonNegativeBigInt(preDepositTvlLamports, 'preDepositTvlLamports');
  if (!t.ok) return t;

  const denom = depositLamports + preDepositTvlLamports;
  if (denom === 0n) {
    return err(new ValidationError('deposit and TVL are both zero'));
  }
  return ok(Number((depositLamports * 10_000n) / denom));
};

/**
 * Deposit size as a fraction of *pre-existing* TVL, in basis points:
 *
 *   impact_bps = deposit / preDepositTvl · 10_000
 *
 * May exceed 10 000 (deposit larger than TVL) — that's a meaningful signal
 * for size-impact gates, not an error.
 *
 * Returns Err if `preDepositTvlLamports` is zero (would be infinite impact);
 * callers gating green-field pools should branch on this explicitly.
 */
export const tvlImpactBps = (
  depositLamports: bigint,
  preDepositTvlLamports: bigint,
): Result<number, ValidationError> => {
  const d = validateNonNegativeBigInt(depositLamports, 'depositLamports');
  if (!d.ok) return d;
  const t = validateNonNegativeBigInt(preDepositTvlLamports, 'preDepositTvlLamports');
  if (!t.ok) return t;
  if (preDepositTvlLamports === 0n) {
    return err(new ValidationError('preDepositTvlLamports must be > 0'));
  }
  return ok(Number((depositLamports * 10_000n) / preDepositTvlLamports));
};

/**
 * Bps by which an existing LP's share is diluted by a new deposit:
 *
 *   newShare = oldShare · preTvl / (preTvl + newDeposit)
 *   dilution_bps = oldShare - newShare
 *
 * Conserves the bps unit on both sides. Returns 0 if there is no deposit.
 */
export const dilutionBps = (
  myExistingShareBps: number,
  newDepositLamports: bigint,
  preDepositTvlLamports: bigint,
): Result<number, ValidationError> => {
  const share = validateBps(myExistingShareBps, 'myExistingShareBps');
  if (!share.ok) return share;
  const d = validateNonNegativeBigInt(newDepositLamports, 'newDepositLamports');
  if (!d.ok) return d;
  const t = validateNonNegativeBigInt(preDepositTvlLamports, 'preDepositTvlLamports');
  if (!t.ok) return t;
  if (preDepositTvlLamports === 0n) {
    return err(new ValidationError('preDepositTvlLamports must be > 0'));
  }

  const denom = preDepositTvlLamports + newDepositLamports;
  const oldShareN = BigInt(myExistingShareBps);
  const newShareN = (oldShareN * preDepositTvlLamports) / denom;
  return ok(Number(oldShareN - newShareN));
};
