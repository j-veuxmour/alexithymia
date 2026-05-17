import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import {
  checkDailyLossCap,
  checkDrawdown,
  checkMaxExposure,
  evaluatePortfolioRisk,
} from '../src/portfolio-risk.js';
import { makeBudget, makeState } from './_fixtures.js';

describe('checkDrawdown', () => {
  it('passes when drawdown is below the cap', () => {
    // peak 100, current 95 → 500 bps drawdown; cap 2000.
    const r = unwrap(
      checkDrawdown(
        makeState({ peakEquityLamports: 100_000_000_000n, totalEquityLamports: 95_000_000_000n }),
        makeBudget(),
      ),
    );
    expect(r.passed).toBe(true);
    expect(r.id).toBe('portfolio.drawdown');
  });

  it('denies when drawdown exceeds the cap', () => {
    // peak 100, current 70 → 3000 bps drawdown; cap 2000.
    const r = unwrap(
      checkDrawdown(
        makeState({ peakEquityLamports: 100_000_000_000n, totalEquityLamports: 70_000_000_000n }),
        makeBudget(),
      ),
    );
    expect(r.passed).toBe(false);
    expect(r.context.ddBps).toBe(3_000);
  });

  it('passes trivially when peak equity is zero (cold start)', () => {
    const r = unwrap(
      checkDrawdown(makeState({ peakEquityLamports: 0n, totalEquityLamports: 0n }), makeBudget()),
    );
    expect(r.passed).toBe(true);
  });

  it('clamps drop at zero when current exceeds peak', () => {
    // current > peak (rare; happens before peak update). dd = 0.
    const r = unwrap(
      checkDrawdown(
        makeState({ peakEquityLamports: 50_000_000_000n, totalEquityLamports: 60_000_000_000n }),
        makeBudget(),
      ),
    );
    expect(r.passed).toBe(true);
    expect(r.context.ddBps).toBe(0);
  });

  it('rejects negative equity', () => {
    expect(isErr(checkDrawdown(makeState({ totalEquityLamports: -1n }), makeBudget()))).toBe(true);
  });

  it('rejects negative peak', () => {
    expect(isErr(checkDrawdown(makeState({ peakEquityLamports: -1n }), makeBudget()))).toBe(true);
  });

  it('rejects invalid maxDrawdownBps', () => {
    expect(isErr(checkDrawdown(makeState(), makeBudget({ maxDrawdownBps: 10_001 })))).toBe(true);
  });
});

describe('checkDailyLossCap', () => {
  it('passes when realized loss is below the cap', () => {
    const r = unwrap(
      checkDailyLossCap(makeState({ realizedDailyPnlLamports: -1_000_000_000n }), makeBudget()),
    );
    expect(r.passed).toBe(true);
  });

  it('denies when realized loss exceeds the cap', () => {
    const r = unwrap(
      checkDailyLossCap(
        makeState({ realizedDailyPnlLamports: -6_000_000_000n }),
        makeBudget(), // cap 5e9
      ),
    );
    expect(r.passed).toBe(false);
    expect(r.context.dailyLossLamports).toBe(6_000_000_000n);
  });

  it('passes when there is a profit on the day', () => {
    const r = unwrap(
      checkDailyLossCap(makeState({ realizedDailyPnlLamports: 2_000_000_000n }), makeBudget()),
    );
    expect(r.passed).toBe(true);
    expect(r.context.dailyLossLamports).toBe(0n);
  });

  it('rejects negative cap', () => {
    expect(isErr(checkDailyLossCap(makeState(), makeBudget({ dailyLossCapLamports: -1n })))).toBe(
      true,
    );
  });
});

describe('checkMaxExposure', () => {
  it('passes when projected exposure is below the cap', () => {
    // equity 100, deployed 30, candidate 20 → 50; cap = 100 * 0.6 = 60.
    const r = unwrap(
      checkMaxExposure(
        makeState({ totalEquityLamports: 100n, deployedLamports: 30n }),
        20n,
        makeBudget(),
      ),
    );
    expect(r.passed).toBe(true);
  });

  it('denies when projected exposure exceeds the cap', () => {
    // equity 100, deployed 30, candidate 40 → 70 > cap 60.
    const r = unwrap(
      checkMaxExposure(
        makeState({ totalEquityLamports: 100n, deployedLamports: 30n }),
        40n,
        makeBudget(),
      ),
    );
    expect(r.passed).toBe(false);
  });

  it('passes at exactly the cap', () => {
    const r = unwrap(
      checkMaxExposure(
        makeState({ totalEquityLamports: 100n, deployedLamports: 30n }),
        30n,
        makeBudget(),
      ),
    );
    expect(r.passed).toBe(true);
  });

  it('zero equity denies any positive candidate', () => {
    const r = unwrap(
      checkMaxExposure(
        makeState({ totalEquityLamports: 0n, deployedLamports: 0n }),
        1n,
        makeBudget(),
      ),
    );
    expect(r.passed).toBe(false);
  });

  it('zero equity passes a zero candidate', () => {
    const r = unwrap(
      checkMaxExposure(
        makeState({ totalEquityLamports: 0n, deployedLamports: 0n }),
        0n,
        makeBudget(),
      ),
    );
    expect(r.passed).toBe(true);
  });

  it('rejects negative candidate, deployed, equity, or invalid bps', () => {
    expect(isErr(checkMaxExposure(makeState({ totalEquityLamports: -1n }), 1n, makeBudget()))).toBe(
      true,
    );
    expect(isErr(checkMaxExposure(makeState({ deployedLamports: -1n }), 1n, makeBudget()))).toBe(
      true,
    );
    expect(isErr(checkMaxExposure(makeState(), -1n, makeBudget()))).toBe(true);
    expect(isErr(checkMaxExposure(makeState(), 1n, makeBudget({ maxExposureBps: 10_001 })))).toBe(
      true,
    );
  });
});

describe('evaluatePortfolioRisk', () => {
  it('returns all three checks in declaration order', () => {
    const r = unwrap(evaluatePortfolioRisk(makeState(), 1_000_000_000n, makeBudget()));
    expect(r.map((c) => c.id)).toEqual([
      'portfolio.drawdown',
      'portfolio.daily-loss-cap',
      'portfolio.max-exposure',
    ]);
  });

  it('short-circuits with Err on the first invalid input', () => {
    expect(
      isErr(evaluatePortfolioRisk(makeState({ peakEquityLamports: -1n }), 1n, makeBudget())),
    ).toBe(true);
  });

  it('propagates Err from daily-loss-cap', () => {
    expect(
      isErr(evaluatePortfolioRisk(makeState(), 1n, makeBudget({ dailyLossCapLamports: -1n }))),
    ).toBe(true);
  });

  it('propagates Err from max-exposure', () => {
    expect(isErr(evaluatePortfolioRisk(makeState(), -1n, makeBudget()))).toBe(true);
  });
});
