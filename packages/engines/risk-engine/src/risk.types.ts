import type { MintAddress, PoolAddress } from '@alexithymia/shared-domain';

export type RiskVerdict = 'allow' | 'deny';

/**
 * Stable, machine-readable identifiers for every individual risk check.
 * Stored on decisions for explainability and queried by Risk Manager to
 * decide which mitigation to apply.
 */
export type RiskCheckId =
  | 'portfolio.drawdown'
  | 'portfolio.daily-loss-cap'
  | 'portfolio.max-exposure'
  | 'position.projected-il'
  | 'position.tvl-impact'
  | 'correlation.token-overlap'
  | 'circuit.consecutive-losses'
  | 'circuit.daily-loss'
  | 'circuit.drawdown'
  | 'circuit.kill-switch';

export interface RiskCheckResult {
  readonly id: RiskCheckId;
  readonly passed: boolean;
  readonly reason: string;
  readonly context: Readonly<Record<string, unknown>>;
}

export interface RiskPolicyDecision {
  readonly verdict: RiskVerdict;
  readonly checks: readonly RiskCheckResult[];
  readonly denyingChecks: readonly RiskCheckId[];
}

/** Reference to one open position, slim enough for portfolio aggregation. */
export interface OpenPositionRef {
  readonly poolAddress: PoolAddress;
  readonly baseMint: MintAddress;
  readonly quoteMint: MintAddress;
  readonly deployedLamports: bigint;
}

/**
 * Portfolio snapshot the engine reads from. The engine does NOT compute
 * this — Portfolio Engine builds it from canonical state; Risk Engine
 * only evaluates against it.
 */
export interface PortfolioState {
  /** Total portfolio equity, lamports SOL. */
  readonly totalEquityLamports: bigint;
  /** Sum of deployed lamports across all open positions. */
  readonly deployedLamports: bigint;
  /** Historical peak equity, for drawdown calculation. */
  readonly peakEquityLamports: bigint;
  /** Signed realized PnL within the current UTC trading day, lamports. */
  readonly realizedDailyPnlLamports: bigint;
  readonly openPositions: readonly OpenPositionRef[];
  /** Streak of consecutive losing closes. */
  readonly consecutiveLosses: number;
  /** Operator-controlled kill switch. */
  readonly killSwitchActive: boolean;
}

/** Hard portfolio-level ceilings (subset of shared-domain RiskBudget). */
export interface RiskBudgetLimits {
  readonly maxDrawdownBps: number;
  readonly dailyLossCapLamports: bigint;
  readonly maxExposureBps: number;
}

/** Operational circuit-breaker limits. */
export interface CircuitBreakerLimits {
  readonly maxConsecutiveLosses: number;
  readonly maxDailyLossLamports: bigint;
  readonly maxDrawdownBps: number;
}
