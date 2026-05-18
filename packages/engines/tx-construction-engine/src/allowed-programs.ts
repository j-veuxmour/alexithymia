import { type Result, ValidationError, unwrap } from '@alexithymia/shared-errors';
import { type SolanaAddress, SolanaAddress as SolanaAddressVO } from '@alexithymia/shared-domain';
import type { ProgramPolicy } from './tx-construction.types.js';

const must = (raw: string): SolanaAddress => {
  const r: Result<SolanaAddress, ValidationError> = SolanaAddressVO.create(raw);
  return unwrap(r);
};

// ── Canonical program ids ──────────────────────────────────────────────────
//
// Strings are the on-chain Pubkeys; validated to SolanaAddress at module
// load time so any typo surfaces immediately on import.

export const PROGRAM_IDS = {
  SYSTEM: must('11111111111111111111111111111111'),
  TOKEN: must('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
  TOKEN_2022: must('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'),
  ASSOCIATED_TOKEN: must('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
  COMPUTE_BUDGET: must('ComputeBudget111111111111111111111111111111'),
  MEMO: must('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
  METEORA_DLMM: must('LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo'),
  JUPITER_V6: must('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'),
} as const;

// ── Forbidden DLMM instructions ────────────────────────────────────────────
//
// Both ix create pool-level on-chain state and charge non-refundable rent.
// The agent should never deploy into a range that requires either —
// preflight is the contract. Discriminator bytes ported from Meridian
// `tools/dlmm.js` (METEORA_INIT_BIN_ARRAY_DISCRIMINATOR et al.).

const toHex = (bytes: readonly number[]): string =>
  bytes.map((b) => b.toString(16).padStart(2, '0')).join('');

export const METEORA_DISCRIMINATORS = {
  INITIALIZE_BIN_ARRAY: toHex([35, 86, 19, 185, 78, 212, 75, 211]),
  INITIALIZE_BIN_ARRAY_BITMAP_EXTENSION: toHex([47, 157, 226, 180, 12, 240, 33, 71]),
} as const;

/**
 * Default program-policy used by the firewall when the caller does not
 * supply one. Conservative whitelist with explicit blocks for the two
 * Meteora ix that would mint non-refundable rent.
 */
export const defaultProgramPolicy = (): ProgramPolicy => {
  const allowed = new Set<SolanaAddress>([
    PROGRAM_IDS.SYSTEM,
    PROGRAM_IDS.TOKEN,
    PROGRAM_IDS.TOKEN_2022,
    PROGRAM_IDS.ASSOCIATED_TOKEN,
    PROGRAM_IDS.COMPUTE_BUDGET,
    PROGRAM_IDS.MEMO,
    PROGRAM_IDS.METEORA_DLMM,
    PROGRAM_IDS.JUPITER_V6,
  ]);
  const forbidden = new Map<SolanaAddress, ReadonlySet<string>>();
  forbidden.set(
    PROGRAM_IDS.METEORA_DLMM,
    new Set([
      METEORA_DISCRIMINATORS.INITIALIZE_BIN_ARRAY,
      METEORA_DISCRIMINATORS.INITIALIZE_BIN_ARRAY_BITMAP_EXTENSION,
    ]),
  );
  return {
    allowedPrograms: allowed,
    forbiddenIxDiscriminators: forbidden,
  };
};

/** True if `programId` is permitted by `policy`. */
export const isProgramAllowed = (
  policy: ProgramPolicy,
  programId: SolanaAddress,
): boolean => policy.allowedPrograms.has(programId);

const HEX = '0123456789abcdef';

/** Lower-case hex of the first up-to-8 bytes of `data`, no separators. */
export const leadingDiscriminatorHex = (data: Uint8Array): string => {
  const n = Math.min(data.length, 8);
  let out = '';
  for (let i = 0; i < n; i += 1) {
    const b = data[i] as number;
    out += HEX[(b >> 4) & 0xf];
    out += HEX[b & 0xf];
  }
  return out;
};

/** True if `data` starts with one of `programId`'s forbidden discriminators. */
export const isForbiddenIxDiscriminator = (
  policy: ProgramPolicy,
  programId: SolanaAddress,
  data: Uint8Array,
): boolean => {
  const set = policy.forbiddenIxDiscriminators.get(programId);
  if (!set || set.size === 0) return false;
  if (data.length < 8) return false;
  return set.has(leadingDiscriminatorHex(data));
};
