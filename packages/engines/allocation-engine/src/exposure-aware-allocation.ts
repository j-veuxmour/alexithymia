import { type Result, ValidationError, err, ok } from '@alexithymia/shared-errors';
import type { AllocationLimits, AllocationResult } from './allocation.types.js';

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

export interface RemainingCapacityInput {
  /** Total portfolio equity, in lamports. */
  readonly totalEquityLamports: bigint;
  /** Sum of currently-deployed lamports across all open positions. */
  readonly deployedLamports: bigint;
  /** Unallocated cash available for new deploys. */
  readonly freeLamports: bigint;
  /** Hard portfolio-level exposure ceiling, from RiskBudget. */
  readonly maxExposureBps: number;
}

/**
 * Lamports available for a new deploy after the portfolio-level exposure
 * cap is applied. The result is bounded by both the cap headroom and the
 * actual cash on hand; never negative.
 */
export const remainingCapacityLamports = (
  input: RemainingCapacityInput,
): Result<bigint, ValidationError> => {
  const eq = validateNonNegativeBigInt(input.totalEquityLamports, 'totalEquityLamports');
  if (!eq.ok) return eq;
  const dep = validateNonNegativeBigInt(input.deployedLamports, 'deployedLamports');
  if (!dep.ok) return dep;
  const free = validateNonNegativeBigInt(input.freeLamports, 'freeLamports');
  if (!free.ok) return free;
  const bps = validateBps(input.maxExposureBps, 'maxExposureBps');
  if (!bps.ok) return bps;

  const maxExposureLamports = (input.totalEquityLamports * BigInt(input.maxExposureBps)) / 10_000n;
  const headroom = maxExposureLamports - input.deployedLamports;
  if (headroom <= 0n) return ok(0n);
  return ok(headroom < input.freeLamports ? headroom : input.freeLamports);
};

export interface SizePositionInput {
  /** Output of fractional-kelly: target fraction of free capital, in [0, 1]. */
  readonly targetFraction: number;
  readonly limits: AllocationLimits;
}

/**
 * Translate a target fraction (typically post-fractional-Kelly) into a
 * concrete lamport deploy size, applying per-position and floor caps:
 *
 *   1. kelly_lamports     = round(targetFraction × freeLamports)
 *   2. capped             = min(kelly_lamports, perPositionCapLamports)
 *   3. if capped < minTicketLamports → `{ recommended: 0n, cap: 'below-min-ticket' }`
 *   4. otherwise            return capped with the cap that actually bound.
 *
 * `fractionUsed` is computed against `freeLamports` (the natural reference
 * for "what fraction of available capital was deployed").
 */
export const sizePosition = (
  input: SizePositionInput,
): Result<AllocationResult, ValidationError> => {
  const { targetFraction, limits } = input;
  if (!Number.isFinite(targetFraction) || targetFraction < 0 || targetFraction > 1) {
    return err(
      new ValidationError('targetFraction must be a finite number in [0, 1]', {
        context: { targetFraction },
      }),
    );
  }
  const free = validateNonNegativeBigInt(limits.freeLamports, 'freeLamports');
  if (!free.ok) return free;
  const cap = validateNonNegativeBigInt(limits.perPositionCapLamports, 'perPositionCapLamports');
  if (!cap.ok) return cap;
  const minTicket = validateNonNegativeBigInt(limits.minTicketLamports, 'minTicketLamports');
  if (!minTicket.ok) return minTicket;

  // Fraction → bigint via integer math: scale to bps, multiply, floor-divide.
  // This keeps precision without invoking float math on lamport values.
  const targetBps = BigInt(Math.round(targetFraction * 10_000));
  const kellyLamports = (limits.freeLamports * targetBps) / 10_000n;

  const capped =
    kellyLamports < limits.perPositionCapLamports ? kellyLamports : limits.perPositionCapLamports;

  if (capped < limits.minTicketLamports) {
    return ok({
      recommendedLamports: 0n,
      fractionUsed: 0,
      capApplied: 'below-min-ticket',
    });
  }

  const fractionUsed =
    limits.freeLamports === 0n ? 0 : Number((capped * 10_000n) / limits.freeLamports) / 10_000;
  const capApplied = capped === limits.perPositionCapLamports ? 'per-position-cap' : 'kelly';

  return ok({
    recommendedLamports: capped,
    fractionUsed,
    capApplied,
  });
};
