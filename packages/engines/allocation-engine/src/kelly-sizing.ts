import { type Result, ValidationError, err, ok } from '@alexithymia/shared-errors';
import type { KellyInputs } from './allocation.types.js';

/**
 * Classic Kelly criterion:
 *
 *   f* = p − (1 − p) / b
 *
 * `f*` is the fraction of free capital that maximizes long-run log-growth
 * given win probability `p` and win/loss ratio `b`.
 *
 * Negative Kelly ⇒ the bet has negative expectation; this returns `0`
 * (don't deploy). The fraction is also clamped to `[0, 1]` because a Kelly
 * bet greater than 100 % of capital is meaningless without leverage, which
 * is outside our system's scope.
 */
export const kellyFraction = (inputs: KellyInputs): Result<number, ValidationError> => {
  const { winRate, winLossRatio } = inputs;
  if (!Number.isFinite(winRate) || winRate < 0 || winRate > 1) {
    return err(
      new ValidationError('winRate must be a finite number in [0, 1]', {
        context: { winRate },
      }),
    );
  }
  if (!Number.isFinite(winLossRatio) || winLossRatio <= 0) {
    return err(
      new ValidationError('winLossRatio must be a positive finite number', {
        context: { winLossRatio },
      }),
    );
  }

  const raw = winRate - (1 - winRate) / winLossRatio;
  if (raw <= 0) return ok(0);
  if (raw >= 1) return ok(1);
  return ok(raw);
};
