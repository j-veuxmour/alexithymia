import { isErr, isOk, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import {
  defaultProgramPolicy,
  METEORA_DISCRIMINATORS,
  PROGRAM_IDS,
} from '../src/allowed-programs.js';
import { assertTxPlanInvariants } from '../src/firewall.js';
import { buildTxPlan } from '../src/tx-builder.js';
import type { FirewallLimits } from '../src/tx-construction.types.js';

// Deep-mutable input shape — tests freely tweak fields between cases.
// The readonly BuildTxPlanInput accepts mutable arrays/objects via the
// usual variance rules, so we can pass this straight into buildTxPlan.
type TestInput = {
  payer: string;
  computeBudget: { units: number; microLamportsPerCu: bigint };
  instructions: Array<{
    programId: string;
    accounts: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
    data: Uint8Array;
  }>;
  idempotencyKey?: string;
  label?: string;
};

const PAYER = '4Nd1m6mGmM9pjmM1uVHEqPNzPzNzM1PPzNzM1PPzNzM1';
const RANDOM_PROGRAM = '7vRkPnukPo1eUmZ1V5cWvJ6VhxFQnPMRQjpUaTBypHJp';

const fromHex = (hex: string): Uint8Array => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
};

const buildSystemTransferData = (lamports: bigint): Uint8Array => {
  const data = new Uint8Array(12);
  const view = new DataView(data.buffer);
  view.setUint32(0, 2, true); // Transfer discriminator
  view.setBigUint64(4, lamports, true);
  return data;
};

const limits = (overrides: Partial<FirewallLimits> = {}): FirewallLimits => ({
  maxComputeUnits: 1_400_000,
  maxMicroLamportsPerCu: 10_000_000n,
  maxSolSpendLamports: 5_000_000_000n, // 5 SOL
  requireIdempotencyKey: false,
  ...overrides,
});

const validPlanInput = (): TestInput => ({
  payer: PAYER,
  computeBudget: { units: 200_000, microLamportsPerCu: 1_000n },
  instructions: [
    {
      programId: PROGRAM_IDS.METEORA_DLMM as unknown as string,
      accounts: [{ pubkey: PAYER, isSigner: true, isWritable: true }],
      data: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
    },
  ],
  idempotencyKey: 'k',
});

