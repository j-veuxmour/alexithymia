import { type Result, ValidationError, err, ok } from '@alexithymia/shared-errors';
import {
  DEFAULT_MIN_VOLATILITY_TIMEFRAME,
  TIMEFRAME_MINUTES,
  type Timeframe,
} from './dlmm.types.js';

const isTimeframe = (value: unknown): value is Timeframe =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(TIMEFRAME_MINUTES, value);

/**
 * Pick the timeframe used to source pool volatility, given the screening
 * timeframe. Volatility on very short windows (5m/15m) is noisy and tends
 * to under-state risk for LP sizing; we floor at `minTimeframe` (default
 * 30m, matching Meridian behaviour).
 *
 *   normalize('5m', '30m')  → '30m'
 *   normalize('1h', '30m')  → '1h'
 *   normalize('4h')         → '4h'
 */
export const normalizeVolatilityTimeframe = (
  sourceTimeframe: Timeframe | string,
  minTimeframe: Timeframe = DEFAULT_MIN_VOLATILITY_TIMEFRAME,
): Result<Timeframe, ValidationError> => {
  if (!isTimeframe(sourceTimeframe)) {
    return err(
      new ValidationError('unknown source timeframe', { context: { sourceTimeframe } }),
    );
  }
  if (!isTimeframe(minTimeframe)) {
    return err(new ValidationError('unknown min timeframe', { context: { minTimeframe } }));
  }
  const sourceMinutes = TIMEFRAME_MINUTES[sourceTimeframe];
  const minMinutes = TIMEFRAME_MINUTES[minTimeframe];
  return ok(sourceMinutes >= minMinutes ? sourceTimeframe : minTimeframe);
};

/**
 * Convert a volatility measurement between timeframes assuming a
 * Brownian random walk: `σ_to = σ_from · √(t_to / t_from)`.
 *
 * This is an approximation — real markets exhibit volatility clustering
 * — but it is the standard scaling used to compare windows. Returns an
 * error for non-finite or negative inputs.
 */
export const scaleVolatility = (
  volatility: number,
  fromTimeframe: Timeframe | string,
  toTimeframe: Timeframe | string,
): Result<number, ValidationError> => {
  if (!Number.isFinite(volatility) || volatility < 0) {
    return err(
      new ValidationError('volatility must be a non-negative finite number', {
        context: { volatility },
      }),
    );
  }
  if (!isTimeframe(fromTimeframe)) {
    return err(
      new ValidationError('unknown fromTimeframe', { context: { fromTimeframe } }),
    );
  }
  if (!isTimeframe(toTimeframe)) {
    return err(new ValidationError('unknown toTimeframe', { context: { toTimeframe } }));
  }
  const fromMinutes = TIMEFRAME_MINUTES[fromTimeframe];
  const toMinutes = TIMEFRAME_MINUTES[toTimeframe];
  return ok(volatility * Math.sqrt(toMinutes / fromMinutes));
};

/**
 * True if `timeframe` provides at least `minTimeframe` of window. Useful
 * as a guard before consuming a volatility number for risk decisions.
 */
export const isVolatilityTimeframeAdequate = (
  timeframe: Timeframe | string,
  minTimeframe: Timeframe = DEFAULT_MIN_VOLATILITY_TIMEFRAME,
): Result<boolean, ValidationError> => {
  if (!isTimeframe(timeframe)) {
    return err(new ValidationError('unknown timeframe', { context: { timeframe } }));
  }
  if (!isTimeframe(minTimeframe)) {
    return err(new ValidationError('unknown minTimeframe', { context: { minTimeframe } }));
  }
  return ok(TIMEFRAME_MINUTES[timeframe] >= TIMEFRAME_MINUTES[minTimeframe]);
};
