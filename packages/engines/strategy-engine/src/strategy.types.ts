/**
 * Distribution shape of liquidity across a DLMM bin range.
 *
 *   spot    — uniform allocation across all bins in the range.
 *   bid-ask — barbell: concentrated at the range edges.
 *   curve   — Gaussian-like: concentrated near the active bin.
 *   mixed   — composite shape via multi-step deploy + add-liquidity.
 *   any     — shape is a management-policy detail; engine doesn't impose.
 */
export type StrategyShape = 'spot' | 'bid-ask' | 'curve' | 'mixed' | 'any';

/**
 * Directional bias of the position, expressed as the SOL/token tilt at
 * deploy time. `single-side-sol` means only SOL is provided; bins below
 * the active bin will be filled with the token as price falls.
 */
export type StrategyBias = 'token-heavy' | 'sol-heavy' | 'balanced' | 'single-side-sol';

/**
 * Lifecycle policy attached to the preset. The engine emits this so the
 * Portfolio Manager agent knows how to manage the position post-deploy
 * — re-seed, harvest, compound, or just hold.
 *
 *   none      — close on out-of-range, no special management.
 *   re-seed   — after OOR-down, redeploy single-side at new lower price.
 *   compound  — when unclaimed fees exceed a threshold, claim + re-add.
 *   partial-harvest — at TP threshold, withdraw a portion, keep the rest.
 *   composite — multi-layer position; manage as a single composite.
 */
export type LifecyclePolicy =
  | 'none'
  | 're-seed'
  | 'compound'
  | 'partial-harvest'
  | 'composite';

/** Locally-mirrored regime label. Duplicated from signal-engine on purpose
 *  to keep engines from cross-importing. The caller (agent) reconciles
 *  the labels across engines. */
export type RegimeLabel = 'risk-on' | 'risk-off' | 'transitional';

/** Locally-mirrored narrative class. Same reasoning as `RegimeLabel`. */
export type NarrativeClass =
  | 'memecoin'
  | 'ai-agent'
  | 'gaming'
  | 'defi'
  | 'rwa'
  | 'unknown';

/**
 * A named, deterministic deploy preset. Holds the parameters the rest of
 * the engine needs to translate a market view into a concrete position.
 */
export interface StrategyPreset {
  readonly id: string;
  readonly name: string;
  readonly shape: StrategyShape;
  readonly bias: StrategyBias;
  readonly lifecycle: LifecyclePolicy;
  /** Suggested fraction of the range placed below the active bin, in bps
   *  of total range width. 10_000 ⇒ entirely below (single-side SOL). */
  readonly binsBelowPctBps: number;
  /** Default slippage cap for swaps this strategy triggers, in bps. */
  readonly slippageBpsCap: number;
  readonly bestFor: string;
  readonly notes: string;
}

/**
 * Linear interpolation policy used by range-calculator. The volatilityScale
 * is the volatility value (bps or unit-less, depending on caller) at which
 * the maximum bin count is reached.
 */
export interface RangePolicy {
  readonly minBinsBelow: number;
  readonly maxBinsBelow: number;
  readonly minBinsAbove: number;
  readonly maxBinsAbove: number;
  /** Volatility value at which max bin counts are reached. > 0. */
  readonly volatilityScale: number;
}

export interface RangeInputs {
  /** Pool/timeframe volatility metric, non-negative finite. */
  readonly volatility: number;
  readonly policy: RangePolicy;
}

/**
 * Bin-count budget before being placed against an active bin.
 * `binsBelow + binsAbove + 1` (the active bin) is the total width.
 */
export interface RangeBudget {
  readonly binsBelow: number;
  readonly binsAbove: number;
}

/**
 * Concrete bin range with metadata about how it was constructed.
 * `requiresWideRangePath` flags ranges that exceed Meteora's standard
 * 69-bin width — those need the chunked deploy path in DLMM Engine.
 */
export interface BinSelection {
  readonly lower: number;
  readonly upper: number;
  readonly width: number;
  readonly requiresWideRangePath: boolean;
  /** Set when the requested range was clamped to bin-id domain bounds. */
  readonly clampedBy: 'min' | 'max' | 'none';
}

/** Inputs to the rule-based strategy selector. */
export interface StrategySelectionInputs {
  readonly regime: RegimeLabel;
  /** Non-negative finite, same scale as the regime detector's volatility. */
  readonly volatility: number;
  readonly narrative?: NarrativeClass | undefined;
}

/** Pool depth + trade size; the price-impact component of slippage. */
export interface SlippageInputs {
  /** Pool TVL or one-sided depth, in lamports. > 0. */
  readonly depthLamports: bigint;
  /** Lamports the strategy plans to swap. Non-negative. */
  readonly tradeSizeLamports: bigint;
  /** Volatility in bps; non-negative finite. */
  readonly volatilityBps: number;
  /** Optional cap from the active preset; bypassed when undefined. */
  readonly presetSlippageBpsCap?: number | undefined;
}

/** Reports which component shaped the final slippage recommendation. */
export type SlippageDriver = 'volatility' | 'depth-impact' | 'preset-cap';

export interface SlippageResult {
  readonly recommendedBps: number;
  readonly volComponentBps: number;
  readonly impactBps: number;
  readonly cappedBy: SlippageDriver;
}

/** Meteora's narrow-range bin-width ceiling. Above this, deploys must
 *  use the wide-range chunked path in DLMM Engine. */
export const DLMM_NARROW_RANGE_MAX_WIDTH = 69;

/** Volatility multiplier used in the slippage calculator. Calibrated so
 *  that 400 bps realized vol contributes 200 bps to the slippage budget
 *  before depth impact is considered. */
export const SLIPPAGE_VOLATILITY_FACTOR = 0.5;
