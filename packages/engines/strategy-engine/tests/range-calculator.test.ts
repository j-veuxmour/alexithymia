import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import { computeRangeBudget } from '../src/range-calculator.js';
import type { RangePolicy } from '../src/strategy.types.js';

const basePolicy = (overrides: Partial<RangePolicy> = {}): RangePolicy => ({
  minBinsBelow: 35,
  maxBinsBelow: 69,
  minBinsAbove: 0,
  maxBinsAbove: 17,
  volatilityScale: 5,
  ...overrides,
});

describe('computeRangeBudget', () => {
  it('at volatility = 0 the budget is the policy minimum', () => {
    const r = unwrap(computeRangeBudget({ volatility: 0, policy: basePolicy() }));
    expect(r.binsBelow).toBe(35);
    expect(r.binsAbove).toBe(0);
  });

  it('at volatility = volatilityScale the budget is the policy maximum', () => {
    const r = unwrap(computeRangeBudget({ volatility: 5, policy: basePolicy() }));
    expect(r.binsBelow).toBe(69);
    expect(r.binsAbove).toBe(17);
  });

  it('saturates at the maximum above the volatility scale', () => {
    const r = unwrap(computeRangeBudget({ volatility: 50, policy: basePolicy() }));
    expect(r.binsBelow).toBe(69);
    expect(r.binsAbove).toBe(17);
  });

  it('interpolates linearly between min and max', () => {
    // volatility 2.5 is halfway; binsBelow halfway between 35 and 69 is 52.
    const r = unwrap(computeRangeBudget({ volatility: 2.5, policy: basePolicy() }));
    expect(r.binsBelow).toBe(52);
  });

  it('supports asymmetric ranges (binsAbove = 0 single-side)', () => {
    const r = unwrap(
      computeRangeBudget({
        volatility: 5,
        policy: basePolicy({ minBinsAbove: 0, maxBinsAbove: 0 }),
      }),
    );
    expect(r.binsAbove).toBe(0);
  });

  it('returns min when min equals max (zero-width policy span)', () => {
    const r = unwrap(
      computeRangeBudget({
        volatility: 3,
        policy: basePolicy({ minBinsBelow: 50, maxBinsBelow: 50 }),
      }),
    );
    expect(r.binsBelow).toBe(50);
  });

  it('rejects negative volatility', () => {
    expect(isErr(computeRangeBudget({ volatility: -1, policy: basePolicy() }))).toBe(true);
  });

  it('rejects non-finite volatility', () => {
    expect(isErr(computeRangeBudget({ volatility: Number.NaN, policy: basePolicy() }))).toBe(true);
    expect(
      isErr(computeRangeBudget({ volatility: Number.POSITIVE_INFINITY, policy: basePolicy() })),
    ).toBe(true);
  });

  it('rejects non-integer minBinsBelow', () => {
    expect(
      isErr(computeRangeBudget({ volatility: 1, policy: basePolicy({ minBinsBelow: 1.5 }) })),
    ).toBe(true);
  });

  it('rejects negative minBinsBelow', () => {
    expect(
      isErr(computeRangeBudget({ volatility: 1, policy: basePolicy({ minBinsBelow: -1 }) })),
    ).toBe(true);
  });

  it('rejects non-integer maxBinsBelow', () => {
    expect(
      isErr(computeRangeBudget({ volatility: 1, policy: basePolicy({ maxBinsBelow: 1.5 }) })),
    ).toBe(true);
  });

  it('rejects non-integer minBinsAbove', () => {
    expect(
      isErr(computeRangeBudget({ volatility: 1, policy: basePolicy({ minBinsAbove: 1.5 }) })),
    ).toBe(true);
  });

  it('rejects non-integer maxBinsAbove', () => {
    expect(
      isErr(computeRangeBudget({ volatility: 1, policy: basePolicy({ maxBinsAbove: 1.5 }) })),
    ).toBe(true);
  });

  it('rejects minBinsBelow > maxBinsBelow', () => {
    expect(
      isErr(
        computeRangeBudget({
          volatility: 1,
          policy: basePolicy({ minBinsBelow: 70, maxBinsBelow: 30 }),
        }),
      ),
    ).toBe(true);
  });

  it('rejects minBinsAbove > maxBinsAbove', () => {
    expect(
      isErr(
        computeRangeBudget({
          volatility: 1,
          policy: basePolicy({ minBinsAbove: 20, maxBinsAbove: 10 }),
        }),
      ),
    ).toBe(true);
  });

  it('rejects non-positive volatilityScale', () => {
    expect(
      isErr(computeRangeBudget({ volatility: 1, policy: basePolicy({ volatilityScale: 0 }) })),
    ).toBe(true);
    expect(
      isErr(computeRangeBudget({ volatility: 1, policy: basePolicy({ volatilityScale: -1 }) })),
    ).toBe(true);
  });

  it('rejects non-finite volatilityScale', () => {
    expect(
      isErr(
        computeRangeBudget({ volatility: 1, policy: basePolicy({ volatilityScale: Number.NaN }) }),
      ),
    ).toBe(true);
  });
});
