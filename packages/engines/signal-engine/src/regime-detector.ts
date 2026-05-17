import { err, ok, type Result, ValidationError } from '@alexithymia/shared-errors';
import type { RegimeFeatures, RegimeResult, RegimeThresholds } from './signal.types.js';

const validateFiniteNonNegative = (
  value: number,
  field: string,
): Result<void, ValidationError> => {
  if (!Number.isFinite(value) || value < 0) {
    return err(
      new ValidationError(`${field} must be a non-negative finite number`, {
        context: { value },
      }),
    );
  }
  return ok(undefined);
};

const validateFinite = (value: number, field: string): Result<void, ValidationError> => {
  if (!Number.isFinite(value)) {
    return err(
      new ValidationError(`${field} must be a finite number`, {
        context: { value },
      }),
    );
  }
  return ok(undefined);
};

const validateBpsRange = (value: number, field: string): Result<void, ValidationError> => {
  if (!Number.isFinite(value) || value < 0 || value > 10_000) {
    return err(
      new ValidationError(`${field} must be a finite number in [0, 10000]`, {
        context: { value },
      }),
    );
  }
  return ok(undefined);
};

const validateFeatures = (features: RegimeFeatures): Result<void, ValidationError> => {
  const vol = validateFiniteNonNegative(features.volatilityBps, 'volatilityBps');
  if (!vol.ok) return vol;
  const trend = validateFinite(features.trendBps, 'trendBps');
  if (!trend.ok) return trend;
  const breadth = validateBpsRange(features.breadthBps, 'breadthBps');
  if (!breadth.ok) return breadth;
  return ok(undefined);
};

const validateThresholds = (
  thresholds: RegimeThresholds,
): Result<void, ValidationError> => {
  const hv = validateFiniteNonNegative(thresholds.highVolBps, 'highVolBps');
  if (!hv.ok) return hv;
  const bt = validateFinite(thresholds.bullishTrendBps, 'bullishTrendBps');
  if (!bt.ok) return bt;
  const xt = validateFinite(thresholds.bearishTrendBps, 'bearishTrendBps');
  if (!xt.ok) return xt;
  const bb = validateBpsRange(thresholds.bullBreadthBps, 'bullBreadthBps');
  if (!bb.ok) return bb;
  const xb = validateBpsRange(thresholds.bearBreadthBps, 'bearBreadthBps');
  if (!xb.ok) return xb;
  if (thresholds.bearishTrendBps >= thresholds.bullishTrendBps) {
    return err(
      new ValidationError('bearishTrendBps must be strictly less than bullishTrendBps', {
        context: {
          bearishTrendBps: thresholds.bearishTrendBps,
          bullishTrendBps: thresholds.bullishTrendBps,
        },
      }),
    );
  }
  if (thresholds.bearBreadthBps >= thresholds.bullBreadthBps) {
    return err(
      new ValidationError('bearBreadthBps must be strictly less than bullBreadthBps', {
        context: {
          bearBreadthBps: thresholds.bearBreadthBps,
          bullBreadthBps: thresholds.bullBreadthBps,
        },
      }),
    );
  }
  return ok(undefined);
};

/**
 * Classify the prevailing market regime from a compact feature vector.
 *
 *   risk-off  ⇔ volatilityBps > highVolBps
 *                OR trendBps   ≤ bearishTrendBps
 *                OR breadthBps ≤ bearBreadthBps
 *
 *   risk-on   ⇔ volatilityBps ≤ highVolBps
 *                AND trendBps   ≥ bullishTrendBps
 *                AND breadthBps ≥ bullBreadthBps
 *
 *   transitional otherwise.
 *
 * Risk-off is evaluated first because *any* one bearish signal is enough
 * to pull the system into a defensive posture; risk-on requires all
 * three bullish criteria to align.
 *
 * The reason array enumerates each criterion that fired (or held) — used
 * by Strategist Manager to explain regime narratives without re-running
 * the logic.
 */
export const detectRegime = (
  features: RegimeFeatures,
  thresholds: RegimeThresholds,
): Result<RegimeResult, ValidationError> => {
  const f = validateFeatures(features);
  if (!f.ok) return f;
  const t = validateThresholds(thresholds);
  if (!t.ok) return t;

  const reasons: string[] = [];

  const volHigh = features.volatilityBps > thresholds.highVolBps;
  const trendBearish = features.trendBps <= thresholds.bearishTrendBps;
  const breadthBearish = features.breadthBps <= thresholds.bearBreadthBps;

  if (volHigh) {
    reasons.push(
      `volatility ${features.volatilityBps} bps exceeds high-vol cap ${thresholds.highVolBps} bps`,
    );
  }
  if (trendBearish) {
    reasons.push(
      `trend ${features.trendBps} bps at or below bearish floor ${thresholds.bearishTrendBps} bps`,
    );
  }
  if (breadthBearish) {
    reasons.push(
      `breadth ${features.breadthBps} bps at or below bearish floor ${thresholds.bearBreadthBps} bps`,
    );
  }

  if (volHigh || trendBearish || breadthBearish) {
    return ok({ regime: 'risk-off', reasons });
  }

  const trendBullish = features.trendBps >= thresholds.bullishTrendBps;
  const breadthBullish = features.breadthBps >= thresholds.bullBreadthBps;
  const volContained = features.volatilityBps <= thresholds.highVolBps;

  if (trendBullish && breadthBullish && volContained) {
    reasons.push(
      `trend ${features.trendBps} bps at or above bullish floor ${thresholds.bullishTrendBps} bps`,
      `breadth ${features.breadthBps} bps at or above bullish floor ${thresholds.bullBreadthBps} bps`,
      `volatility ${features.volatilityBps} bps within cap ${thresholds.highVolBps} bps`,
    );
    return ok({ regime: 'risk-on', reasons });
  }

  if (!trendBullish) {
    reasons.push(
      `trend ${features.trendBps} bps below bullish floor ${thresholds.bullishTrendBps} bps`,
    );
  }
  if (!breadthBullish) {
    reasons.push(
      `breadth ${features.breadthBps} bps below bullish floor ${thresholds.bullBreadthBps} bps`,
    );
  }
  return ok({ regime: 'transitional', reasons });
};
