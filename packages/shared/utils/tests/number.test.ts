import { describe, expect, it } from 'vitest';
import {
  LAMPORTS_PER_SOL,
  bpsOf,
  clamp,
  clampBigInt,
  isFiniteNumber,
  lamportsToSol,
  ppmOf,
  roundTo,
  solToLamports,
} from '../src/number.js';

describe('clamp', () => {
  it('returns within range untouched', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it('clamps below min', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
  });
  it('clamps above max', () => {
    expect(clamp(11, 0, 10)).toBe(10);
  });
  it('throws on NaN', () => {
    expect(() => clamp(Number.NaN, 0, 10)).toThrow(RangeError);
  });
  it('throws on min > max', () => {
    expect(() => clamp(5, 10, 0)).toThrow(RangeError);
  });
});

describe('clampBigInt', () => {
  it('respects bigint bounds', () => {
    expect(clampBigInt(5n, 0n, 10n)).toBe(5n);
    expect(clampBigInt(-1n, 0n, 10n)).toBe(0n);
    expect(clampBigInt(11n, 0n, 10n)).toBe(10n);
  });
  it('throws on min > max', () => {
    expect(() => clampBigInt(5n, 10n, 0n)).toThrow(RangeError);
  });
});

describe('roundTo', () => {
  it('rounds to N decimals', () => {
    expect(roundTo(1.2345, 2)).toBe(1.23);
    expect(roundTo(1.2355, 2)).toBeCloseTo(1.24, 5);
  });
  it('rejects negative decimals', () => {
    expect(() => roundTo(1, -1)).toThrow(RangeError);
  });
});

describe('isFiniteNumber', () => {
  it('rejects NaN, Infinity, non-number', () => {
    expect(isFiniteNumber(Number.NaN)).toBe(false);
    expect(isFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isFiniteNumber('1')).toBe(false);
    expect(isFiniteNumber(1)).toBe(true);
  });
});

describe('lamportsToSol / solToLamports', () => {
  it('LAMPORTS_PER_SOL is correct', () => {
    expect(LAMPORTS_PER_SOL).toBe(1_000_000_000n);
  });
  it('1 SOL → 1e9 lamports', () => {
    expect(solToLamports(1)).toBe(1_000_000_000n);
  });
  it('round-trip preserves whole-SOL display', () => {
    expect(lamportsToSol(solToLamports(2.5))).toBe(2.5);
  });
  it('rejects non-finite SOL', () => {
    expect(() => solToLamports(Number.NaN)).toThrow(TypeError);
  });
});

describe('bpsOf', () => {
  it('2.5 % of 1_000_000 = 25_000', () => {
    expect(bpsOf(1_000_000n, 250)).toBe(25_000n);
  });
  it('floor-divides on remainder', () => {
    // 1_001n * 250 / 10_000 = 250_250 / 10_000 = 25 (floor)
    expect(bpsOf(1_001n, 250)).toBe(25n);
  });
  it('rejects negative bps', () => {
    expect(() => bpsOf(1n, -1)).toThrow(RangeError);
  });
});

describe('ppmOf', () => {
  it('500 ppm of 1_000_000_000 = 500_000', () => {
    expect(ppmOf(1_000_000_000n, 500)).toBe(500_000n);
  });
  it('rejects non-integer ppm', () => {
    expect(() => ppmOf(1n, 1.5)).toThrow(RangeError);
  });
});
