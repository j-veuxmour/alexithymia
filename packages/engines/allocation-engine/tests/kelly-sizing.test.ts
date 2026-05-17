import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import { kellyFraction } from '../src/kelly-sizing.js';

describe('kellyFraction', () => {
  it('p=0.6, b=2 → 0.4 (textbook example)', () => {
    // f* = 0.6 - 0.4/2 = 0.4
    expect(unwrap(kellyFraction({ winRate: 0.6, winLossRatio: 2 }))).toBeCloseTo(0.4, 10);
  });

  it('p=0.5, b=1 → 0 (coin flip, even odds)', () => {
    expect(unwrap(kellyFraction({ winRate: 0.5, winLossRatio: 1 }))).toBe(0);
  });

  it('negative edge clamps to 0', () => {
    // p=0.4, b=1 → 0.4 - 0.6 = -0.2 → 0
    expect(unwrap(kellyFraction({ winRate: 0.4, winLossRatio: 1 }))).toBe(0);
  });

  it('extreme positive edge clamps to 1', () => {
    // p=0.99, b=1000 → ≈ 0.989 (still under 1); use a stronger case
    // p=1.0, b=any → 1 - 0 = 1 → clamp 1
    expect(unwrap(kellyFraction({ winRate: 1, winLossRatio: 2 }))).toBe(1);
  });

  it('rejects winRate < 0', () => {
    expect(isErr(kellyFraction({ winRate: -0.01, winLossRatio: 1 }))).toBe(true);
  });

  it('rejects winRate > 1', () => {
    expect(isErr(kellyFraction({ winRate: 1.01, winLossRatio: 1 }))).toBe(true);
  });

  it('rejects non-finite winRate', () => {
    expect(isErr(kellyFraction({ winRate: Number.NaN, winLossRatio: 1 }))).toBe(true);
    expect(isErr(kellyFraction({ winRate: Number.POSITIVE_INFINITY, winLossRatio: 1 }))).toBe(true);
  });

  it('rejects non-positive winLossRatio', () => {
    expect(isErr(kellyFraction({ winRate: 0.5, winLossRatio: 0 }))).toBe(true);
    expect(isErr(kellyFraction({ winRate: 0.5, winLossRatio: -1 }))).toBe(true);
  });

  it('rejects non-finite winLossRatio', () => {
    expect(isErr(kellyFraction({ winRate: 0.5, winLossRatio: Number.NaN }))).toBe(true);
    expect(isErr(kellyFraction({ winRate: 0.5, winLossRatio: Number.POSITIVE_INFINITY }))).toBe(
      true,
    );
  });
});
