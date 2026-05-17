import { describe, expect, it } from 'vitest';
import { Pnl, SignedSolAmount } from '../src/value-objects/pnl.vo.js';

describe('SignedSolAmount', () => {
  it('preserves sign in arithmetic', () => {
    const a = SignedSolAmount.fromLamports(100n);
    const b = SignedSolAmount.fromLamports(-30n);
    expect(SignedSolAmount.add(a, b)).toBe(70n as unknown as bigint);
    expect(SignedSolAmount.sub(a, b)).toBe(130n as unknown as bigint);
  });

  it('neg flips sign', () => {
    const a = SignedSolAmount.fromLamports(42n);
    expect(SignedSolAmount.neg(a)).toBe(-42n as unknown as bigint);
  });

  it('toSol returns signed float', () => {
    const a = SignedSolAmount.fromLamports(-1_500_000_000n);
    expect(SignedSolAmount.toSol(a)).toBe(-1.5);
  });

  it('cmp orders correctly across sign', () => {
    const neg = SignedSolAmount.fromLamports(-10n);
    const pos = SignedSolAmount.fromLamports(10n);
    expect(SignedSolAmount.cmp(neg, pos)).toBe(-1);
    expect(SignedSolAmount.cmp(pos, neg)).toBe(1);
    expect(SignedSolAmount.cmp(pos, pos)).toBe(0);
  });
});

describe('Pnl', () => {
  it('zero is break-even', () => {
    expect(Pnl.isBreakEven(Pnl.zero)).toBe(true);
    expect(Pnl.isProfit(Pnl.zero)).toBe(false);
    expect(Pnl.isLoss(Pnl.zero)).toBe(false);
  });

  it('positive total → profit', () => {
    const p = Pnl.create(100n, 50n);
    expect(Pnl.isProfit(p)).toBe(true);
    expect(Pnl.total(p)).toBe(150n as unknown as bigint);
  });

  it('negative total → loss', () => {
    const p = Pnl.create(-50n, -20n);
    expect(Pnl.isLoss(p)).toBe(true);
    expect(Pnl.total(p)).toBe(-70n as unknown as bigint);
  });

  it('realized and unrealized may have opposite signs', () => {
    const p = Pnl.create(100n, -40n);
    expect(Pnl.total(p)).toBe(60n as unknown as bigint);
    expect(Pnl.isProfit(p)).toBe(true);
  });
});