describe('assertTxPlanInvariants', () => {
  it('accepts a valid plan with default policy + ample limits', () => {
    const plan = unwrap(buildTxPlan(validPlanInput()));
    const r = assertTxPlanInvariants(plan, defaultProgramPolicy(), limits());
    expect(isOk(r)).toBe(true);
  });

  it('rejects non-allowlisted program', () => {
    const input = validPlanInput();
    input.instructions[0]!.programId = RANDOM_PROGRAM;
    const plan = unwrap(buildTxPlan(input));
    const r = assertTxPlanInvariants(plan, defaultProgramPolicy(), limits());
    expect(isErr(r)).toBe(true);
    if (!r.ok) {
      expect(r.error.some((v) => v.code === 'PROGRAM_NOT_ALLOWED')).toBe(true);
    }
  });

  it('rejects forbidden Meteora initializeBinArray discriminator', () => {
    const input = validPlanInput();
    input.instructions[0]!.data = new Uint8Array([
      ...fromHex(METEORA_DISCRIMINATORS.INITIALIZE_BIN_ARRAY),
      99,
    ]);
    const plan = unwrap(buildTxPlan(input));
    const r = assertTxPlanInvariants(plan, defaultProgramPolicy(), limits());
    expect(isErr(r)).toBe(true);
    if (!r.ok) {
      expect(r.error.some((v) => v.code === 'FORBIDDEN_INSTRUCTION')).toBe(true);
    }
  });

  it('rejects oversize compute units', () => {
    const input = validPlanInput();
    input.computeBudget = { units: 2_000_000, microLamportsPerCu: 1_000n };
    const plan = unwrap(buildTxPlan(input));
    const r = assertTxPlanInvariants(plan, defaultProgramPolicy(), limits());
    expect(isErr(r)).toBe(true);
    if (!r.ok) {
      expect(r.error.some((v) => v.code === 'COMPUTE_UNITS_EXCEED_MAX')).toBe(true);
    }
  });

  it('rejects oversize priority fee', () => {
    const input = validPlanInput();
    input.computeBudget = { units: 200_000, microLamportsPerCu: 999_999_999n };
    const plan = unwrap(buildTxPlan(input));
    const r = assertTxPlanInvariants(plan, defaultProgramPolicy(), limits());
    expect(isErr(r)).toBe(true);
    if (!r.ok) {
      expect(r.error.some((v) => v.code === 'PRIORITY_FEE_EXCEEDS_MAX')).toBe(true);
    }
  });

  it('rejects when payer is not present as signer', () => {
    const input = validPlanInput();
    input.instructions[0]!.accounts = [
      { pubkey: PAYER, isSigner: false, isWritable: true },
    ];
    const plan = unwrap(buildTxPlan(input));
    const r = assertTxPlanInvariants(plan, defaultProgramPolicy(), limits());
    expect(isErr(r)).toBe(true);
    if (!r.ok) {
      expect(r.error.some((v) => v.code === 'PAYER_NOT_SIGNER')).toBe(true);
    }
  });

  it('requires idempotency key when limits demand it', () => {
    const input = validPlanInput();
    delete (input as { idempotencyKey?: string }).idempotencyKey;
    const plan = unwrap(buildTxPlan(input));
    const r = assertTxPlanInvariants(
      plan,
      defaultProgramPolicy(),
      limits({ requireIdempotencyKey: true }),
    );
    expect(isErr(r)).toBe(true);
    if (!r.ok) {
      expect(r.error.some((v) => v.code === 'IDEMPOTENCY_KEY_REQUIRED')).toBe(true);
    }
  });

  it('caps total System.Transfer lamports', () => {
    const input = validPlanInput();
    input.instructions = [
      input.instructions[0]!,
      {
        programId: PROGRAM_IDS.SYSTEM as unknown as string,
        accounts: [{ pubkey: PAYER, isSigner: true, isWritable: true }],
        data: buildSystemTransferData(6_000_000_000n), // 6 SOL > 5 SOL cap
      },
    ];
    const plan = unwrap(buildTxPlan(input));
    const r = assertTxPlanInvariants(plan, defaultProgramPolicy(), limits());
    expect(isErr(r)).toBe(true);
    if (!r.ok) {
      expect(r.error.some((v) => v.code === 'SOL_SPEND_EXCEEDS_MAX')).toBe(true);
    }
  });

  it('sums multiple System.Transfer instructions', () => {
    const input = validPlanInput();
    input.instructions = [
      input.instructions[0]!,
      {
        programId: PROGRAM_IDS.SYSTEM as unknown as string,
        accounts: [{ pubkey: PAYER, isSigner: true, isWritable: true }],
        data: buildSystemTransferData(3_000_000_000n),
      },
      {
        programId: PROGRAM_IDS.SYSTEM as unknown as string,
        accounts: [{ pubkey: PAYER, isSigner: true, isWritable: true }],
        data: buildSystemTransferData(3_000_000_000n),
      },
    ];
    const plan = unwrap(buildTxPlan(input));
    const r = assertTxPlanInvariants(plan, defaultProgramPolicy(), limits());
    expect(isErr(r)).toBe(true);
    if (!r.ok) {
      expect(r.error.some((v) => v.code === 'SOL_SPEND_EXCEEDS_MAX')).toBe(true);
    }
  });

  it('ignores non-Transfer System instructions when summing spend', () => {
    const input = validPlanInput();
    input.instructions = [
      input.instructions[0]!,
      {
        programId: PROGRAM_IDS.SYSTEM as unknown as string,
        accounts: [{ pubkey: PAYER, isSigner: true, isWritable: true }],
        data: new Uint8Array([1, 0, 0, 0]), // Allocate discriminator, not Transfer
      },
    ];
    const plan = unwrap(buildTxPlan(input));
    const r = assertTxPlanInvariants(plan, defaultProgramPolicy(), limits());
    expect(isOk(r)).toBe(true);
  });

  it('aggregates all violations in a single pass', () => {
    const input = validPlanInput();
    input.instructions[0]!.programId = RANDOM_PROGRAM;
    input.computeBudget = { units: 9_999_999, microLamportsPerCu: 999_999_999n };
    delete (input as { idempotencyKey?: string }).idempotencyKey;
    const plan = unwrap(buildTxPlan(input));
    const r = assertTxPlanInvariants(
      plan,
      defaultProgramPolicy(),
      limits({ requireIdempotencyKey: true }),
    );
    expect(isErr(r)).toBe(true);
    if (!r.ok) {
      const codes = r.error.map((v) => v.code);
      expect(codes).toContain('PROGRAM_NOT_ALLOWED');
      expect(codes).toContain('COMPUTE_UNITS_EXCEED_MAX');
      expect(codes).toContain('PRIORITY_FEE_EXCEEDS_MAX');
      expect(codes).toContain('IDEMPOTENCY_KEY_REQUIRED');
    }
  });
});
