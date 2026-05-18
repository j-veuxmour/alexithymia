import { type Result, ValidationError, err, ok } from '@alexithymia/shared-errors';
import type {
  PriorityFeeRecommendation,
  PriorityFeeSample,
} from './tx-construction.types.js';

export interface RecommendPriorityFeeInput {
  readonly samples: readonly PriorityFeeSample[];
  /** Percentile to pick from the sample distribution (0..100). */
  readonly percentile: number;
  /** Multiplier above the chosen percentile, in bps (10_000 = 1.0x). */
  readonly multiplierBps: number;
  /** Hard ceiling on the recommended fee. */
  readonly maxMicroLamportsPerCu: bigint;
  /** Used when samples is empty. Engine signals `source = 'fallback'`. */
  readonly fallbackMicroLamportsPerCu: bigint;
}

const validatePercentile = (p: number): Result<void, ValidationError> => {
  if (!Number.isFinite(p) || p < 0 || p > 100) {
    return err(
      new ValidationError('percentile must be a finite number in [0, 100]', {
        context: { percentile: p },
      }),
    );
  }
  return ok(undefined);
};

const validateNonNegativeBigInt = (
  value: bigint,
  field: string,
): Result<void, ValidationError> => {
  if (value < 0n) {
    return err(new ValidationError(`${field} must be non-negative`, { context: { value } }));
  }
  return ok(undefined);
};

const validateNonNegativeInt = (value: number, field: string): Result<void, ValidationError> => {
  if (!Number.isInteger(value) || value < 0) {
    return err(
      new ValidationError(`${field} must be a non-negative integer`, { context: { value } }),
    );
  }
  return ok(undefined);
};

/**
 * Linear-interpolated percentile of bigint samples.
 *
 *   - `percentile = 0`   → min
 *   - `percentile = 100` → max
 *   - between: takes the floor of the linear blend (rank = p · (n-1) / 100).
 *
 * Empty input throws — callers should branch on samples.length before
 * invoking this helper.
 */
export const percentileMicroLamports = (
  samples: readonly PriorityFeeSample[],
  percentile: number,
): bigint => {
  if (samples.length === 0) {
    throw new RangeError('percentileMicroLamports requires at least one sample');
  }
  const sorted = [...samples].sort((a, b) => {
    if (a.microLamportsPerCu < b.microLamportsPerCu) return -1;
    if (a.microLamportsPerCu > b.microLamportsPerCu) return 1;
    return 0;
  });
  if (sorted.length === 1) return (sorted[0] as PriorityFeeSample).microLamportsPerCu;
  // Use floored linear interpolation so the result is deterministic and
  // monotonic in `percentile`. Sub-unit fractions don't matter for fees.
  const rank = (percentile / 100) * (sorted.length - 1);
  const lowerIdx = Math.floor(rank);
  const upperIdx = Math.min(lowerIdx + 1, sorted.length - 1);
  const lower = (sorted[lowerIdx] as PriorityFeeSample).microLamportsPerCu;
  const upper = (sorted[upperIdx] as PriorityFeeSample).microLamportsPerCu;
  const fracBps = BigInt(Math.round((rank - lowerIdx) * 10_000));
  return lower + ((upper - lower) * fracBps) / 10_000n;
};

const applyMultiplier = (value: bigint, multiplierBps: number): bigint =>
  (value * BigInt(multiplierBps)) / 10_000n;

/**
 * Recommend a priority-fee bid from observed samples.
 *
 *   pick      = percentileMicroLamports(samples, percentile)
 *   raw       = pick · multiplierBps / 10_000
 *   capped    = min(raw, maxMicroLamportsPerCu)
 *
 * When samples is empty, falls back to `fallbackMicroLamportsPerCu`
 * (still subject to `maxMicroLamportsPerCu`).
 */
export const recommendPriorityFee = (
  input: RecommendPriorityFeeInput,
): Result<PriorityFeeRecommendation, ValidationError> => {
  const p = validatePercentile(input.percentile);
  if (!p.ok) return p;
  const m = validateNonNegativeInt(input.multiplierBps, 'multiplierBps');
  if (!m.ok) return m;
  const cap = validateNonNegativeBigInt(input.maxMicroLamportsPerCu, 'maxMicroLamportsPerCu');
  if (!cap.ok) return cap;
  const fb = validateNonNegativeBigInt(
    input.fallbackMicroLamportsPerCu,
    'fallbackMicroLamportsPerCu',
  );
  if (!fb.ok) return fb;
  for (let i = 0; i < input.samples.length; i += 1) {
    const s = input.samples[i] as PriorityFeeSample;
    if (s.microLamportsPerCu < 0n) {
      return err(
        new ValidationError(`samples[${i}].microLamportsPerCu must be non-negative`, {
          context: { sample: s },
        }),
      );
    }
  }

  const source: 'samples' | 'fallback' = input.samples.length > 0 ? 'samples' : 'fallback';
  const base =
    source === 'samples'
      ? percentileMicroLamports(input.samples, input.percentile)
      : input.fallbackMicroLamportsPerCu;
  const raw = applyMultiplier(base, input.multiplierBps);
  const cappedByMax = raw > input.maxMicroLamportsPerCu;
  const value = cappedByMax ? input.maxMicroLamportsPerCu : raw;

  return ok({
    microLamportsPerCu: value,
    percentile: input.percentile,
    multiplierBps: input.multiplierBps,
    cappedByMax,
    source,
  });
};

export interface EscalateFeeInput {
  readonly baseMicroLamportsPerCu: bigint;
  /** Retry attempt (0 = original send, 1 = first retry, etc.). */
  readonly attempt: number;
  /**
   * Per-attempt multiplier in bps applied on top of the previous attempt
   * (10_000 = no change, 15_000 = 1.5×). Compounds geometrically.
   */
  readonly escalationFactorBps: number;
  readonly ceilingMicroLamportsPerCu: bigint;
}

/**
 * Geometric fee-bump for retries: `base · (factor/10_000)^attempt`,
 * capped at `ceiling`. attempt=0 returns base unchanged.
 */
export const escalateFee = (input: EscalateFeeInput): Result<bigint, ValidationError> => {
  const baseCheck = validateNonNegativeBigInt(
    input.baseMicroLamportsPerCu,
    'baseMicroLamportsPerCu',
  );
  if (!baseCheck.ok) return baseCheck;
  const attemptCheck = validateNonNegativeInt(input.attempt, 'attempt');
  if (!attemptCheck.ok) return attemptCheck;
  const factorCheck = validateNonNegativeInt(input.escalationFactorBps, 'escalationFactorBps');
  if (!factorCheck.ok) return factorCheck;
  const ceilCheck = validateNonNegativeBigInt(
    input.ceilingMicroLamportsPerCu,
    'ceilingMicroLamportsPerCu',
  );
  if (!ceilCheck.ok) return ceilCheck;

  let value = input.baseMicroLamportsPerCu;
  for (let i = 0; i < input.attempt; i += 1) {
    value = (value * BigInt(input.escalationFactorBps)) / 10_000n;
    if (value > input.ceilingMicroLamportsPerCu) {
      value = input.ceilingMicroLamportsPerCu;
      break;
    }
  }
  return ok(value);
};
