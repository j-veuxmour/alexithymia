import { type Result, ValidationError, err, ok } from '@alexithymia/shared-errors';
import { z } from 'zod';

declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

// ── Solana base58 patterns ────────────────────────────────────────────────
// base58 alphabet excludes 0, O, I, l. Public keys are 32 bytes → 32-44 chars
// in base58. Tx signatures are 64 bytes → 87-88 chars.
const BASE58_PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const BASE58_SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;

// ── Branded primitive types ───────────────────────────────────────────────

export type SolanaAddress = Brand<string, 'SolanaAddress'>;
export type PoolAddress = Brand<string, 'PoolAddress'>;
export type MintAddress = Brand<string, 'MintAddress'>;
export type WalletAddress = Brand<string, 'WalletAddress'>;
export type TxSignature = Brand<string, 'TxSignature'>;
export type BasisPoints = Brand<number, 'BasisPoints'>;
export type UnixMs = Brand<number, 'UnixMs'>;
export type UnixSec = Brand<number, 'UnixSec'>;

// ── zod schemas ───────────────────────────────────────────────────────────

export const SolanaAddressSchema = z.string().regex(BASE58_PUBKEY_RE, 'invalid Solana address');
export const TxSignatureSchema = z.string().regex(BASE58_SIGNATURE_RE, 'invalid tx signature');
export const BasisPointsSchema = z.number().int().min(0).max(10_000);
export const UnixMsSchema = z.number().int().nonnegative();
export const UnixSecSchema = z.number().int().nonnegative();

// ── Smart constructors ────────────────────────────────────────────────────

const fromSchema = <T>(
  schema: z.ZodType<unknown>,
  label: string,
  value: unknown,
): Result<T, ValidationError> => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    return err(
      new ValidationError(`invalid ${label}`, {
        context: { value, issues: parsed.error.issues },
      }),
    );
  }
  return ok(parsed.data as T);
};

export const SolanaAddress = {
  schema: SolanaAddressSchema,
  create: (v: string): Result<SolanaAddress, ValidationError> =>
    fromSchema<SolanaAddress>(SolanaAddressSchema, 'Solana address', v),
};

export const PoolAddress = {
  schema: SolanaAddressSchema,
  create: (v: string): Result<PoolAddress, ValidationError> =>
    fromSchema<PoolAddress>(SolanaAddressSchema, 'pool address', v),
};

export const MintAddress = {
  schema: SolanaAddressSchema,
  create: (v: string): Result<MintAddress, ValidationError> =>
    fromSchema<MintAddress>(SolanaAddressSchema, 'mint address', v),
};

export const WalletAddress = {
  schema: SolanaAddressSchema,
  create: (v: string): Result<WalletAddress, ValidationError> =>
    fromSchema<WalletAddress>(SolanaAddressSchema, 'wallet address', v),
};

export const TxSignature = {
  schema: TxSignatureSchema,
  create: (v: string): Result<TxSignature, ValidationError> =>
    fromSchema<TxSignature>(TxSignatureSchema, 'tx signature', v),
};

export const BasisPoints = {
  schema: BasisPointsSchema,
  /** Construct BasisPoints in [0, 10_000]. */
  create: (v: number): Result<BasisPoints, ValidationError> =>
    fromSchema<BasisPoints>(BasisPointsSchema, 'basis points', v),
};

export const UnixMs = {
  schema: UnixMsSchema,
  create: (v: number): Result<UnixMs, ValidationError> =>
    fromSchema<UnixMs>(UnixMsSchema, 'unix ms', v),
};

export const UnixSec = {
  schema: UnixSecSchema,
  create: (v: number): Result<UnixSec, ValidationError> =>
    fromSchema<UnixSec>(UnixSecSchema, 'unix seconds', v),
};
