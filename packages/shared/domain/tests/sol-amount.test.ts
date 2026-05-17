import { isErr, isOk, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import { SolAmount } from '../src/value-objects/sol-amount.vo.js';

describe('SolAmount', () => {
  it('fromLamports accepts zero and positive', () => {
    expect(isOk(SolAmount.fromLamports(0n))).toBe(true);
    expect(isOk(SolAmount.fromLamports(123n))).toBe(true);
  });

  it('fromLamports rejects negatives', () => {
    expect(isErr(SolAmount.fromLamports(-1n))).toBe(true);
  });

  it('fromLamports rejects overflow', () => {
    const overflow = (1n << 63n) + 1n;
    expect(isErr(SolAmount.fromLamports(overflow))).toBe(true);
  });

  it('fromSol rounds to nearest lamport', () => {
    const r = unwrap(SolAmount.fromSol(1.5));
    expect(r).toBe(1_500_000_000n as unknown as bigint);
  });

  it('fromSol rejects negative or non-finite', () => {
    expect(isErr(SolAmount.fromSol(-1))).toBe(true);
    expect(isErr(SolAmount.fromSol(Number.NaN))).toBe(true);
    expect(isErr(SolAmount.fromSol(Number.POSITIVE_INFINITY))).toBe(true);
  });

  it('toSol round-trips reasonable display values', () => {
    const a = unwrap(SolAmount.fromSol(2.5));
    expect(SolAmount.toSol(a)).toBe(2.5);
  });

  it('add is monotonic', () => {
    const a = unwrap(SolAmount.fromLamports(100n));
    const b = unwrap(SolAmount.fromLamports(50n));
    expect(SolAmount.add(a, b)).toBe(150n as unknown as bigint);
  });

  it('sub returns Err on negative result', () => {
    const a = unwrap(SolAmount.fromLamports(50n));
    const b = unwrap(SolAmount.fromLamports(100n));
    expect(isErr(SolAmount.sub(a, b))).toBe(true);
  });

  it('sub returns Ok within range', () => {
    const a = unwrap(SolAmount.fromLamports(100n));
    const b = unwrap(SolAmount.fromLamports(40n));
    const r = SolAmount.sub(a, b);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(60n as unknown as bigint);
  });

  it('cmp / gte / lte / eq behave consistently', () => {
    const a = unwrap(SolAmount.fromLamports(10n));
    const b = unwrap(SolAmount.fromLamports(20n));
    const c = unwrap(SolAmount.fromLamports(10n));
    expect(SolAmount.cmp(a, b)).toBe(-1);
    expect(SolAmount.cmp(b, a)).toBe(1);
    expect(SolAmount.cmp(a, c)).toBe(0);
    expect(SolAmount.eq(a, c)).toBe(true);
    expect(SolAmount.gte(b, a)).toBe(true);
    expect(SolAmount.lte(a, b)).toBe(true);
  });
});
