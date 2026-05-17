import { Pnl, SignedSolAmount } from '@alexithymia/shared-domain';
import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import { computePositionPnl, realizedPnl, unrealizedPnl } from '../src/pnl-calculator.js';

describe('realizedPnl', () => {
  it('profit when proceeds > cost basis', () => {
    const r = unwrap(realizedPnl(1_000_000_000n, 1_200_000_000n));
    expect(SignedSolAmount.toLamports(r)).toBe(200_000_000n);
  });

  it('loss when proceeds < cost basis', () => {
    const r = unwrap(realizedPnl(1_000_000_000n, 800_000_000n));
    expect(SignedSolAmount.toLamports(r)).toBe(-200_000_000n);
  });

  it('break-even when equal', () => {
    const r = unwrap(realizedPnl(500n, 500n));
    expect(SignedSolAmount.toLamports(r)).toBe(0n);
  });

  it('rejects negative cost basis', () => {
    expect(isErr(realizedPnl(-1n, 0n))).toBe(true);
  });

  it('rejects negative proceeds', () => {
    expect(isErr(realizedPnl(0n, -1n))).toBe(true);
  });
});

describe('unrealizedPnl', () => {
  it('mark-up when current > cost basis', () => {
    const r = unwrap(unrealizedPnl(1_000n, 1_500n));
    expect(SignedSolAmount.toLamports(r)).toBe(500n);
  });

  it('mark-down when current < cost basis', () => {
    const r = unwrap(unrealizedPnl(1_000n, 600n));
    expect(SignedSolAmount.toLamports(r)).toBe(-400n);
  });

  it('rejects negative inputs', () => {
    expect(isErr(unrealizedPnl(-1n, 0n))).toBe(true);
    expect(isErr(unrealizedPnl(0n, -1n))).toBe(true);
  });
});

describe('computePositionPnl', () => {
  it('claimed fees become realized; mark-to-market becomes unrealized', () => {
    const r = unwrap(
      computePositionPnl({
        costBasisLamports: 1_000_000_000n,
        currentValueLamports: 1_100_000_000n,
        claimedFeesLamports: 50_000_000n,
      }),
    );
    expect(SignedSolAmount.toLamports(r.realized)).toBe(50_000_000n);
    expect(SignedSolAmount.toLamports(r.unrealized)).toBe(100_000_000n);
    expect(Pnl.isProfit(r)).toBe(true);
  });

  it('handles a position that is underwater on mark', () => {
    const r = unwrap(
      computePositionPnl({
        costBasisLamports: 1_000_000_000n,
        currentValueLamports: 800_000_000n,
        claimedFeesLamports: 10_000_000n,
      }),
    );
    expect(SignedSolAmount.toLamports(r.realized)).toBe(10_000_000n);
    expect(SignedSolAmount.toLamports(r.unrealized)).toBe(-200_000_000n);
    expect(Pnl.isLoss(r)).toBe(true);
  });

  it('zero values → zero Pnl', () => {
    const r = unwrap(
      computePositionPnl({
        costBasisLamports: 0n,
        currentValueLamports: 0n,
        claimedFeesLamports: 0n,
      }),
    );
    expect(Pnl.isBreakEven(r)).toBe(true);
  });

  it('rejects any negative input', () => {
    expect(
      isErr(
        computePositionPnl({
          costBasisLamports: -1n,
          currentValueLamports: 0n,
          claimedFeesLamports: 0n,
        }),
      ),
    ).toBe(true);
    expect(
      isErr(
        computePositionPnl({
          costBasisLamports: 0n,
          currentValueLamports: -1n,
          claimedFeesLamports: 0n,
        }),
      ),
    ).toBe(true);
    expect(
      isErr(
        computePositionPnl({
          costBasisLamports: 0n,
          currentValueLamports: 0n,
          claimedFeesLamports: -1n,
        }),
      ),
    ).toBe(true);
  });
});
