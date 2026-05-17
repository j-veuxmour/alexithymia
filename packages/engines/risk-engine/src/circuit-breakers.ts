import { type Result, ValidationError, err, ok } from '@alexithymia/shared-errors';
import type { CircuitBreakerLimits, PortfolioState, RiskCheckResult } from './risk.types.js';

const validateNonNegativeBigInt = (value: bigint, field: string): Result<void, ValidationError> => {
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

/** Trip if the consecutive-loss streak hits or exceeds the configured cap. */
export const checkConsecutiveLosses = (
  state: PortfolioState,
  limits: CircuitBreakerLimits,
): Result<RiskCheckResult, ValidationError> => {
  const streak = validateNonNegativeInt(state.consecutiveLosses, 'consecutiveLosses');
  if (!streak.ok) return streak;
  const cap = validateNonNegativeInt(limits.maxConsecutiveLosses, 'maxConsecutiveLosses');
  if (!cap.ok) return cap;

  const passed = state.consecutiveLosses < limits.maxConsecutiveLosses;
  return ok({
    id: 'circuit.consecutive-losses',
    passed,
    reason: passed
      ? `streak ${state.consecutiveLosses} below cap ${limits.maxConsecutiveLosses}`
      : `streak ${state.consecutiveLosses} hit cap ${limits.maxConsecutiveLosses}`,
    context: {
      streak: state.consecutiveLosses,
      cap: limits.maxConsecutiveLosses,
    },
  });
};

/** Trip if realized daily loss has reached or exceeded the cap. */
export const checkDailyLossBreaker = (
  state: PortfolioState,
  limits: CircuitBreakerLimits,
): Result<RiskCheckResult, ValidationError> => {
  const cap = validateNonNegativeBigInt(limits.maxDailyLossLamports, 'maxDailyLossLamports');
  if (!cap.ok) return cap;

  const loss = state.realizedDailyPnlLamports < 0n ? -state.realizedDailyPnlLamports : 0n;
  const passed = loss < limits.maxDailyLossLamports;
  return ok({
    id: 'circuit.daily-loss',
    passed,
    reason: passed
      ? `daily loss ${loss} below breaker ${limits.maxDailyLossLamports}`
      : `daily loss ${loss} tripped breaker ${limits.maxDailyLossLamports}`,
    context: { dailyLossLamports: loss, breakerLamports: limits.maxDailyLossLamports },
  });
};

/** Trip if drawdown bps reaches or exceeds the breaker. */
export const checkDrawdownBreaker = (
  state: PortfolioState,
  limits: CircuitBreakerLimits,
): Result<RiskCheckResult, ValidationError> => {
  const eq = validateNonNegativeBigInt(state.totalEquityLamports, 'totalEquityLamports');
  if (!eq.ok) return eq;
  const peak = validateNonNegativeBigInt(state.peakEquityLamports, 'peakEquityLamports');
  if (!peak.ok) return peak;
  const bps = validateBps(limits.maxDrawdownBps, 'maxDrawdownBps');
  if (!bps.ok) return bps;

  if (state.peakEquityLamports === 0n) {
    return ok({
      id: 'circuit.drawdown',
      passed: true,
      reason: 'no historical peak; breaker disarmed',
      context: {},
    });
  }
  const drop =
    state.peakEquityLamports > state.totalEquityLamports
      ? state.peakEquityLamports - state.totalEquityLamports
      : 0n;
  const ddBps = Number((drop * 10_000n) / state.peakEquityLamports);
  const passed = ddBps < limits.maxDrawdownBps;
  return ok({
    id: 'circuit.drawdown',
    passed,
    reason: passed
      ? `drawdown ${ddBps} bps below breaker ${limits.maxDrawdownBps} bps`
      : `drawdown ${ddBps} bps tripped breaker ${limits.maxDrawdownBps} bps`,
    context: { ddBps, breakerBps: limits.maxDrawdownBps },
  });
};

/** Operator-controlled kill switch. */
export const checkKillSwitch = (state: PortfolioState): RiskCheckResult => ({
  id: 'circuit.kill-switch',
  passed: !state.killSwitchActive,
  reason: state.killSwitchActive ? 'kill switch is active' : 'kill switch inactive',
  context: { killSwitchActive: state.killSwitchActive },
});

/** Run all circuit-breaker checks. */
export const evaluateCircuitBreakers = (
  state: PortfolioState,
  limits: CircuitBreakerLimits,
): Result<readonly RiskCheckResult[], ValidationError> => {
  const cl = checkConsecutiveLosses(state, limits);
  if (!cl.ok) return cl;
  const dl = checkDailyLossBreaker(state, limits);
  if (!dl.ok) return dl;
  const dd = checkDrawdownBreaker(state, limits);
  if (!dd.ok) return dd;
  return ok([cl.value, dl.value, dd.value, checkKillSwitch(state)]);
};
