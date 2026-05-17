import type { MintAddress } from '@alexithymia/shared-domain';

/** Caller-normalized signal value in [0, 1], paired with its weight. */
export interface WeightedSignal {
  readonly name: string;
  /** Value in [0, 1] — caller pre-normalizes from raw domain units. */
  readonly value: number;
  /** Non-negative weight; caller need not pre-normalize (sum may exceed 1). */
  readonly weight: number;
}

export interface CandidateScore {
  /** Weighted average of input signal values, in [0, 1]. */
  readonly compositeScore: number;
  /** Per-signal contribution to the composite (value · weight / Σweight). */
  readonly breakdown: Readonly<Record<string, number>>;
}

/** A Beta-distributed multi-armed bandit arm. α, β > 0. */
export interface BetaArm {
  readonly id: string;
  readonly alpha: number;
  readonly beta: number;
}

/** Random number generator returning a uniform sample in [0, 1). */
export type RNG = () => number;

export type NarrativeClass = 'memecoin' | 'ai-agent' | 'gaming' | 'defi' | 'rwa' | 'unknown';

export interface NarrativeInput {
  readonly name?: string | undefined;
  readonly symbol?: string | undefined;
  readonly description?: string | undefined;
}

export interface NarrativeClassification {
  readonly class: NarrativeClass;
  /** Confidence in [0, 1]; higher = more distinct match. */
  readonly confidence: number;
  /** Lowercased keywords that triggered the classification. */
  readonly matchedKeywords: readonly string[];
}

export type RegimeLabel = 'risk-on' | 'risk-off' | 'transitional';

export interface RegimeFeatures {
  /** Realized volatility over recent window, bps of price. */
  readonly volatilityBps: number;
  /** Trend strength: signed bps return over recent window. */
  readonly trendBps: number;
  /** Cross-market breadth: bps of pairs advancing on the day, in [0, 10000]. */
  readonly breadthBps: number;
}

export interface RegimeThresholds {
  readonly highVolBps: number;
  readonly bullishTrendBps: number;
  readonly bearishTrendBps: number;
  readonly bullBreadthBps: number;
  readonly bearBreadthBps: number;
}

export interface RegimeResult {
  readonly regime: RegimeLabel;
  readonly reasons: readonly string[];
}

/** Generic hard-filter result with explanation. */
export interface HardFilterResult {
  readonly passed: boolean;
  readonly reason: string;
  readonly context: Readonly<Record<string, unknown>>;
}

export type HardFilter<T> = (input: T) => HardFilterResult;

/** Canonical input shape consumed by the built-in hard-filter library. */
export interface CandidateFeatures {
  readonly tvlLamports: bigint;
  readonly ageMs: number;
  readonly mintAuthorityRenounced: boolean;
  readonly freezeAuthorityRenounced: boolean;
  readonly baseMint: MintAddress;
  readonly volume24hLamports: bigint;
}
