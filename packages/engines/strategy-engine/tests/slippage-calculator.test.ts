import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import { recommendSlippageBps } from '../src/slippage-calculator.js';
import type { SlippageInputs } from '../src/strategy.types.js';

const baseInputs = (overrides: Partial<SlippageInputs> = {}): SlippageInputs => ({
  depthLamports: 1_000_000_000_000n, // 1000 SOL
  tradeSizeLamports: 1_000_000_000n, // 1 SOL → 10 bps impact
  volatilityBps: 400, // → 200 bps vol component
  ...overrides,
});

describe('recommendSlippageBps', () => {
  it('volatility component wins when it dominates impact', () => {
    const r = unwrap(recommendSlippageBps(baseInputs()));
    expect(r.volComponentBps).toBe(200);
    expect(r.impactBps).toBe(10);
    expect(r.recommendedBps).toBe(200);
    expect(r.cappedBy).toBe('volatility');
  });

  it('depth-impact component wins when impact dominates volatility', () => {
    // 100 SOL trade vs 1000 SOL depth → 1000 bps impact; vol 200 bps.
    const r = unwrap(
      recommendSlippageBps(
        baseInputs({ tradeSizeLamports: 100_000_000_000n, volatilityBps: 400 }),
      ),
    );
    expect(r.impactBps).toBe(1_000);
    expect(r.recommendedBps).toBe(1_000);
    expect(r.cappedBy).toBe('depth-impact');
  });

  it('preset cap binds when below the raw recommendation', () => {
    const r = unwrap(
      recommendSlippageBps(
        baseInputs({ volatilityBps: 1_000, presetSlippageBpsCap: 100 }),
      ),
    );
    expect(r.recommendedBps).toBe(100);
    expect(r.cappedBy).toBe('preset-cap');
  });

  it('preset cap does not bind when raw is below the cap', () => {
    const r = unwrap(recommendSlippageBps(baseInputs({ presetSlippageBpsCap: 500 })));
    expect(r.recommendedBps).toBe(200);
    expect(r.cappedBy).toBe('volatility');
  });

  it('trade size > depth saturates impact at 10000 bps', () => {
    const r = unwrap(
      recommendSlippageBps({
        depthLamports: 1_000_000_000n,
        tradeSizeLamports: 100_000_000_000n,
        volatilityBps: 0,
      }),
    );
    expect(r.impactBps).toBe(10_000);
    expect(r.recommendedBps).toBe(10_000);
  });

  it('tradeSize = 0 collapses impact to 0; volatility carries the recommendation', () => {
    const r = unwrap(recommendSlippageBps(baseInputs({ tradeSizeLamports: 0n })));
    expect(r.impactBps).toBe(0);
    expect(r.recommendedBps).toBe(r.volComponentBps);
  });

  it('clamps volatility component at 10000 bps', () => {
    const r = unwrap(
      recommendSlippageBps({
        depthLamports: 1n,
        tradeSizeLamports: 0n,
        volatilityBps: 50_000,
      }),
    );
    expect(r.volComponentBps).toBe(10_000);
    expect(r.recommendedBps).toBe(10_000);
  });

  it('rejects negative volatilityBps', () => {
    expect(isErr(recommendSlippageBps(baseInputs({ volatilityBps: -1 })))).toBe(true);
  });

  it('rejects non-finite volatilityBps', () => {
    expect(isErr(recommendSlippageBps(baseInputs({ volatilityBps: Number.NaN })))).toBe(true);
  });

  it('rejects depthLamports <= 0', () => {
    expect(isErr(recommendSlippageBps(baseInputs({ depthLamports: 0n })))).toBe(true);
    expect(isErr(recommendSlippageBps(baseInputs({ depthLamports: -1n })))).toBe(true);
  });

  it('rejects negative tradeSizeLamports', () => {
    expect(isErr(recommendSlippageBps(baseInputs({ tradeSizeLamports: -1n })))).toBe(true);
  });

  it('rejects non-integer preset cap', () => {
    expect(isErr(recommendSlippageBps(baseInputs({ presetSlippageBpsCap: 1.5 })))).toBe(true);
  });

  it('rejects negative preset cap', () => {
    expect(isErr(recommendSlippageBps(baseInputs({ presetSlippageBpsCap: -1 })))).toBe(true);
  });

  it('rejects preset cap > 10000', () => {
    expect(isErr(recommendSlippageBps(baseInputs({ presetSlippageBpsCap: 10_001 })))).toBe(true);
  });
});
