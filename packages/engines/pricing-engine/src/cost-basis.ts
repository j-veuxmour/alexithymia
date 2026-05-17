import { type Result, ValidationError, err, ok } from '@alexithymia/shared-errors';
import type { PricedAmount } from './pricing.types.js';

const MAX_DECIMALS = 18;

const validateDecimals = (decimals: number, field: string): Result<void, ValidationError> => {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_DECIMALS) {
    return err(
      new ValidationError(`${field} must be an integer in [0, ${MAX_DECIMALS}]`, {
        context: { decimals },
      }),
    );
  }
  return ok(undefined);
};

const validateNonNegativeBigInt = (value: bigint, field: string): Result<void, ValidationError> => {
  if (value < 0n) {
    return err(new ValidationError(`${field} must be non-negative`, { context: { value } }));
  }
  return ok(undefined);
};

/**
 * Lamport-SOL value of a single priced token amount.
 *
 *   value = amount * priceLamports / 10^decimals
 *
 * Returns Err on negative amount, negative price, or out-of-range decimals.
 * Floors the division — sub-lamport fractions are dropped, matching on-chain
 * lamport granularity.
 */
export const valueInLamports = (p: PricedAmount): Result<bigint, ValidationError> => {
  const dec = validateDecimals(p.decimals, 'decimals');
  if (!dec.ok) return dec;
  const amt = validateNonNegativeBigInt(p.amount, 'amount');
  if (!amt.ok) return amt;
  const price = validateNonNegativeBigInt(p.priceLamports, 'priceLamports');
  if (!price.ok) return price;

  const divisor = 10n ** BigInt(p.decimals);
  return ok((p.amount * p.priceLamports) / divisor);
};

/**
 * Sum of lamport values across a deposit basket. Empty input returns 0n.
 * Short-circuits on the first invalid entry.
 */
export const totalDepositValue = (
  deposits: readonly PricedAmount[],
): Result<bigint, ValidationError> => {
  let total = 0n;
  for (let i = 0; i < deposits.length; i += 1) {
    const entry = deposits[i] as PricedAmount;
    const valued = valueInLamports(entry);
    if (!valued.ok) {
      return err(new ValidationError(`invalid deposit at index ${i}`, { cause: valued.error }));
    }
    total += valued.value;
  }
  return ok(total);
};

export interface CostBasisTranche {
  /** Number of units acquired in this tranche (raw integer). */
  readonly units: bigint;
  /** Price paid per unit (lamports SOL). */
  readonly pricePerUnit: bigint;
}

/**
 * Volume-weighted average cost across multiple acquisition tranches:
 *
 *   avg = Σ(units · pricePerUnit) / Σ(units)
 *
 * Returns Err on empty input, negative entries, or zero total units.
 * Useful when a position is opened across multiple swaps or top-ups.
 */
export const weightedAverageCost = (
  tranches: readonly CostBasisTranche[],
): Result<bigint, ValidationError> => {
  if (tranches.length === 0) {
    return err(new ValidationError('weightedAverageCost requires at least one tranche'));
  }

  let weightedSum = 0n;
  let totalUnits = 0n;
  for (let i = 0; i < tranches.length; i += 1) {
    const t = tranches[i] as CostBasisTranche;
    const unitsCheck = validateNonNegativeBigInt(t.units, `tranches[${i}].units`);
    if (!unitsCheck.ok) return unitsCheck;
    const priceCheck = validateNonNegativeBigInt(t.pricePerUnit, `tranches[${i}].pricePerUnit`);
    if (!priceCheck.ok) return priceCheck;

    weightedSum += t.units * t.pricePerUnit;
    totalUnits += t.units;
  }

  if (totalUnits === 0n) {
    return err(new ValidationError('total units across tranches must be > 0'));
  }
  return ok(weightedSum / totalUnits);
};
