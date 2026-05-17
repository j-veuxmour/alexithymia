import { type Result, ValidationError, err, ok } from '@alexithymia/shared-errors';

/**
 * Scale a Kelly fraction by a conservative multiplier:
 *
 *   conservative = kelly × multiplier
 *
 * Quarter Kelly (×0.25) and half Kelly (×0.5) trade some long-run growth
 * for substantially lower bankroll volatility — preferable when win-rate
 * estimates are noisy, as they inevitably are when sourced from a small
 * trade history.
 */
export const fractionalKelly = (
  kelly: number,
  multiplier: number,
): Result<number, ValidationError> => {
  if (!Number.isFinite(kelly) || kelly < 0 || kelly > 1) {
    return err(
      new ValidationError('kelly must be a finite number in [0, 1]', {
        context: { kelly },
      }),
    );
  }
  if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 1) {
    return err(
      new ValidationError('multiplier must be a finite number in (0, 1]', {
        context: { multiplier },
      }),
    );
  }
  return ok(kelly * multiplier);
};
