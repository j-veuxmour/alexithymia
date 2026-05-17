import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import {
  computeCurrentIL,
  hodlValueLamports,
  impermanentLossBps,
  lpValueLamports,
  projectedImpermanentLossBps,
} from '../src/il-calculator.js';

const SOL_PRICE_LAMPORTS = 1_000_000_000n; // 1 SOL/SOL
// USDC: 6 decimals. price = 0.005 SOL/USDC at deposit; 0.010 SOL/USDC at "now".
const USDC_PRICE_AT_DEPOSIT = 5_000_000n;
const USDC_PRICE_NOW = 10_000_000n;

// 1 SOL + 200 USDC initial (≈ 1 SOL + 1 SOL worth → 2 SOL deposit total).
const ONE_SOL = { amount: 1_000_000_000n, decimals: 9 };
const TWO_HUNDRED_USDC = { amount: 200_000_000n, decimals: 6 };

describe('lpValueLamports', () => {
  it('sums both legs', () => {
    const r = unwrap(
      lpValueLamports(ONE_SOL, TWO_HUNDRED_USDC, SOL_PRICE_LAMPORTS, USDC_PRICE_AT_DEPOSIT),
    );
    // 1 SOL + 200 * 0.005 = 1 + 1 SOL = 2 SOL = 2e9 lamports
    expect(r).toBe(2_000_000_000n);
  });

  it('propagates leg validation errors', () => {
    expect(
      isErr(
        lpValueLamports(
          { amount: -1n, decimals: 9 },
          TWO_HUNDRED_USDC,
          SOL_PRICE_LAMPORTS,
          USDC_PRICE_AT_DEPOSIT,
        ),
      ),
    ).toBe(true);
  });
});

describe('hodlValueLamports', () => {
  it('values the *initial* basket at *current* prices', () => {
    const r = unwrap(
      hodlValueLamports(ONE_SOL, TWO_HUNDRED_USDC, SOL_PRICE_LAMPORTS, USDC_PRICE_NOW),
    );
    // 1 SOL + 200 * 0.010 = 1 + 2 = 3 SOL
    expect(r).toBe(3_000_000_000n);
  });
});

describe('impermanentLossBps', () => {
  it('lp = hodl → 0 bps', () => {
    expect(unwrap(impermanentLossBps(1_000n, 1_000n))).toBe(0);
  });

  it('lp < hodl → negative bps (loss)', () => {
    // (900 - 1000) / 1000 * 10000 = -1000 bps
    expect(unwrap(impermanentLossBps(900n, 1_000n))).toBe(-1_000);
  });

  it('lp > hodl → positive bps', () => {
    // (1100 - 1000) / 1000 * 10000 = +1000 bps
    expect(unwrap(impermanentLossBps(1_100n, 1_000n))).toBe(1_000);
  });

  it('rejects zero or negative hodl', () => {
    expect(isErr(impermanentLossBps(100n, 0n))).toBe(true);
    expect(isErr(impermanentLossBps(100n, -1n))).toBe(true);
  });

  it('rejects negative lp value', () => {
    expect(isErr(impermanentLossBps(-1n, 100n))).toBe(true);
  });
});

describe('computeCurrentIL', () => {
  it('classic up-move scenario', () => {
    // Initial: 1 SOL + 200 USDC at 1.0/0.005 = 2 SOL total deposit.
    // After USDC doubles: DLMM rebalances toward more USDC of the now-cheaper
    // asset. We simulate that with current = 0.7 SOL + 250 USDC.
    const r = unwrap(
      computeCurrentIL({
        initialBase: ONE_SOL,
        initialQuote: TWO_HUNDRED_USDC,
        currentBase: { amount: 700_000_000n, decimals: 9 },
        currentQuote: { amount: 250_000_000n, decimals: 6 },
        currentBasePriceLamports: SOL_PRICE_LAMPORTS,
        currentQuotePriceLamports: USDC_PRICE_NOW,
      }),
    );
    // LP: 0.7 SOL + 250 * 0.010 = 0.7 + 2.5 = 3.2 SOL
    // HODL: 1 SOL + 200 * 0.010 = 1 + 2 = 3 SOL
    // IL bps = (3.2 - 3) / 3 * 10000 = 666 (floored)
    expect(r.lpValueLamports).toBe(3_200_000_000n);
    expect(r.hodlValueLamports).toBe(3_000_000_000n);
    expect(r.ilBps).toBe(666);
  });

  it('break-even when prices unchanged', () => {
    const r = unwrap(
      computeCurrentIL({
        initialBase: ONE_SOL,
        initialQuote: TWO_HUNDRED_USDC,
        currentBase: ONE_SOL,
        currentQuote: TWO_HUNDRED_USDC,
        currentBasePriceLamports: SOL_PRICE_LAMPORTS,
        currentQuotePriceLamports: USDC_PRICE_AT_DEPOSIT,
      }),
    );
    expect(r.ilBps).toBe(0);
  });
});

describe('projectedImpermanentLossBps', () => {
  it('values a hypothetical scenario the same way as current', () => {
    const r = unwrap(
      projectedImpermanentLossBps({
        initialBase: ONE_SOL,
        initialQuote: TWO_HUNDRED_USDC,
        simulatedBase: { amount: 500_000_000n, decimals: 9 },
        simulatedQuote: { amount: 300_000_000n, decimals: 6 },
        scenarioBasePriceLamports: SOL_PRICE_LAMPORTS,
        scenarioQuotePriceLamports: USDC_PRICE_NOW,
      }),
    );
    // LP: 0.5 + 3.0 = 3.5; HODL: 1 + 2 = 3; ratio = (3.5-3)/3*10000 = 1666
    expect(r.ilBps).toBe(1_666);
  });
});
