import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import {
  type CostBasisTranche,
  totalDepositValue,
  valueInLamports,
  weightedAverageCost,
} from '../src/cost-basis.js';

describe('valueInLamports', () => {
  it('values SOL: 1.5 whole SOL at 1 SOL/SOL → 1.5e9 lamports', () => {
    const r = valueInLamports({
      amount: 1_500_000_000n,
      decimals: 9,
      priceLamports: 1_000_000_000n,
    });
    expect(unwrap(r)).toBe(1_500_000_000n);
  });

  it('values USDC: 100 USDC at 0.005 SOL/USDC → 500_000 lamports', () => {
    // USDC has 6 decimals. 100 USDC = 100_000_000 raw units. price = 5e6 lamports/whole.
    const r = valueInLamports({
      amount: 100_000_000n,
      decimals: 6,
      priceLamports: 5_000_000n,
    });
    expect(unwrap(r)).toBe(500_000_000n);
  });

  it('zero amount → zero value', () => {
    const r = valueInLamports({ amount: 0n, decimals: 9, priceLamports: 1_000n });
    expect(unwrap(r)).toBe(0n);
  });

  it('zero price → zero value', () => {
    const r = valueInLamports({ amount: 1_000n, decimals: 9, priceLamports: 0n });
    expect(unwrap(r)).toBe(0n);
  });

  it('floors sub-lamport fractions', () => {
    // amount * price / divisor = 7 * 3 / 10 = 21/10 = 2 (floor)
    const r = valueInLamports({ amount: 7n, decimals: 1, priceLamports: 3n });
    expect(unwrap(r)).toBe(2n);
  });

  it('rejects negative amount', () => {
    expect(isErr(valueInLamports({ amount: -1n, decimals: 9, priceLamports: 1n }))).toBe(true);
  });

  it('rejects negative price', () => {
    expect(isErr(valueInLamports({ amount: 1n, decimals: 9, priceLamports: -1n }))).toBe(true);
  });

  it('rejects non-integer decimals', () => {
    expect(isErr(valueInLamports({ amount: 1n, decimals: 1.5, priceLamports: 1n }))).toBe(true);
  });

  it('rejects negative decimals', () => {
    expect(isErr(valueInLamports({ amount: 1n, decimals: -1, priceLamports: 1n }))).toBe(true);
  });

  it('rejects decimals over 18', () => {
    expect(isErr(valueInLamports({ amount: 1n, decimals: 19, priceLamports: 1n }))).toBe(true);
  });
});

describe('totalDepositValue', () => {
  it('returns 0 for empty', () => {
    expect(unwrap(totalDepositValue([]))).toBe(0n);
  });

  it('sums multiple entries', () => {
    const a = { amount: 1_000_000_000n, decimals: 9, priceLamports: 1_000_000_000n }; // 1 SOL
    const b = { amount: 100_000_000n, decimals: 6, priceLamports: 5_000_000n }; // 100 USDC @ 0.005
    const r = unwrap(totalDepositValue([a, b]));
    expect(r).toBe(1_000_000_000n + 500_000_000n);
  });

  it('short-circuits on first invalid entry', () => {
    const ok1 = { amount: 1n, decimals: 9, priceLamports: 1n };
    const bad = { amount: -1n, decimals: 9, priceLamports: 1n };
    expect(isErr(totalDepositValue([ok1, bad]))).toBe(true);
  });
});

describe('weightedAverageCost', () => {
  it('two equal tranches → average', () => {
    const tranches: CostBasisTranche[] = [
      { units: 100n, pricePerUnit: 10n },
      { units: 100n, pricePerUnit: 20n },
    ];
    expect(unwrap(weightedAverageCost(tranches))).toBe(15n);
  });

  it('weights by unit count', () => {
    // 10 units @ 100 + 90 units @ 10 = 1_000 + 900 = 1_900, total 100 units → avg 19
    const tranches: CostBasisTranche[] = [
      { units: 10n, pricePerUnit: 100n },
      { units: 90n, pricePerUnit: 10n },
    ];
    expect(unwrap(weightedAverageCost(tranches))).toBe(19n);
  });

  it('rejects empty input', () => {
    expect(isErr(weightedAverageCost([]))).toBe(true);
  });

  it('rejects all-zero units', () => {
    expect(isErr(weightedAverageCost([{ units: 0n, pricePerUnit: 100n }]))).toBe(true);
  });

  it('rejects negative units', () => {
    expect(isErr(weightedAverageCost([{ units: -1n, pricePerUnit: 100n }]))).toBe(true);
  });

  it('rejects negative price', () => {
    expect(isErr(weightedAverageCost([{ units: 1n, pricePerUnit: -1n }]))).toBe(true);
  });

  it('handles a single tranche', () => {
    expect(unwrap(weightedAverageCost([{ units: 50n, pricePerUnit: 7n }]))).toBe(7n);
  });
});
