import type { UnixMs } from '@alexithymia/shared-utils';

/**
 * Lamports of SOL per one whole token. Uniform price unit across the engine.
 *
 * For a token with `decimals` decimal places, the lamport value of a raw
 * amount is:  `amount * priceLamports / 10n ** BigInt(decimals)`.
 *
 * Examples:
 *   - 1 SOL @ 1 SOL  →  priceLamports = 1_000_000_000n  (1e9 lamports/whole)
 *   - 1 USDC @ 0.005 SOL → priceLamports = 5_000_000n   (5e6 lamports/whole)
 */
export type PriceLamports = bigint;

/** Raw integer token amount in native units, paired with its decimal scale. */
export interface TokenAmount {
  readonly amount: bigint;
  readonly decimals: number;
}

/** A token amount tagged with the price used to value it. */
export interface PricedAmount extends TokenAmount {
  readonly priceLamports: PriceLamports;
}

/** A single oracle observation. `confidenceLamports` is optional half-width. */
export interface OracleReading {
  readonly source: string;
  readonly priceLamports: PriceLamports;
  readonly timestamp: UnixMs;
  readonly confidenceLamports?: bigint;
}

/** Output of fee projection over a fixed interval. */
export interface FeeProjection {
  readonly earnedLamports: bigint;
  readonly periodMs: number;
  /** Realized yield over the period, in bps of cost basis. */
  readonly effectiveYieldBps: number;
}

/** Output of impermanent-loss analysis. */
export interface ILResult {
  readonly lpValueLamports: bigint;
  readonly hodlValueLamports: bigint;
  /** Signed bps. Negative = LP underperforms HODL. */
  readonly ilBps: number;
}

/** Result of a multi-source oracle reconciliation. */
export interface ReconciledPrice {
  readonly consensusLamports: PriceLamports;
  readonly usedReadings: readonly OracleReading[];
}
