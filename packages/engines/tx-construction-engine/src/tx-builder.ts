import {
  type Result,
  ValidationError,
  all,
  err,
  isErr,
  ok,
} from '@alexithymia/shared-errors';
import {
  SolanaAddress as SolanaAddressVO,
  WalletAddress as WalletAddressVO,
  type SolanaAddress,
} from '@alexithymia/shared-domain';
import type {
  AccountMetaSpec,
  ComputeBudgetSpec,
  InstructionSpec,
  TxPlan,
} from './tx-construction.types.js';

export interface BuildTxPlanInput {
  readonly payer: string;
  readonly computeBudget: {
    readonly units: number;
    readonly microLamportsPerCu: bigint;
  };
  readonly instructions: readonly {
    readonly programId: string;
    readonly accounts: readonly {
      readonly pubkey: string;
      readonly isSigner: boolean;
      readonly isWritable: boolean;
    }[];
    readonly data: Uint8Array;
  }[];
  readonly idempotencyKey?: string;
  readonly label?: string;
}

const validateComputeBudget = (
  cb: BuildTxPlanInput['computeBudget'],
): Result<ComputeBudgetSpec, ValidationError> => {
  if (!Number.isInteger(cb.units) || cb.units <= 0) {
    return err(
      new ValidationError('computeBudget.units must be a positive integer', {
        context: { units: cb.units },
      }),
    );
  }
  if (cb.microLamportsPerCu < 0n) {
    return err(
      new ValidationError('computeBudget.microLamportsPerCu must be non-negative', {
        context: { microLamportsPerCu: cb.microLamportsPerCu },
      }),
    );
  }
  return ok({ units: cb.units, microLamportsPerCu: cb.microLamportsPerCu });
};

const validateAccount = (
  acc: BuildTxPlanInput['instructions'][number]['accounts'][number],
  path: string,
): Result<AccountMetaSpec, ValidationError> => {
  const pk = SolanaAddressVO.create(acc.pubkey);
  if (!pk.ok) {
    return err(
      new ValidationError(`${path}.pubkey is not a valid Solana address`, {
        cause: pk.error,
        context: { pubkey: acc.pubkey },
      }),
    );
  }
  if (typeof acc.isSigner !== 'boolean' || typeof acc.isWritable !== 'boolean') {
    return err(
      new ValidationError(`${path} must have boolean isSigner/isWritable`, {
        context: { acc },
      }),
    );
  }
  return ok({ pubkey: pk.value, isSigner: acc.isSigner, isWritable: acc.isWritable });
};

const validateInstruction = (
  ix: BuildTxPlanInput['instructions'][number],
  index: number,
): Result<InstructionSpec, ValidationError> => {
  const path = `instructions[${index}]`;
  const programId = SolanaAddressVO.create(ix.programId);
  if (!programId.ok) {
    return err(
      new ValidationError(`${path}.programId is not a valid Solana address`, {
        cause: programId.error,
        context: { programId: ix.programId },
      }),
    );
  }
  if (!Array.isArray(ix.accounts) || ix.accounts.length === 0) {
    return err(
      new ValidationError(`${path}.accounts must be a non-empty array`, {
        context: { accounts: ix.accounts },
      }),
    );
  }
  if (!(ix.data instanceof Uint8Array)) {
    return err(
      new ValidationError(`${path}.data must be a Uint8Array`, {
        context: { dataType: typeof ix.data },
      }),
    );
  }

  const accountResults = ix.accounts.map((a, i) => validateAccount(a, `${path}.accounts[${i}]`));
  const accounts = all(accountResults);
  if (!accounts.ok) return accounts;

  return ok({ programId: programId.value, accounts: accounts.value, data: ix.data });
};

/**
 * Assemble a TxPlan from raw, externally-supplied components.
 *
 * Every field is validated through shared-domain smart constructors;
 * nothing is implicitly coerced. The output is a pure value object —
 * the engine never touches the network. Service callers feed the plan
 * to TX Submission alongside firewall results.
 *
 * On failure, returns the *first* offending validation error with
 * structured context. Multi-error aggregation is the firewall's job.
 */
export const buildTxPlan = (
  input: BuildTxPlanInput,
): Result<TxPlan, ValidationError> => {
  const payer = WalletAddressVO.create(input.payer);
  if (!payer.ok) {
    return err(
      new ValidationError('payer is not a valid wallet address', {
        cause: payer.error,
        context: { payer: input.payer },
      }),
    );
  }

  const cb = validateComputeBudget(input.computeBudget);
  if (!cb.ok) return cb;

  if (!Array.isArray(input.instructions) || input.instructions.length === 0) {
    return err(new ValidationError('instructions must be a non-empty array'));
  }

  const ixResults = input.instructions.map((ix, i) => validateInstruction(ix, i));
  for (const r of ixResults) {
    if (isErr(r)) return r;
  }
  const instructions = (ixResults as Result<InstructionSpec, ValidationError>[]).map((r) =>
    r.ok ? r.value : (null as never),
  );

  if (input.idempotencyKey !== undefined) {
    if (typeof input.idempotencyKey !== 'string' || input.idempotencyKey.length === 0) {
      return err(
        new ValidationError('idempotencyKey, when set, must be a non-empty string', {
          context: { idempotencyKey: input.idempotencyKey },
        }),
      );
    }
  }
  if (input.label !== undefined && typeof input.label !== 'string') {
    return err(new ValidationError('label, when set, must be a string'));
  }

  const plan: TxPlan = {
    payer: payer.value,
    computeBudget: cb.value,
    instructions,
    ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
    ...(input.label !== undefined ? { label: input.label } : {}),
  };
  return ok(plan);
};

/** Sum of compute units required across the plan (currently just the cap). */
export const totalComputeUnits = (plan: TxPlan): number => plan.computeBudget.units;

/** Programs touched by the plan, in first-seen order. */
export const programsTouched = (plan: TxPlan): readonly SolanaAddress[] => {
  const seen = new Set<SolanaAddress>();
  const out: SolanaAddress[] = [];
  for (const ix of plan.instructions) {
    if (!seen.has(ix.programId)) {
      seen.add(ix.programId);
      out.push(ix.programId);
    }
  }
  return out;
};
