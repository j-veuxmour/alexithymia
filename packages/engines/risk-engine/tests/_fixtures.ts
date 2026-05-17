import type { MintAddress, PoolAddress } from '@alexithymia/shared-domain';
import type {
  CircuitBreakerLimits,
  OpenPositionRef,
  PortfolioState,
  RiskBudgetLimits,
} from '../src/risk.types.js';

/* Stable test fixtures. Branded types cast directly since the engines treat
 * them as opaque strings — runtime validation lives in shared-domain. */

const mint = (s: string): MintAddress => s as unknown as MintAddress;
const pool = (s: string): PoolAddress => s as unknown as PoolAddress;

export const MINTS = {
  SOL: mint('So11111111111111111111111111111111111111112'),
  USDC: mint('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  BONK: mint('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'),
  WIF: mint('EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm'),
} as const;

export const POOLS = {
  SOL_USDC: pool('AVs9TA4nWDzfPJE9gGVNJMVhcQy3V9PGazuz33BfG2RA'),
} as const;

export const makeState = (overrides: Partial<PortfolioState> = {}): PortfolioState => ({
  totalEquityLamports: 100_000_000_000n,
  deployedLamports: 0n,
  peakEquityLamports: 100_000_000_000n,
  realizedDailyPnlLamports: 0n,
  openPositions: [],
  consecutiveLosses: 0,
  killSwitchActive: false,
  ...overrides,
});

export const makeBudget = (overrides: Partial<RiskBudgetLimits> = {}): RiskBudgetLimits => ({
  maxDrawdownBps: 2_000,
  dailyLossCapLamports: 5_000_000_000n,
  maxExposureBps: 6_000,
  ...overrides,
});

export const makeBreakers = (
  overrides: Partial<CircuitBreakerLimits> = {},
): CircuitBreakerLimits => ({
  maxConsecutiveLosses: 5,
  maxDailyLossLamports: 10_000_000_000n,
  maxDrawdownBps: 3_000,
  ...overrides,
});

export const makeOpenPosition = (overrides: Partial<OpenPositionRef> = {}): OpenPositionRef => ({
  poolAddress: POOLS.SOL_USDC,
  baseMint: MINTS.SOL,
  quoteMint: MINTS.USDC,
  deployedLamports: 1_000_000_000n,
  ...overrides,
});
