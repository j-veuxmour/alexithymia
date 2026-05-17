import { isErr, isOk, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import { RiskBudget } from '../src/value-objects/risk-budget.vo.js';
import { SolAmount } from '../src/value-objects/sol-amount.vo.js';

describe('RiskBudget', () => {
  const cap = unwrap(SolAmount.fromSol(1));

  it('accepts a valid budget', () => {
    const r = RiskBudget.create({
      maxDrawdownBps: 1_000,
      dailyLossCap: cap,
      maxExposureBps: 5_000,
    });
    expect(isOk(r)).toBe(true);
  });

  it('rejects out-of-range maxDrawdownBps', () => {
    expect(
      isErr(RiskBudget.create({ maxDrawdownBps: 10_001, dailyLossCap: cap, maxExposureBps: 0 })),
    ).toBe(true);
    expect(
      isErr(RiskBudget.create({ maxDrawdownBps: -1, dailyLossCap: cap, maxExposureBps: 0 })),
    ).toBe(true);
  });

  it('rejects non-integer bps', () => {
    expect(
      isErr(RiskBudget.create({ maxDrawdownBps: 1.5, dailyLossCap: cap, maxExposureBps: 0 })),
    ).toBe(true);
  });

  it('rejects out-of-range maxExposureBps', () => {
    expect(
      isErr(RiskBudget.create({ maxDrawdownBps: 100, dailyLossCap: cap, maxExposureBps: 99_999 })),
    ).toBe(true);
  });
});
