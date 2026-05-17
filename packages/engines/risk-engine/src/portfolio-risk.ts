import { type Result, ValidationError, err, ok } from '@alexithymia/shared-errors';
import type { PortfolioState, RiskBudgetLimits, RiskCheckResult } from './risk.types.js';

const validateNonNegativeBigInt = (value: bigint, field: string): Result<void, ValidationError> => {
  if (value < 0n) {
    return err(new ValidationError(`${field} must be non-negative`, { context: { value } }));
  }
  return ok(undefined);
};

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

/**
 * Drawdown gate. Drawdown is computed against the historical equity peak:
 *
 *   dd_bps = (peak − current) / peak · 10_000
 *
 * `passed = false` when `dd_bps > maxDrawdownBps`. If `peakEquityLamports`
 * is zero (cold start), the check trivially passes.
 */
export const checkDrawdown = (
  state: PortfolioState,
  budget: RiskBudgetLimits,
): Result<RiskCheckResult, ValidationError> => {
  const eq = validateNonNegativeBigInt(state.totalEquityLamports, 'totalEquityLamports');
  if (!eq.ok) return eq;
  const peak = validateNonNegativeBigInt(state.peakEquityLamports, 'peakEquityLamports');
  if (!peak.ok) return peak;
  const bps = validateBps(budget.maxDrawdownBps, 'maxDrawdownBps');
  if (!bps.ok) return bps;

  if (state.peakEquityLamports === 0n) {
    return ok({
      id: 'portfolio.drawdown',
      passed: true,
      reason: 'no historical peak to compare against',
      context: {},
    });
  }
  const drop =
    state.peakEquityLamports > state.totalEquityLamports
      ? state.peakEquityLamports - state.totalEquityLamports
      : 0n;
  const ddBps = Number((drop * 10_000n) / state.peakEquityLamports);
  const passed = ddBps <= budget.maxDrawdownBps;
  return ok({
    id: 'portfolio.drawdown',
    passed,
    reason: passed
      ? `drawdown ${ddBps} bps within cap ${budget.maxDrawdownBps} bps`
      : `drawdown ${ddBps} bps exceeds cap ${budget.maxDrawdownBps} bps`,
    context: { ddBps, maxDrawdownBps: budget.maxDrawdownBps },
  });
};

/**
 * Daily loss cap. The cap is a positive lamport magnitude; the check
 * compares against the absolute value of realized loss within the day.
 * Profits never deny.
 */
export const checkDailyLossCap = (
  state: PortfolioState,
  budget: RiskBudgetLimits,
): Result<RiskCheckResult, ValidationError> => {
  const cap = validateNonNegativeBigInt(budget.dailyLossCapLamports, 'dailyLossCapLamports');
  if (!cap.ok) return cap;

  const dailyLoss = state.realizedDailyPnlLamports < 0n ? -state.realizedDailyPnlLamports : 0n;
  const passed = dailyLoss <= budget.dailyLossCapLamports;
  return ok({
    id: 'portfolio.daily-loss-cap',
    passed,
    reason: passed
      ? `daily loss ${dailyLoss} within cap ${budget.dailyLossCapLamports}`
      : `daily loss ${dailyLoss} exceeds cap ${budget.dailyLossCapLamports}`,
    context: { dailyLossLamports: dailyLoss, capLamports: budget.dailyLossCapLamports },
  });
};

/**
 * Portfolio-level exposure cap. Applied including the candidate deploy
 * size — the check is "would deploying this exceed the cap?".
 */
export const checkMaxExposure = (
  state: PortfolioState,
  candidateLamports: bigint,
  budget: RiskBudgetLimits,
): Result<RiskCheckResult, ValidationError> => {
  const eq = validateNonNegativeBigInt(state.totalEquityLamports, 'totalEquityLamports');
  if (!eq.ok) return eq;
  const dep = validateNonNegativeBigInt(state.deployedLamports, 'deployedLamports');
  if (!dep.ok) return dep;
  const cand = validateNonNegativeBigInt(candidateLamports, 'candidateLamports');
  if (!cand.ok) return cand;
  const bps = validateBps(budget.maxExposureBps, 'maxExposureBps');
  if (!bps.ok) return bps;

  if (state.totalEquityLamports === 0n) {
    // Zero-equity portfolio cannot support any deploy.
    return ok({
      id: 'portfolio.max-exposure',
      passed: candidateLamports === 0n,
      reason: 'totalEquityLamports is zero',
      context: { candidateLamports },
    });
  }
  const projectedExposure = state.deployedLamports + candidateLamports;
  const cap = (state.totalEquityLamports * BigInt(budget.maxExposureBps)) / 10_000n;
  const passed = projectedExposure <= cap;
  return ok({
    id: 'portfolio.max-exposure',
    passed,
    reason: passed
      ? `projected exposure ${projectedExposure} within cap ${cap}`
      : `projected exposure ${projectedExposure} exceeds cap ${cap}`,
    context: { projectedExposureLamports: projectedExposure, capLamports: cap },
  });
};

/** Run all portfolio-level checks and return their results in declaration order. */
export const evaluatePortfolioRisk = (
  state: PortfolioState,
  candidateLamports: bigint,
  budget: RiskBudgetLimits,
): Result<readonly RiskCheckResult[], ValidationError> => {
  const dd = checkDrawdown(state, budget);
  if (!dd.ok) return dd;
  const dlc = checkDailyLossCap(state, budget);
  if (!dlc.ok) return dlc;
  const me = checkMaxExposure(state, candidateLamports, budget);
  if (!me.ok) return me;
  return ok([dd.value, dlc.value, me.value]);
};
