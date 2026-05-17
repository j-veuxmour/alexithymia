import { err, ok, type Result, ValidationError } from '@alexithymia/shared-errors';
import type { CandidateScore, WeightedSignal } from '../signal.types.js';

/**
 * Composite score from caller-normalized signals.
 *
 *   composite = Σ(valueᵢ · weightᵢ) / Σweightᵢ
 *
 * Each `value` must already lie in [0, 1] — the engine does not know each
 * signal's domain range. Weights must be non-negative; at least one must
 * be positive (so the denominator is non-zero).
 *
 * The breakdown attributes the *normalized* contribution per signal so
 * downstream consumers can explain which signal drove the score.
 */
export const scoreCandidate = (
  signals: readonly WeightedSignal[],
): Result<CandidateScore, ValidationError> => {
  if (signals.length === 0) {
    return err(new ValidationError('scoreCandidate requires at least one signal'));
  }

  let weightSum = 0;
  for (let i = 0; i < signals.length; i += 1) {
    const s = signals[i] as WeightedSignal;
    if (!Number.isFinite(s.value) || s.value < 0 || s.value > 1) {
      return err(
        new ValidationError(`signals[${i}].value must be in [0, 1]`, {
          context: { name: s.name, value: s.value },
        }),
      );
    }
    if (!Number.isFinite(s.weight) || s.weight < 0) {
      return err(
        new ValidationError(`signals[${i}].weight must be a non-negative finite number`, {
          context: { name: s.name, weight: s.weight },
        }),
      );
    }
    weightSum += s.weight;
  }
  if (weightSum === 0) {
    return err(new ValidationError('total weight must be > 0'));
  }

  let composite = 0;
  const breakdown: Record<string, number> = {};
  for (let i = 0; i < signals.length; i += 1) {
    const s = signals[i] as WeightedSignal;
    const contribution = (s.value * s.weight) / weightSum;
    composite += contribution;
    breakdown[s.name] = contribution;
  }
  return ok({ compositeScore: composite, breakdown });
};
