import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import { PROGRAM_IDS } from '../src/allowed-programs.js';
import {
  buildTxPlan,
  programsTouched,
  totalComputeUnits,
  type BuildTxPlanInput,
} from '../src/tx-builder.js';

const PAYER = '4Nd1m6mGmM9pjmM1uVHEqPNzPzNzM1PPzNzM1PPzNzM1'; // 44-char base58
const ACCT = '7vRkPnukPo1eUmZ1V5cWvJ6VhxFQnPMRQjpUaTBypHJp';

const validInput = (): BuildTxPlanInput => ({
  payer: PAYER,
  computeBudget: { units: 200_000, microLamportsPerCu: 1_000n },
  instructions: [
    {
      programId: PROGRAM_IDS.METEORA_DLMM as unknown as string,
      accounts: [{ pubkey: PAYER, isSigner: true, isWritable: true }],
      data: new Uint8Array([1, 2, 3]),
    },
    {
      programId: PROGRAM_IDS.SYSTEM as unknown as string,
      accounts: [{ pubkey: ACCT, isSigner: false, isWritable: true }],
      data: new Uint8Array([0]),
    },
  ],
  idempotencyKey: 'deploy:pool1:42',
  label: 'deploy',
});

describe('buildTxPlan', () => {
  it('builds a valid plan', () => {
    const plan = unwrap(buildTxPlan(validInput()));
    expect(plan.computeBudget.units).toBe(200_000);
    expect(plan.instructions).toHaveLength(2);
    expect(plan.idempotencyKey).toBe('deploy:pool1:42');
    expect(plan.label).toBe('deploy');
  });

  it('omits optional fields when not provided', () => {
    const input = validInput();
    delete (input as { idempotencyKey?: string }).idempotencyKey;
    delete (input as { label?: string }).label;
    const plan = unwrap(buildTxPlan(input));
    expect(plan.idempotencyKey).toBeUndefined();
    expect(plan.label).toBeUndefined();
  });

  it('rejects invalid payer', () => {
    const input = validInput();
    expect(isErr(buildTxPlan({ ...input, payer: 'not-a-pubkey' }))).toBe(true);
  });

  it('rejects non-positive compute units', () => {
    const input = validInput();
    expect(
      isErr(buildTxPlan({ ...input, computeBudget: { units: 0, microLamportsPerCu: 1n } })),
    ).toBe(true);
    expect(
      isErr(buildTxPlan({ ...input, computeBudget: { units: 1.5, microLamportsPerCu: 1n } })),
    ).toBe(true);
  });

  it('rejects negative micro-lamports', () => {
    const input = validInput();
    expect(
      isErr(
        buildTxPlan({
          ...input,
          computeBudget: { units: 100, microLamportsPerCu: -1n },
        }),
      ),
    ).toBe(true);
  });

  it('rejects empty instruction list', () => {
    const input = validInput();
    expect(isErr(buildTxPlan({ ...input, instructions: [] }))).toBe(true);
  });

  it('rejects instruction with invalid programId', () => {
    const input = validInput();
    expect(
      isErr(
        buildTxPlan({
          ...input,
          instructions: [
            {
              programId: 'bogus',
              accounts: [{ pubkey: PAYER, isSigner: true, isWritable: true }],
              data: new Uint8Array(0),
            },
          ],
        }),
      ),
    ).toBe(true);
  });

  it('rejects instruction with empty accounts', () => {
    const input = validInput();
    expect(
      isErr(
        buildTxPlan({
          ...input,
          instructions: [
            {
              programId: PROGRAM_IDS.SYSTEM as unknown as string,
              accounts: [],
              data: new Uint8Array(0),
            },
          ],
        }),
      ),
    ).toBe(true);
  });

  it('rejects instruction with non-Uint8Array data', () => {
    const input = validInput();
    expect(
      isErr(
        buildTxPlan({
          ...input,
          instructions: [
            {
              programId: PROGRAM_IDS.SYSTEM as unknown as string,
              accounts: [{ pubkey: PAYER, isSigner: true, isWritable: true }],
              // biome-ignore lint/suspicious/noExplicitAny: deliberate runtime invalidation
              data: [0, 1, 2] as any,
            },
          ],
        }),
      ),
    ).toBe(true);
  });

  it('rejects instruction with invalid account pubkey', () => {
    const input = validInput();
    expect(
      isErr(
        buildTxPlan({
          ...input,
          instructions: [
            {
              programId: PROGRAM_IDS.SYSTEM as unknown as string,
              accounts: [{ pubkey: 'nope', isSigner: true, isWritable: true }],
              data: new Uint8Array(0),
            },
          ],
        }),
      ),
    ).toBe(true);
  });

  it('rejects empty idempotency key', () => {
    expect(isErr(buildTxPlan({ ...validInput(), idempotencyKey: '' }))).toBe(true);
  });

  it('rejects non-string label', () => {
    const input = validInput();
    expect(
      // biome-ignore lint/suspicious/noExplicitAny: deliberate runtime invalidation
      isErr(buildTxPlan({ ...input, label: 42 as any })),
    ).toBe(true);
  });
});

describe('totalComputeUnits / programsTouched', () => {
  it('totalComputeUnits returns the cap', () => {
    const plan = unwrap(buildTxPlan(validInput()));
    expect(totalComputeUnits(plan)).toBe(200_000);
  });
  it('programsTouched returns each program once, in first-seen order', () => {
    const plan = unwrap(buildTxPlan(validInput()));
    const programs = programsTouched(plan);
    expect(programs).toEqual([PROGRAM_IDS.METEORA_DLMM, PROGRAM_IDS.SYSTEM]);
  });
});
