import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import { applyWeights, normalizeWeights } from '../src/scoring/signal-weighter.js';

describe('normalizeWeights', () => {
  it('normalizes to a probability simplex (sum = 1)', () => {
    const r = unwrap(normalizeWeights({ a: 1, b: 3 }));
    expect(r.a).toBeCloseTo(0.25, 10);
    expect(r.b).toBeCloseTo(0.75, 10);
    const sum = Object.values(r).reduce((acc, v) => acc + v, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('a single entry normalizes to 1', () => {
    expect(unwrap(normalizeWeights({ a: 7 })).a).toBeCloseTo(1, 10);
  });

  it('errors on empty map', () => {
    expect(isErr(normalizeWeights({}))).toBe(true);
  });

  it('errors on zero weight', () => {
    expect(isErr(normalizeWeights({ a: 1, b: 0 }))).toBe(true);
  });

  it('errors on negative weight', () => {
    expect(isErr(normalizeWeights({ a: 1, b: -1 }))).toBe(true);
  });

  it('errors on non-finite weight', () => {
    expect(isErr(normalizeWeights({ a: Number.NaN }))).toBe(true);
    expect(isErr(normalizeWeights({ a: Number.POSITIVE_INFINITY }))).toBe(true);
  });
});

describe('applyWeights', () => {
  it('computes the inner product of values and weights', () => {
    // 0.2·0.5 + 0.6·0.5 = 0.4
    expect(unwrap(applyWeights({ a: 0.2, b: 0.6 }, { a: 0.5, b: 0.5 }))).toBeCloseTo(0.4, 10);
  });

  it('handles a single key', () => {
    expect(unwrap(applyWeights({ a: 0.3 }, { a: 2 }))).toBeCloseTo(0.6, 10);
  });

  it('errors when key counts differ', () => {
    expect(isErr(applyWeights({ a: 1 }, { a: 1, b: 1 }))).toBe(true);
  });

  it('errors when key sets disagree but counts match', () => {
    expect(isErr(applyWeights({ a: 1, b: 1 }, { a: 1, c: 1 }))).toBe(true);
  });

  it('errors on non-finite value', () => {
    expect(isErr(applyWeights({ a: Number.NaN }, { a: 1 }))).toBe(true);
  });

  it('errors on non-finite weight', () => {
    expect(isErr(applyWeights({ a: 1 }, { a: Number.POSITIVE_INFINITY }))).toBe(true);
  });
});
