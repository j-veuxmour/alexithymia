import type { SolanaAddress, UnixMs, WalletAddress } from '@alexithymia/shared-domain';

// ── Instruction & transaction plan ────────────────────────────────────────
//
// The engine deliberately defines plain-data types instead of importing
// `@solana/web3.js`. Services convert these plans into web3.js objects
// at the I/O boundary.

export interface AccountMetaSpec {
  readonly pubkey: SolanaAddress;
  readonly isSigner: boolean;
  readonly isWritable: boolean;
}

export interface InstructionSpec {
  readonly programId: SolanaAddress;
  readonly accounts: readonly AccountMetaSpec[];
  /**
   * Raw instruction data. The first 8 bytes (when present) are typically
   * the Anchor discriminator — the firewall decodes them as hex and
   * matches against {@link ProgramPolicy.forbiddenIxDiscriminators}.
   */
  readonly data: Uint8Array;
}

export interface ComputeBudgetSpec {
  /** Compute-unit ceiling for this transaction. */
  readonly units: number;
  /** Priority-fee bid expressed as micro-lamports per CU. */
  readonly microLamportsPerCu: bigint;
}

export interface TxPlan {
  readonly payer: WalletAddress;
  readonly computeBudget: ComputeBudgetSpec;
  readonly instructions: readonly InstructionSpec[];
  readonly idempotencyKey?: string;
  readonly label?: string;
}

// ── Priority fee math ─────────────────────────────────────────────────────

export interface PriorityFeeSample {
  /** Observed bid expressed in micro-lamports per compute unit. */
  readonly microLamportsPerCu: bigint;
  readonly timestamp: UnixMs;
}

export interface PriorityFeeRecommendation {
  readonly microLamportsPerCu: bigint;
  /** Percentile (0..100) chosen from the sample set. */
  readonly percentile: number;
  /** Multiplier applied above the percentile, in bps (10_000 = 1.0x). */
  readonly multiplierBps: number;
  readonly cappedByMax: boolean;
  readonly source: 'samples' | 'fallback';
}

// ── Firewall ──────────────────────────────────────────────────────────────

export type FirewallViolationCode =
  | 'PROGRAM_NOT_ALLOWED'
  | 'FORBIDDEN_INSTRUCTION'
  | 'COMPUTE_UNITS_EXCEED_MAX'
  | 'PRIORITY_FEE_EXCEEDS_MAX'
  | 'PAYER_NOT_SIGNER'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'SOL_SPEND_EXCEEDS_MAX';

export interface FirewallViolation {
  readonly code: FirewallViolationCode;
  readonly message: string;
  readonly context?: Record<string, unknown>;
}

export interface ProgramPolicy {
  /** Whitelist of program ids permitted to appear in instructions. */
  readonly allowedPrograms: ReadonlySet<SolanaAddress>;
  /**
   * Per-program set of forbidden 8-byte instruction discriminators, hex
   * encoded (lower-case, no separators). When an instruction's leading
   * 8 bytes match, the firewall rejects the plan.
   */
  readonly forbiddenIxDiscriminators: ReadonlyMap<SolanaAddress, ReadonlySet<string>>;
}

export interface FirewallLimits {
  readonly maxComputeUnits: number;
  readonly maxMicroLamportsPerCu: bigint;
  /**
   * Upper bound on lamports moved via System Program `Transfer`
   * instructions. Other lamport flows are out of scope here.
   */
  readonly maxSolSpendLamports: bigint;
  /** When true, plans without an idempotencyKey are rejected. */
  readonly requireIdempotencyKey: boolean;
}
