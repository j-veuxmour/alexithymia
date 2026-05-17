import type { ProjectedILInput } from '@alexithymia/engine-pricing';
import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import { checkProjectedIL, checkTvlImpact, evaluatePositionRisk } from '../src/position-risk.js';

const SOL_PRICE = 1_000_000_000n;
const USDC_PRICE = 5_000_000n;
const ONE_SOL = { amount: 1_000_000_000n, decimals: 9 };
const TWO_HUNDRED_USDC = { amount: 200_000_000n, decimals: 6 };

// LP = 0.7 SOL + 250 USDC at current prices; HODL = 1 SOL + 200 USDC.
// At SOL=1, USDC=0.005 → LP = 0.7 + 1.25 = 1.95, HODL = 1 + 1 = 2 → IL = -250 bps
const modestILScenario: ProjectedILInput = {
  initialBase: ONE_SOL,
  initialQuote: TWO_HUNDRED_USDC,
  simulatedBase: { amount: 700_000_000n, decimals: 9 },
  simulatedQuote: { amount: 250_000_000n, decimals: 6 },
  scenarioBasePriceLamports: SOL_PRICE,
  scenarioQuotePriceLamports: USDC_PRICE,
};

describe('checkProjectedIL', () => {
  it('passes when projected |IL| is within cap', () => {
    const r = unwrap(checkProjectedIL(modestILScenario, 500));
    expect(r.passed).toBe(true);
    expect(r.id).toBe('position.projected-il');
  });

  it('denies when projected |IL| exceeds cap', () => {
    const r = unwrap(checkProjectedIL(modestILScenario, 100));
    expect(r.passed).toBe(false);
  });

  it('uses absolute magnitude (rewards over HODL still gate)', () => {
    // Construct a scenario where LP outperforms HODL → positive ilBps
    const positive: ProjectedILInput = {
      initialBase: ONE_SOL,
      initialQuote: TWO_HUNDRED_USDC,
      simulatedBase: { amount: 1_500_000_000n, decimals: 9 },
      simulatedQuote: { amount: 200_000_000n, decimals: 6 },
      scenarioBasePriceLamports: SOL_PRICE,
      scenarioQuotePriceLamports: USDC_PRICE,
    };
    const r = unwrap(checkProjectedIL(positive, 100));
    expect(r.passed).toBe(false);
  });

  it('rejects invalid maxIlBps', () => {
    expect(isErr(checkProjectedIL(modestILScenario, -1))).toBe(true);
    expect(isErr(checkProjectedIL(modestILScenario, 1.5))).toBe(true);
  });

  it('propagates Err when Pricing rejects the scenario', () => {
    // hodl = 0 makes IL math undefined; Pricing returns Err which is wrapped.
    const bad: ProjectedILInput = {
      initialBase: { amount: 0n, decimals: 9 },
      initialQuote: { amount: 0n, decimals: 9 },
      simulatedBase: ONE_SOL,
      simulatedQuote: TWO_HUNDRED_USDC,
      scenarioBasePriceLamports: SOL_PRICE,
      scenarioQuotePriceLamports: USDC_PRICE,
    };
    expect(isErr(checkProjectedIL(bad, 100))).toBe(true);
  });
});

describe('checkTvlImpact', () => {
  it('passes when impact below cap', () => {
    // 100 SOL deposit into 10_000 SOL TVL → 100 bps; cap 500.
    const r = unwrap(checkTvlImpact(100_000_000_000n, 10_000_000_000_000n, 500));
    expect(r.passed).toBe(true);
  });

  it('denies when impact above cap', () => {
    // 1_000 SOL into 10_000 TVL → 1_000 bps; cap 500.
    const r = unwrap(checkTvlImpact(1_000_000_000_000n, 10_000_000_000_000n, 500));
    expect(r.passed).toBe(false);
  });

  it('rejects invalid maxImpactBps', () => {
    expect(isErr(checkTvlImpact(1n, 1n, -1))).toBe(true);
  });

  it('propagates Err when Pricing rejects the inputs (zero TVL)', () => {
    expect(isErr(checkTvlImpact(1n, 0n, 100))).toBe(true);
  });
});

describe('evaluatePositionRisk', () => {
  it('returns IL + TVL checks in order', () => {
    const r = unwrap(
      evaluatePositionRisk({
        ilScenario: modestILScenario,
        maxIlBps: 500,
        depositLamports: 100_000_000_000n,
        preDepositTvlLamports: 10_000_000_000_000n,
        maxTvlImpactBps: 500,
      }),
    );
    expect(r.map((c) => c.id)).toEqual(['position.projected-il', 'position.tvl-impact']);
  });

  it('short-circuits on IL failure', () => {
    expect(
      isErr(
        evaluatePositionRisk({
          ilScenario: modestILScenario,
          maxIlBps: -1, // invalid
          depositLamports: 1n,
          preDepositTvlLamports: 1n,
          maxTvlImpactBps: 100,
        }),
      ),
    ).toBe(true);
  });

  it('propagates TVL failure', () => {
    expect(
      isErr(
        evaluatePositionRisk({
          ilScenario: modestILScenario,
          maxIlBps: 500,
          depositLamports: 1n,
          preDepositTvlLamports: 0n,
          maxTvlImpactBps: 100,
        }),
      ),
    ).toBe(true);
  });
});
