/**
 * Inputs for the Kelly criterion.
 *
 *   f* = p − (1 − p) / b
 *
 * where `p` is the empirical probability of a winning trade and `b` is the
 * average win / average loss ratio (always positive).
 */
export interface KellyInputs {
  /** Probability of a winning outcome, in [0, 1]. */
  readonly winRate: number;
  /** Average win divided by average loss; strictly positive. */
  readonly winLossRatio: number;
}

/** Capital + ticket-size limits for a single allocation decision. */
export interface AllocationLimits {
  /** Unallocated capital currently available, in lamports. */
  readonly freeLamports: bigint;
  /** Hard ceiling on a single position's deploy size, in lamports. */
  readonly perPositionCapLamports: bigint;
  /** Below this size, the position is not worth opening (fee floor). */
  readonly minTicketLamports: bigint;
}

/** Which constraint produced the final size — useful for explainability. */
export type AllocationCap = 'kelly' | 'per-position-cap' | 'below-min-ticket';

export interface AllocationResult {
  /** Recommended deploy amount in lamports. `0n` ⇒ do not deploy. */
  readonly recommendedLamports: bigint;
  /** Fraction of free capital that the recommendation represents, in [0, 1]. */
  readonly fractionUsed: number;
  /** Which cap shaped the decision. */
  readonly capApplied: AllocationCap;
}

/** Pre-defined fractional Kelly multipliers. */
export const KELLY_MULTIPLIERS = {
  QUARTER: 0.25,
  HALF: 0.5,
  FULL: 1,
} as const;
