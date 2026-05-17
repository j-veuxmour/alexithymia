import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import { KELLY_MULTIPLIERS } from '../src/allocation.types.js';
import { fractionalKelly } from '../src/fractional-kelly.js';

describe('fractionalKelly', () => {
  it('half Kelly halves the fraction', () => {
    expect(unwrap(fractionalKelly(0.4, KELLY_MULTIPLIERS.HALF))).toBeCloseTo(0.2, 10);
  });

  it('quarter Kelly quarters the fraction', () => {
    expect(unwrap(fractionalKelly(0.4, KELLY_MULTIPLIERS.QUARTER))).toBeCloseTo(0.1, 10);
  });

  it('full Kelly equals input', () => {
    expect(unwrap(fractionalKelly(0.37, KELLY_MULTIPLIERS.FULL))).toBeCloseTo(0.37, 10);
  });

  it('rejects kelly outside [0, 1]', () => {
    expect(isErr(fractionalKelly(-0.01, 0.5))).toBe(true);
    expect(isErr(fractionalKelly(1.01, 0.5))).toBe(true);
  });

  it('rejects non-finite kelly', () => {
    expect(isErr(fractionalKelly(Number.NaN, 0.5))).toBe(true);
  });

  it('rejects multiplier ≤ 0', () => {
    expect(isErr(fractionalKelly(0.4, 0))).toBe(true);
    expect(isErr(fractionalKelly(0.4, -0.1))).toBe(true);
  });

  it('rejects multiplier > 1', () => {
    expect(isErr(fractionalKelly(0.4, 1.01))).toBe(true);
  });

  it('rejects non-finite multiplier', () => {
    expect(isErr(fractionalKelly(0.4, Number.NaN))).toBe(true);
    expect(isErr(fractionalKelly(0.4, Number.POSITIVE_INFINITY))).toBe(true);
  });

  it('zero kelly stays zero regardless of multiplier', () => {
    expect(unwrap(fractionalKelly(0, 0.25))).toBe(0);
  });
});
