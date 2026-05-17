import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import { scoreCandidate } from '../src/scoring/candidate-scorer.js';

describe('scoreCandidate', () => {
  it('computes the weighted average of normalized signals', () => {
    // values: [0.5, 1.0]  weights: [1, 3]  → (0.5·1 + 1·3) / 4 = 0.875
    const r = unwrap(
      scoreCandidate([
        { name: 'momentum', value: 0.5, weight: 1 },
        { name: 'volume', value: 1, weight: 3 },
      ]),
    );
    expect(r.compositeScore).toBeCloseTo(0.875, 10);
    expect(r.breakdown.momentum).toBeCloseTo(0.125, 10);
    expect(r.breakdown.volume).toBeCloseTo(0.75, 10);
  });

  it('breakdown sums to compositeScore', () => {
    const r = unwrap(
      scoreCandidate([
        { name: 'a', value: 0.2, weight: 2 },
        { name: 'b', value: 0.6, weight: 1 },
        { name: 'c', value: 0.9, weight: 5 },
      ]),
    );
    const sum = Object.values(r.breakdown).reduce((acc, v) => acc + v, 0);
    expect(sum).toBeCloseTo(r.compositeScore, 10);
  });

  it('zero-weight signal contributes zero', () => {
    const r = unwrap(
      scoreCandidate([
        { name: 'discarded', value: 1, weight: 0 },
        { name: 'kept', value: 0.4, weight: 2 },
      ]),
    );
    expect(r.breakdown.discarded).toBe(0);
    expect(r.compositeScore).toBeCloseTo(0.4, 10);
  });

  it('errors on empty signal list', () => {
    expect(isErr(scoreCandidate([]))).toBe(true);
  });

  it('errors on value < 0', () => {
    expect(isErr(scoreCandidate([{ name: 'a', value: -0.01, weight: 1 }]))).toBe(true);
  });

  it('errors on value > 1', () => {
    expect(isErr(scoreCandidate([{ name: 'a', value: 1.01, weight: 1 }]))).toBe(true);
  });

  it('errors on non-finite value', () => {
    expect(isErr(scoreCandidate([{ name: 'a', value: Number.NaN, weight: 1 }]))).toBe(true);
    expect(
      isErr(scoreCandidate([{ name: 'a', value: Number.POSITIVE_INFINITY, weight: 1 }])),
    ).toBe(true);
  });

  it('errors on negative weight', () => {
    expect(isErr(scoreCandidate([{ name: 'a', value: 0.5, weight: -1 }]))).toBe(true);
  });

  it('errors on non-finite weight', () => {
    expect(isErr(scoreCandidate([{ name: 'a', value: 0.5, weight: Number.NaN }]))).toBe(true);
    expect(
      isErr(scoreCandidate([{ name: 'a', value: 0.5, weight: Number.POSITIVE_INFINITY }])),
    ).toBe(true);
  });

  it('errors when total weight is zero', () => {
    expect(
      isErr(
        scoreCandidate([
          { name: 'a', value: 0.5, weight: 0 },
          { name: 'b', value: 0.5, weight: 0 },
        ]),
      ),
    ).toBe(true);
  });
});
