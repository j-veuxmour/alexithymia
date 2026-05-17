import { err, ok, type Result, ValidationError } from '@alexithymia/shared-errors';

/**
 * Normalize a weight map so the values sum to 1. Keys with zero or negative
 * weight are still rejected — the caller must positively express which
 * signals matter and to what degree.
 *
 * Returns Err on an empty map or any non-positive weight.
 */
export const normalizeWeights = (
  weights: Readonly<Record<string, number>>,
): Result<Readonly<Record<string, number>>, ValidationError> => {
  const entries = Object.entries(weights);
  if (entries.length === 0) {
    return err(new ValidationError('normalizeWeights requires at least one entry'));
  }

  let total = 0;
  for (const [name, w] of entries) {
    if (!Number.isFinite(w) || w <= 0) {
      return err(
        new ValidationError(`weight for "${name}" must be a positive finite number`, {
          context: { name, weight: w },
        }),
      );
    }
    total += w;
  }

  const out: Record<string, number> = {};
  for (const [name, w] of entries) {
    out[name] = w / total;
  }
  return ok(out);
};

/**
 * Element-wise product of a value map and a weight map, summed.
 * Used for ad-hoc weighted aggregations outside the candidate scorer.
 *
 * Returns Err if the value and weight maps disagree on keys or any value
 * is non-finite.
 */
export const applyWeights = (
  values: Readonly<Record<string, number>>,
  weights: Readonly<Record<string, number>>,
): Result<number, ValidationError> => {
  const valueKeys = Object.keys(values);
  const weightKeys = Object.keys(weights);
  if (valueKeys.length !== weightKeys.length) {
    return err(
      new ValidationError('values and weights must have the same keys', {
        context: { valueCount: valueKeys.length, weightCount: weightKeys.length },
      }),
    );
  }
  let total = 0;
  for (const k of valueKeys) {
    const v = values[k];
    const w = weights[k];
    if (v === undefined || w === undefined) {
      return err(
        new ValidationError(`key "${k}" missing from values or weights`, {
          context: { key: k },
        }),
      );
    }
    if (!Number.isFinite(v) || !Number.isFinite(w)) {
      return err(
        new ValidationError(`value or weight for "${k}" is not a finite number`, {
          context: { key: k, value: v, weight: w },
        }),
      );
    }
    total += v * w;
  }
  return ok(total);
};
