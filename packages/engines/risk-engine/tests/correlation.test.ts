import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import { checkTokenConcentration, tokenOverlapCount } from '../src/correlation.js';
import { MINTS, makeOpenPosition } from './_fixtures.js';

describe('tokenOverlapCount', () => {
  it('returns 0 when no mints overlap', () => {
    const positions = [makeOpenPosition({ baseMint: MINTS.BONK, quoteMint: MINTS.USDC })];
    expect(tokenOverlapCount(positions, { baseMint: MINTS.WIF, quoteMint: MINTS.SOL })).toBe(0);
  });

  it('counts base-mint match', () => {
    const positions = [makeOpenPosition({ baseMint: MINTS.BONK, quoteMint: MINTS.USDC })];
    expect(tokenOverlapCount(positions, { baseMint: MINTS.BONK, quoteMint: MINTS.SOL })).toBe(1);
  });

  it('counts quote-mint match', () => {
    const positions = [makeOpenPosition({ baseMint: MINTS.BONK, quoteMint: MINTS.USDC })];
    expect(tokenOverlapCount(positions, { baseMint: MINTS.WIF, quoteMint: MINTS.USDC })).toBe(1);
  });

  it('counts cross-leg match (candidate base = position quote)', () => {
    const positions = [makeOpenPosition({ baseMint: MINTS.BONK, quoteMint: MINTS.USDC })];
    expect(tokenOverlapCount(positions, { baseMint: MINTS.USDC, quoteMint: MINTS.SOL })).toBe(1);
  });

  it('counts cross-leg match (candidate quote = position base)', () => {
    const positions = [makeOpenPosition({ baseMint: MINTS.BONK, quoteMint: MINTS.USDC })];
    expect(tokenOverlapCount(positions, { baseMint: MINTS.SOL, quoteMint: MINTS.BONK })).toBe(1);
  });

  it('aggregates across multiple positions', () => {
    const positions = [
      makeOpenPosition({ baseMint: MINTS.SOL, quoteMint: MINTS.USDC }),
      makeOpenPosition({ baseMint: MINTS.BONK, quoteMint: MINTS.SOL }),
      makeOpenPosition({ baseMint: MINTS.WIF, quoteMint: MINTS.BONK }),
    ];
    // candidate SOL/USDC shares with #1 (SOL+USDC) and #2 (SOL).
    expect(tokenOverlapCount(positions, { baseMint: MINTS.SOL, quoteMint: MINTS.USDC })).toBe(2);
  });

  it('empty positions → 0', () => {
    expect(tokenOverlapCount([], { baseMint: MINTS.SOL, quoteMint: MINTS.USDC })).toBe(0);
  });
});

describe('checkTokenConcentration', () => {
  it('passes when overlap is within cap', () => {
    const positions = [makeOpenPosition({ baseMint: MINTS.BONK, quoteMint: MINTS.USDC })];
    const r = unwrap(
      checkTokenConcentration(positions, { baseMint: MINTS.BONK, quoteMint: MINTS.SOL }, 1),
    );
    expect(r.passed).toBe(true);
    expect(r.id).toBe('correlation.token-overlap');
  });

  it('denies when overlap exceeds cap', () => {
    const positions = [
      makeOpenPosition({ baseMint: MINTS.SOL, quoteMint: MINTS.USDC }),
      makeOpenPosition({ baseMint: MINTS.BONK, quoteMint: MINTS.SOL }),
    ];
    const r = unwrap(
      checkTokenConcentration(positions, { baseMint: MINTS.SOL, quoteMint: MINTS.USDC }, 1),
    );
    expect(r.passed).toBe(false);
  });

  it('rejects invalid maxOverlap', () => {
    expect(
      isErr(checkTokenConcentration([], { baseMint: MINTS.SOL, quoteMint: MINTS.USDC }, -1)),
    ).toBe(true);
    expect(
      isErr(checkTokenConcentration([], { baseMint: MINTS.SOL, quoteMint: MINTS.USDC }, 1.5)),
    ).toBe(true);
  });
});
