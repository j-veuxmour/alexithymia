import { type Result, ValidationError, err, ok } from '@alexithymia/shared-errors';
import type { FeeProjection } from './pricing.types.js';

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1_000;

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

const validateNonNegativeBigInt = (value: bigint, field: string): Result<void, ValidationError> => {
  if (value < 0n) {
    return err(new ValidationError(`${field} must be non-negative`, { context: { value } }));
  }
  return ok(undefined);
};

const validatePositiveInt = (value: number, field: string): Result<void, ValidationError> => {
  if (!Number.isInteger(value) || value <= 0) {
    return err(new ValidationError(`${field} must be a positive integer`, { context: { value } }));
  }
  return ok(undefined);
};

export interface FeesEarnedInput {
  /**
   * Volume that flowed through this position's bins, denominated in lamports
   * SOL. The DLMM Engine is responsible for translating raw pool volume +
   * bin-overlap into this effective number.
   */
  readonly effectiveVolumeLamports: bigint;
  /** Pool's base fee in bps. */
  readonly baseFeeBps: number;
  /** This position's share of liquidity at the relevant bins, in bps. */
  readonly positionShareBps: number;
}

/**
 * Fees accrued from one period of effective volume:
 *
 *   fees = volume · feeBps/10_000 · shareBps/10_000
 *
 * All arithmetic is integer; sub-lamport fractions are floored.
 */
export const feesEarnedFromVolume = (input: FeesEarnedInput): Result<bigint, ValidationError> => {
  const v = validateNonNegativeBigInt(input.effectiveVolumeLamports, 'effectiveVolumeLamports');
  if (!v.ok) return v;
  const f = validateBps(input.baseFeeBps, 'baseFeeBps');
  if (!f.ok) return f;
  const s = validateBps(input.positionShareBps, 'positionShareBps');
  if (!s.ok) return s;

  const feeNumerator =
    input.effectiveVolumeLamports * BigInt(input.baseFeeBps) * BigInt(input.positionShareBps);
  return ok(feeNumerator / 100_000_000n);
};

export interface ProjectFeesInput {
  /** Volume per 24-hour window, in lamports SOL. */
  readonly dailyVolumeLamports: bigint;
  readonly baseFeeBps: number;
  readonly positionShareBps: number;
  /** Projection horizon. */
  readonly intervalMs: number;
  /** Lamport cost basis used to express the realized yield as bps. */
  readonly costBasisLamports: bigint;
}

const MS_PER_DAY = 24 * 60 * 60 * 1_000;

/**
 * Project fees and the resulting yield over an arbitrary interval, given a
 * stable daily volume assumption. Yield is expressed as bps of cost basis.
 */
export const projectFeesOverInterval = (
  input: ProjectFeesInput,
): Result<FeeProjection, ValidationError> => {
  const cb = validateNonNegativeBigInt(input.costBasisLamports, 'costBasisLamports');
  if (!cb.ok) return cb;
  if (input.costBasisLamports === 0n) {
    return err(new ValidationError('costBasisLamports must be > 0 to derive yield bps'));
  }
  const interval = validatePositiveInt(input.intervalMs, 'intervalMs');
  if (!interval.ok) return interval;

  // Effective volume over the horizon, then run the same per-period formula.
  // Use bigint to keep precision; convert interval to ms-scaled bigint.
  const dailyChecked = validateNonNegativeBigInt(input.dailyVolumeLamports, 'dailyVolumeLamports');
  if (!dailyChecked.ok) return dailyChecked;

  const horizonVolume = (input.dailyVolumeLamports * BigInt(input.intervalMs)) / BigInt(MS_PER_DAY);
  const earned = feesEarnedFromVolume({
    effectiveVolumeLamports: horizonVolume,
    baseFeeBps: input.baseFeeBps,
    positionShareBps: input.positionShareBps,
  });
  if (!earned.ok) return earned;

  // Yield bps = earned / costBasis * 10_000  (integer math via numerator scaling).
  const yieldBps = (earned.value * 10_000n) / input.costBasisLamports;
  return ok({
    earnedLamports: earned.value,
    periodMs: input.intervalMs,
    effectiveYieldBps: Number(yieldBps),
  });
};

/**
 * Annualized fee yield extrapolated from a realized return over an interval:
 *
 *   apy_bps ≈ earned / costBasis * (ms_per_year / intervalMs) * 10_000
 *
 * Simple-interest annualization — does not compound. Returns Err if cost
 * basis is zero or interval is non-positive.
 */
export const annualizedFeeYieldBps = (
  earnedLamports: bigint,
  costBasisLamports: bigint,
  intervalMs: number,
): Result<number, ValidationError> => {
  const e = validateNonNegativeBigInt(earnedLamports, 'earnedLamports');
  if (!e.ok) return e;
  const cb = validateNonNegativeBigInt(costBasisLamports, 'costBasisLamports');
  if (!cb.ok) return cb;
  if (costBasisLamports === 0n) {
    return err(new ValidationError('costBasisLamports must be > 0'));
  }
  const interval = validatePositiveInt(intervalMs, 'intervalMs');
  if (!interval.ok) return interval;

  const apyBps =
    (earnedLamports * 10_000n * BigInt(MS_PER_YEAR)) / (costBasisLamports * BigInt(intervalMs));
  return ok(Number(apyBps));
};
