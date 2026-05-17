import { type Result, ValidationError, err, ok } from '@alexithymia/shared-errors';

declare const __solAmount: unique symbol;

/**
 * A non-negative amount of SOL denominated in lamports (1 SOL = 1e9 lamports).
 *
 * Constructed via the smart constructor, never directly. Use signed math
 * (PnL) via the Pnl value object instead — SolAmount is unsigned.
 */
export type SolAmount = bigint & { readonly [__solAmount]: 'SolAmount' };

const LAMPORTS_PER_SOL = 1_000_000_000n;
// Soft ceiling matching Solana's u64 lamport supply guard (well above 21M SOL).
const MAX_LAMPORTS = (1n << 63n) - 1n;
const ZERO = 0n as SolAmount;

const fromLamports = (lamports: bigint): Result<SolAmount, ValidationError> => {
  if (lamports < 0n) {
    return err(new ValidationError('SolAmount must be non-negative', { context: { lamports } }));
  }
  if (lamports > MAX_LAMPORTS) {
    return err(new ValidationError('SolAmount exceeds i64 range', { context: { lamports } }));
  }
  return ok(lamports as SolAmount);
};

export const SolAmount = {
  zero: ZERO,
  LAMPORTS_PER_SOL,

  /** Build from a lamport bigint. Returns Err on negative/overflow. */
  fromLamports,

  /**
   * Build from a SOL float (display unit). Rounds to nearest lamport.
   * Returns Err on non-finite or negative input.
   */
  fromSol(sol: number): Result<SolAmount, ValidationError> {
    if (!Number.isFinite(sol)) {
      return err(new ValidationError('SOL must be finite', { context: { sol } }));
    }
    if (sol < 0) {
      return err(new ValidationError('SOL must be non-negative', { context: { sol } }));
    }
    return fromLamports(BigInt(Math.round(sol * 1e9)));
  },

  /** Lossy conversion for display only. Do not reuse in math. */
  toSol(a: SolAmount): number {
    return Number(a) / 1e9;
  },

  /** Underlying lamport value as bigint. */
  toLamports(a: SolAmount): bigint {
    return a as unknown as bigint;
  },

  add(a: SolAmount, b: SolAmount): SolAmount {
    return (a + b) as SolAmount;
  },

  /** Subtract `b` from `a`. Returns Err if result would be negative. */
  sub(a: SolAmount, b: SolAmount): Result<SolAmount, ValidationError> {
    return fromLamports(a - b);
  },

  cmp(a: SolAmount, b: SolAmount): -1 | 0 | 1 {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  },

  gte(a: SolAmount, b: SolAmount): boolean {
    return a >= b;
  },

  lte(a: SolAmount, b: SolAmount): boolean {
    return a <= b;
  },

  eq(a: SolAmount, b: SolAmount): boolean {
    return a === b;
  },
};
