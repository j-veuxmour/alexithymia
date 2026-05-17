import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import { dilutionBps, shareAfterDepositBps, tvlImpactBps } from '../src/tvl-impact.js';

describe('shareAfterDepositBps', () => {
  it('depositing equal to TVL yields 50 %', () => {
    expect(unwrap(shareAfterDepositBps(1_000n, 1_000n))).toBe(5_000);
  });

  it('depositing 1 % of post-pool TVL yields 100 bps', () => {
    // deposit = 1, post-pool = 100 → 1 / 100 * 10000 = 100 bps
    expect(unwrap(shareAfterDepositBps(1n, 99n))).toBe(100);
  });

  it('depositing into an empty pool → 100 %', () => {
    expect(unwrap(shareAfterDepositBps(1_000n, 0n))).toBe(10_000);
  });

  it('rejects zero deposit and zero TVL together', () => {
    expect(isErr(shareAfterDepositBps(0n, 0n))).toBe(true);
  });

  it('rejects negative inputs', () => {
    expect(isErr(shareAfterDepositBps(-1n, 100n))).toBe(true);
    expect(isErr(shareAfterDepositBps(1n, -1n))).toBe(true);
  });
});

describe('tvlImpactBps', () => {
  it('100 SOL deposit into 1_000 SOL TVL → 1_000 bps (10 %)', () => {
    expect(unwrap(tvlImpactBps(100n, 1_000n))).toBe(1_000);
  });

  it('can exceed 10_000 bps when deposit dwarfs TVL', () => {
    expect(unwrap(tvlImpactBps(2_000n, 1_000n))).toBe(20_000);
  });

  it('rejects zero TVL', () => {
    expect(isErr(tvlImpactBps(100n, 0n))).toBe(true);
  });

  it('rejects negative inputs', () => {
    expect(isErr(tvlImpactBps(-1n, 100n))).toBe(true);
    expect(isErr(tvlImpactBps(1n, -1n))).toBe(true);
  });
});

describe('dilutionBps', () => {
  it('depositing equal to TVL halves all existing shares', () => {
    // Existing share = 4_000 bps. After equal new deposit:
    //   newShare = 4_000 * 1_000 / 2_000 = 2_000  →  dilution = 2_000.
    expect(unwrap(dilutionBps(4_000, 1_000n, 1_000n))).toBe(2_000);
  });

  it('zero new deposit → zero dilution', () => {
    expect(unwrap(dilutionBps(5_000, 0n, 1_000n))).toBe(0);
  });

  it('rejects out-of-range existing share', () => {
    expect(isErr(dilutionBps(10_001, 100n, 100n))).toBe(true);
    expect(isErr(dilutionBps(-1, 100n, 100n))).toBe(true);
    expect(isErr(dilutionBps(1.5, 100n, 100n))).toBe(true);
  });

  it('rejects zero TVL', () => {
    expect(isErr(dilutionBps(1_000, 100n, 0n))).toBe(true);
  });

  it('rejects negative deposit', () => {
    expect(isErr(dilutionBps(1_000, -1n, 100n))).toBe(true);
  });
});
