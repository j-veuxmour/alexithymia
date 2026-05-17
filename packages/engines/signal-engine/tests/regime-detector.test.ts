import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import { detectRegime } from '../src/regime-detector.js';
import type { RegimeFeatures, RegimeThresholds } from '../src/signal.types.js';

const baseThresholds = (overrides: Partial<RegimeThresholds> = {}): RegimeThresholds => ({
  highVolBps: 800,
  bullishTrendBps: 200,
  bearishTrendBps: -200,
  bullBreadthBps: 6_000,
  bearBreadthBps: 4_000,
  ...overrides,
});

const baseFeatures = (overrides: Partial<RegimeFeatures> = {}): RegimeFeatures => ({
  volatilityBps: 400,
  trendBps: 0,
  breadthBps: 5_000,
  ...overrides,
});

describe('detectRegime', () => {
  it('returns risk-on when trend, breadth bullish and volatility contained', () => {
    const r = unwrap(
      detectRegime(
        baseFeatures({ volatilityBps: 500, trendBps: 300, breadthBps: 7_000 }),
        baseThresholds(),
      ),
    );
    expect(r.regime).toBe('risk-on');
    expect(r.reasons).toHaveLength(3);
  });

  it('returns risk-off when volatility exceeds the cap (single trigger)', () => {
    const r = unwrap(
      detectRegime(
        baseFeatures({ volatilityBps: 900, trendBps: 300, breadthBps: 7_000 }),
        baseThresholds(),
      ),
    );
    expect(r.regime).toBe('risk-off');
    expect(r.reasons[0]).toMatch(/volatility 900/);
  });

  it('returns risk-off when trend is at or below the bearish floor', () => {
    const r = unwrap(
      detectRegime(baseFeatures({ trendBps: -200 }), baseThresholds()),
    );
    expect(r.regime).toBe('risk-off');
    expect(r.reasons.some((s) => s.includes('trend'))).toBe(true);
  });

  it('returns risk-off when breadth is at or below the bearish floor', () => {
    const r = unwrap(
      detectRegime(
        baseFeatures({ trendBps: 0, breadthBps: 4_000 }),
        baseThresholds(),
      ),
    );
    expect(r.regime).toBe('risk-off');
    expect(r.reasons.some((s) => s.includes('breadth'))).toBe(true);
  });

  it('collects multiple risk-off reasons when several conditions fire', () => {
    const r = unwrap(
      detectRegime(
        baseFeatures({ volatilityBps: 1_500, trendBps: -500, breadthBps: 1_000 }),
        baseThresholds(),
      ),
    );
    expect(r.regime).toBe('risk-off');
    expect(r.reasons.length).toBeGreaterThanOrEqual(3);
  });

  it('returns transitional when trend is bullish but breadth is mid', () => {
    const r = unwrap(
      detectRegime(
        baseFeatures({ trendBps: 300, breadthBps: 5_500 }),
        baseThresholds(),
      ),
    );
    expect(r.regime).toBe('transitional');
    expect(r.reasons.some((s) => s.includes('breadth'))).toBe(true);
  });

  it('returns transitional when breadth is bullish but trend is mid', () => {
    const r = unwrap(
      detectRegime(
        baseFeatures({ trendBps: 100, breadthBps: 6_500 }),
        baseThresholds(),
      ),
    );
    expect(r.regime).toBe('transitional');
    expect(r.reasons.some((s) => s.includes('trend'))).toBe(true);
  });

  it('returns transitional when both trend and breadth are mid', () => {
    const r = unwrap(
      detectRegime(
        baseFeatures({ trendBps: 100, breadthBps: 5_500 }),
        baseThresholds(),
      ),
    );
    expect(r.regime).toBe('transitional');
    expect(r.reasons.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects negative volatility', () => {
    expect(isErr(detectRegime(baseFeatures({ volatilityBps: -1 }), baseThresholds()))).toBe(true);
  });

  it('rejects non-finite volatility', () => {
    expect(
      isErr(detectRegime(baseFeatures({ volatilityBps: Number.NaN }), baseThresholds())),
    ).toBe(true);
  });

  it('rejects non-finite trend', () => {
    expect(
      isErr(detectRegime(baseFeatures({ trendBps: Number.POSITIVE_INFINITY }), baseThresholds())),
    ).toBe(true);
  });

  it('rejects breadth outside [0, 10000]', () => {
    expect(isErr(detectRegime(baseFeatures({ breadthBps: -1 }), baseThresholds()))).toBe(true);
    expect(isErr(detectRegime(baseFeatures({ breadthBps: 10_001 }), baseThresholds()))).toBe(true);
  });

  it('rejects negative highVolBps', () => {
    expect(isErr(detectRegime(baseFeatures(), baseThresholds({ highVolBps: -1 })))).toBe(true);
  });

  it('rejects non-finite bullishTrendBps', () => {
    expect(
      isErr(detectRegime(baseFeatures(), baseThresholds({ bullishTrendBps: Number.NaN }))),
    ).toBe(true);
  });

  it('rejects non-finite bearishTrendBps', () => {
    expect(
      isErr(
        detectRegime(
          baseFeatures(),
          baseThresholds({ bearishTrendBps: Number.NEGATIVE_INFINITY }),
        ),
      ),
    ).toBe(true);
  });

  it('rejects bullBreadthBps out of range', () => {
    expect(isErr(detectRegime(baseFeatures(), baseThresholds({ bullBreadthBps: 10_001 })))).toBe(
      true,
    );
  });

  it('rejects bearBreadthBps out of range', () => {
    expect(isErr(detectRegime(baseFeatures(), baseThresholds({ bearBreadthBps: -1 })))).toBe(true);
  });

  it('rejects bearishTrendBps >= bullishTrendBps', () => {
    expect(
      isErr(
        detectRegime(
          baseFeatures(),
          baseThresholds({ bearishTrendBps: 200, bullishTrendBps: 200 }),
        ),
      ),
    ).toBe(true);
    expect(
      isErr(
        detectRegime(
          baseFeatures(),
          baseThresholds({ bearishTrendBps: 300, bullishTrendBps: 200 }),
        ),
      ),
    ).toBe(true);
  });

  it('rejects bearBreadthBps >= bullBreadthBps', () => {
    expect(
      isErr(
        detectRegime(
          baseFeatures(),
          baseThresholds({ bearBreadthBps: 6_000, bullBreadthBps: 6_000 }),
        ),
      ),
    ).toBe(true);
  });
});
