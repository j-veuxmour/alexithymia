import { err, ok, type Result, ValidationError } from '@alexithymia/shared-errors';
import type { RangeBudget, RangeInputs, RangePolicy } from './strategy.types.js';

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

const validateNonNegativeInt = (value: number, field: string): Result<void, ValidationError> => {
  if (!Number.isInteger(value) || value < 0) {
    return err(
      new ValidationError(`${field} must be a non-negative integer`, { context: { value } }),
    );
  }
  return ok(undefined);
};

const validatePolicy = (policy: RangePolicy): Result<void, ValidationError> => {
  const minB = validateNonNegativeInt(policy.minBinsBelow, 'minBinsBelow');
  if (!minB.ok) return minB;
  const maxB = validateNonNegativeInt(policy.maxBinsBelow, 'maxBinsBelow');
  if (!maxB.ok) return maxB;
  const minA = validateNonNegativeInt(policy.minBinsAbove, 'minBinsAbove');
  if (!minA.ok) return minA;
  const maxA = validateNonNegativeInt(policy.maxBinsAbove, 'maxBinsAbove');
  if (!maxA.ok) return maxA;
  if (policy.minBinsBelow > policy.maxBinsBelow) {
    return err(
      new ValidationError('minBinsBelow must be <= maxBinsBelow', {
        context: { minBinsBelow: policy.minBinsBelow, maxBinsBelow: policy.maxBinsBelow },
      }),
    );
  }
  if (policy.minBinsAbove > policy.maxBinsAbove) {
    return err(
      new ValidationError('minBinsAbove must be <= maxBinsAbove', {
        context: { minBinsAbove: policy.minBinsAbove, maxBinsAbove: policy.maxBinsAbove },
      }),
    );
  }
  if (!Number.isFinite(policy.volatilityScale) || policy.volatilityScale <= 0) {
    return err(
      new ValidationError('volatilityScale must be a positive finite number', {
        context: { volatilityScale: policy.volatilityScale },
      }),
    );
  }
  return ok(undefined);
};

/**
 * Linear interpolation: at vol = 0 → min, at vol >= volatilityScale → max.
 * Result is rounded to the nearest integer and clamped at the upper
 * bound. The lower bound holds by construction (ratio ≥ 0, max ≥ min),
 * so no explicit lower clamp is needed.
 */
const interpolate = (vol: number, scale: number, min: number, max: number): number => {
  if (max === min) return min;
  const ratio = vol / scale;
  const rounded = Math.round(min + ratio * (max - min));
  return rounded > max ? max : rounded;
};

/**
 * Translate a volatility reading into a bin-count budget.
 *
 *   binsBelow = round(min + (vol / scale) · (max - min)), clamped to [min, max]
 *
 * Higher volatility ⇒ wider range, up to the policy ceiling. Above
 * `volatilityScale`, the ceiling holds (saturation). Both sides of the
 * active bin scale independently — supports asymmetric ranges
 * (e.g. single-side SOL where `maxBinsAbove = 0`).
 */
export const computeRangeBudget = (
  inputs: RangeInputs,
): Result<RangeBudget, ValidationError> => {
  const v = validateFiniteNonNegative(inputs.volatility, 'volatility');
  if (!v.ok) return v;
  const p = validatePolicy(inputs.policy);
  if (!p.ok) return p;

  const { policy, volatility } = inputs;
  const binsBelow = interpolate(
    volatility,
    policy.volatilityScale,
    policy.minBinsBelow,
    policy.maxBinsBelow,
  );
  const binsAbove = interpolate(
    volatility,
    policy.volatilityScale,
    policy.minBinsAbove,
    policy.maxBinsAbove,
  );
  return ok({ binsBelow, binsAbove });
};
