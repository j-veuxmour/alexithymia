import { type Result, ValidationError, err, ok } from '@alexithymia/shared-errors';
import type { UnixMs } from '@alexithymia/shared-utils';
import type { OracleReading, PriceLamports, ReconciledPrice } from './pricing.types.js';

/**
 * Internal median over a list of already-validated lamport prices.
 * Caller must guarantee `prices.length >= 1` and all values >= 0.
 */
const medianUnchecked = (prices: readonly bigint[]): bigint => {
  const sorted = [...prices].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] as bigint;
  }
  const lo = sorted[mid - 1] as bigint;
  const hi = sorted[mid] as bigint;
  return (lo + hi) / 2n;
};

/**
 * Integer median of a non-empty list of lamport prices. For even-length
 * inputs returns the floor-average of the two middle entries (deterministic
 * tie-breaking; never increases above the upper middle).
 */
export const medianPriceLamports = (
  readings: readonly OracleReading[],
): Result<PriceLamports, ValidationError> => {
  if (readings.length === 0) {
    return err(new ValidationError('medianPriceLamports requires ≥ 1 reading'));
  }
  for (let i = 0; i < readings.length; i += 1) {
    const r = readings[i] as OracleReading;
    if (r.priceLamports < 0n) {
      return err(
        new ValidationError(`readings[${i}].priceLamports must be non-negative`, {
          context: { priceLamports: r.priceLamports },
        }),
      );
    }
  }
  return ok(medianUnchecked(readings.map((r) => r.priceLamports)));
};

/**
 * Symmetric percentage gap between two prices, in basis points:
 *
 *   divergence_bps = |a - b| / min(a, b) · 10_000
 *
 * Uses `min` (not `mean`) so a divergence of 100 % is reported as 10 000 bps.
 * Returns Err if either input is non-positive (no meaningful denominator).
 */
export const priceDivergenceBps = (
  a: PriceLamports,
  b: PriceLamports,
): Result<number, ValidationError> => {
  if (a <= 0n || b <= 0n) {
    return err(
      new ValidationError('priceDivergenceBps requires both prices > 0', {
        context: { a, b },
      }),
    );
  }
  const min = a < b ? a : b;
  const diff = a < b ? b - a : a - b;
  return ok(Number((diff * 10_000n) / min));
};

/**
 * Whether a reading is past its freshness budget.
 *
 *   stale ⇔ now - reading.timestamp > maxAgeMs
 */
export const isOracleStale = (reading: OracleReading, maxAgeMs: number, now: UnixMs): boolean => {
  if (!Number.isFinite(maxAgeMs) || maxAgeMs < 0) {
    throw new RangeError('maxAgeMs must be a non-negative finite number');
  }
  return now - reading.timestamp > maxAgeMs;
};

export interface ReconcileOptions {
  /** Reject if any pairwise divergence exceeds this. */
  readonly maxDivergenceBps: number;
  readonly maxAgeMs: number;
  readonly now: UnixMs;
}

/**
 * Drop stale readings, verify the survivors are all pairwise within
 * `maxDivergenceBps`, and return the median of those used. Returns Err if:
 *   - no readings remain after staleness filtering, or
 *   - any two surviving readings disagree by more than `maxDivergenceBps`.
 *
 * This is the price gate used before any deploy or close decision.
 */
export const reconcileOraclePrices = (
  readings: readonly OracleReading[],
  options: ReconcileOptions,
): Result<ReconciledPrice, ValidationError> => {
  if (!Number.isInteger(options.maxDivergenceBps) || options.maxDivergenceBps < 0) {
    return err(
      new ValidationError('maxDivergenceBps must be a non-negative integer', {
        context: { maxDivergenceBps: options.maxDivergenceBps },
      }),
    );
  }
  if (!Number.isFinite(options.maxAgeMs) || options.maxAgeMs < 0) {
    return err(
      new ValidationError('maxAgeMs must be a non-negative finite number', {
        context: { maxAgeMs: options.maxAgeMs },
      }),
    );
  }

  const fresh = readings.filter((r) => !isOracleStale(r, options.maxAgeMs, options.now));
  if (fresh.length === 0) {
    return err(
      new ValidationError('no fresh oracle readings within maxAgeMs', {
        context: { totalReadings: readings.length, maxAgeMs: options.maxAgeMs },
      }),
    );
  }

  for (let i = 0; i < fresh.length; i += 1) {
    for (let j = i + 1; j < fresh.length; j += 1) {
      const a = (fresh[i] as OracleReading).priceLamports;
      const b = (fresh[j] as OracleReading).priceLamports;
      const div = priceDivergenceBps(a, b);
      if (!div.ok) return div;
      if (div.value > options.maxDivergenceBps) {
        return err(
          new ValidationError('oracle divergence exceeds threshold', {
            context: {
              divergenceBps: div.value,
              maxDivergenceBps: options.maxDivergenceBps,
              sourceA: (fresh[i] as OracleReading).source,
              sourceB: (fresh[j] as OracleReading).source,
            },
          }),
        );
      }
    }
  }

  // All `fresh` readings already passed the divergence check, which requires
  // priceLamports > 0; the unchecked median below is safe.
  const consensus = medianUnchecked(fresh.map((r) => r.priceLamports));
  return ok({ consensusLamports: consensus, usedReadings: fresh });
};
