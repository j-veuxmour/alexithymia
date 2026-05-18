import { type Result, err, ok } from '@alexithymia/shared-errors';
import {
  isForbiddenIxDiscriminator,
  isProgramAllowed,
  leadingDiscriminatorHex,
  PROGRAM_IDS,
} from './allowed-programs.js';
import type {
  FirewallLimits,
  FirewallViolation,
  ProgramPolicy,
  TxPlan,
} from './tx-construction.types.js';

// System Program transfer instruction layout:
//   - 4-byte little-endian discriminator (Transfer = 2)
//   - 8-byte little-endian u64 lamports
// (See solana_sdk::system_instruction::Transfer.)
const SYSTEM_TRANSFER_DISCRIMINATOR = 2;

const tryDecodeSystemTransferLamports = (data: Uint8Array): bigint | null => {
  if (data.length < 12) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const disc = view.getUint32(0, true);
  if (disc !== SYSTEM_TRANSFER_DISCRIMINATOR) return null;
  return view.getBigUint64(4, true);
};

/**
 * Evaluate every firewall rule on a tx plan and return *all* violations.
 *
 * Rules:
 *   1. Each instruction's programId must be in `policy.allowedPrograms`.
 *   2. No instruction may carry a forbidden discriminator for its program.
 *   3. Compute-unit cap ≤ `limits.maxComputeUnits`.
 *   4. Priority fee ≤ `limits.maxMicroLamportsPerCu`.
 *   5. Sum of System.Transfer lamports ≤ `limits.maxSolSpendLamports`.
 *   6. Payer must appear as a signer in some instruction account.
 *   7. If `limits.requireIdempotencyKey`, plan must carry one.
 *
 * Returns `Err` with the aggregated violation list when any rule trips;
 * `Ok(plan)` otherwise. The plan is returned unchanged on success — the
 * firewall never mutates.
 */
export const assertTxPlanInvariants = (
  plan: TxPlan,
  policy: ProgramPolicy,
  limits: FirewallLimits,
): Result<TxPlan, readonly FirewallViolation[]> => {
  const violations: FirewallViolation[] = [];

  // 1 + 2: program allowlist + forbidden discriminators.
  for (let i = 0; i < plan.instructions.length; i += 1) {
    const ix = plan.instructions[i]!;
    if (!isProgramAllowed(policy, ix.programId)) {
      violations.push({
        code: 'PROGRAM_NOT_ALLOWED',
        message: `instruction[${i}] uses non-allowlisted program`,
        context: { index: i, programId: ix.programId },
      });
      continue;
    }
    if (isForbiddenIxDiscriminator(policy, ix.programId, ix.data)) {
      violations.push({
        code: 'FORBIDDEN_INSTRUCTION',
        message: `instruction[${i}] uses a forbidden discriminator for its program`,
        context: {
          index: i,
          programId: ix.programId,
          discriminator: leadingDiscriminatorHex(ix.data),
        },
      });
    }
  }

  // 3: compute-unit cap.
  if (plan.computeBudget.units > limits.maxComputeUnits) {
    violations.push({
      code: 'COMPUTE_UNITS_EXCEED_MAX',
      message: 'compute budget exceeds firewall cap',
      context: { units: plan.computeBudget.units, max: limits.maxComputeUnits },
    });
  }

  // 4: priority fee cap.
  if (plan.computeBudget.microLamportsPerCu > limits.maxMicroLamportsPerCu) {
    violations.push({
      code: 'PRIORITY_FEE_EXCEEDS_MAX',
      message: 'priority-fee bid exceeds firewall cap',
      context: {
        microLamportsPerCu: plan.computeBudget.microLamportsPerCu,
        max: limits.maxMicroLamportsPerCu,
      },
    });
  }

  // 5: System Program transfer total.
  let solSpend = 0n;
  for (const ix of plan.instructions) {
    if (ix.programId === PROGRAM_IDS.SYSTEM) {
      const lamports = tryDecodeSystemTransferLamports(ix.data);
      if (lamports !== null) solSpend += lamports;
    }
  }
  if (solSpend > limits.maxSolSpendLamports) {
    violations.push({
      code: 'SOL_SPEND_EXCEEDS_MAX',
      message: 'sum of System.Transfer lamports exceeds firewall cap',
      context: { solSpendLamports: solSpend, max: limits.maxSolSpendLamports },
    });
  }

  // 6: payer must sign at least one instruction.
  // `payer` is a WalletAddress brand, `pubkey` is a SolanaAddress brand —
  // both wrap the same base58 string. Compare the underlying string.
  const payerStr = plan.payer as unknown as string;
  const payerSigns = plan.instructions.some((ix) =>
    ix.accounts.some((a) => (a.pubkey as unknown as string) === payerStr && a.isSigner),
  );
  if (!payerSigns) {
    violations.push({
      code: 'PAYER_NOT_SIGNER',
      message: 'payer must appear as a signer in at least one instruction account',
      context: { payer: plan.payer },
    });
  }

  // 7: idempotency requirement.
  if (
    limits.requireIdempotencyKey &&
    (plan.idempotencyKey === undefined || plan.idempotencyKey === '')
  ) {
    violations.push({
      code: 'IDEMPOTENCY_KEY_REQUIRED',
      message: 'firewall requires an idempotency key on this plan',
    });
  }

  if (violations.length > 0) return err(violations);
  return ok(plan);
};
