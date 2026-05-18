import type { BinRange } from '@alexithymia/shared-domain';

// ── Canonical DLMM constants ──────────────────────────────────────────────
//
// Sourced from Meteora's @meteora-ag/dlmm SDK. These are protocol-level
// constants; changing them in the engine would silently desync from chain.

/** Number of bins held by a single on-chain bin-array account. */
export const BIN_ARRAY_SIZE = 70;

/**
 * Half-width of the default bin-array bitmap (in bin-array indexes).
 * The default bitmap covers indexes in `[-512, 511]`. Any index outside
 * this window requires an additional bitmap-extension account.
 */
export const BIN_ARRAY_BITMAP_SIZE = 512;

/**
 * Single-tx initializePosition + addLiquidity can address at most 69 bins
 * before hitting Solana's 10_240-byte inner realloc limit. Wider deploys
 * must go through the multi-tx wide-range path.
 */
export const WIDE_RANGE_THRESHOLD_BINS = 69;

// ── Branded primitives ────────────────────────────────────────────────────

declare const __binArrayIndex: unique symbol;
/** Signed integer index of an on-chain bin-array account. */
export type BinArrayIndex = number & { readonly [__binArrayIndex]: 'BinArrayIndex' };

// ── Bin-array preflight ───────────────────────────────────────────────────

export interface BinArrayPreflightInput {
  readonly binRange: BinRange;
  /**
   * Set of bin-array indexes that already exist on-chain. The caller
   * (a service) fetches this via getMultipleAccountsInfo before invoking
   * the engine — the engine performs no I/O.
   */
  readonly existingArrayIndexes: ReadonlySet<number>;
  /** True if the pool's bin-array bitmap-extension account is initialized. */
  readonly bitmapExtensionExists: boolean;
  /** Non-refundable rent charged per missing bin-array, in lamports. */
  readonly binArrayRentLamports: bigint;
  /** Non-refundable rent charged for the bitmap-extension, in lamports. */
  readonly bitmapExtensionRentLamports: bigint;
}

export interface MissingBinArray {
  readonly index: BinArrayIndex;
  /** True if this index sits outside the default bitmap window. */
  readonly requiresBitmapExtension: boolean;
}

export interface BinArrayPreflightResult {
  /** All bin-array indexes covered by the range, in ascending order. */
  readonly coveredIndexes: readonly BinArrayIndex[];
  /** Subset of `coveredIndexes` that lack an on-chain account. */
  readonly missing: readonly MissingBinArray[];
  /**
   * True if any covered index falls outside the default bitmap window
   * AND the extension account is not yet initialized.
   */
  readonly needsBitmapExtensionInit: boolean;
  /** Sum of rent that would be charged if the deploy proceeded. */
  readonly totalRentLamports: bigint;
  /** Convenience: `missing.length === 0 && !needsBitmapExtensionInit`. */
  readonly canDeployWithoutInit: boolean;
}

// ── Wide-range path ───────────────────────────────────────────────────────

export interface WideRangeChunk {
  readonly minBinId: number;
  readonly maxBinId: number;
  readonly binCount: number;
}

export interface WideRangePlanInput {
  readonly binRange: BinRange;
  /** Max bins per create-empty-position tx. SDK default is 70 (one bin array). */
  readonly maxBinsPerCreateTx: number;
  /** Max bins per addLiquidity tx. SDK default is 70 (one bin array). */
  readonly maxBinsPerAddLiquidityTx: number;
}

export interface WideRangePlan {
  readonly isWideRange: boolean;
  readonly totalBins: number;
  readonly createPositionChunks: readonly WideRangeChunk[];
  readonly addLiquidityChunks: readonly WideRangeChunk[];
}

// ── Single-side SOL deploy ────────────────────────────────────────────────

export interface SingleSideSolDeployInput {
  readonly amountXLamports: bigint;
  readonly amountYLamports: bigint;
  readonly activeBinId: number;
  readonly minBinId: number;
  readonly maxBinId: number;
  readonly binsAbove: number;
  /**
   * Optional upside coverage hint expressed as percent. Single-side SOL
   * deploys must keep this at 0 (or omit it) — the upper edge of the
   * range is always the active bin.
   */
  readonly upsidePct?: number;
}

export interface SingleSideSolDeploy {
  readonly amountYLamports: bigint;
  readonly activeBinId: number;
  readonly minBinId: number;
  readonly maxBinId: number;
  readonly binsBelow: number;
}

// ── Volatility timeframe ──────────────────────────────────────────────────

export type Timeframe =
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '2h'
  | '4h'
  | '12h'
  | '24h';

export const TIMEFRAMES: readonly Timeframe[] = [
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '12h',
  '24h',
] as const;

export const TIMEFRAME_MINUTES: Readonly<Record<Timeframe, number>> = {
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1h': 60,
  '2h': 120,
  '4h': 240,
  '12h': 720,
  '24h': 1440,
};

/**
 * Volatility is unreliable on short timeframes (price noise dominates).
 * The default floor matches Meridian's behaviour: any screening at 5m/15m
 * is up-shifted to a 30m volatility window.
 */
export const DEFAULT_MIN_VOLATILITY_TIMEFRAME: Timeframe = '30m';
