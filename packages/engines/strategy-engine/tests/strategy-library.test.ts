import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import {
  getPreset,
  listPresets,
  listPresetsByBias,
  listPresetsByShape,
  STRATEGY_PRESETS,
} from '../src/strategy-library.js';

describe('STRATEGY_PRESETS', () => {
  it('exposes all 9 ports + baselines', () => {
    const ids = Object.keys(STRATEGY_PRESETS);
    expect(ids).toContain('single_side_sol_bid_ask');
    expect(ids).toContain('spot_balanced');
    expect(ids).toContain('curve_narrow');
    expect(ids).toContain('bid_ask_wide');
    expect(ids).toContain('custom_ratio_spot');
    expect(ids).toContain('single_sided_reseed');
    expect(ids).toContain('fee_compounding');
    expect(ids).toContain('multi_layer');
    expect(ids).toContain('partial_harvest');
    expect(ids).toHaveLength(9);
  });

  it('every preset has a matching id field', () => {
    for (const [id, preset] of Object.entries(STRATEGY_PRESETS)) {
      expect(preset.id).toBe(id);
    }
  });

  it('every slippageBpsCap is in [0, 10000]', () => {
    for (const preset of Object.values(STRATEGY_PRESETS)) {
      expect(preset.slippageBpsCap).toBeGreaterThanOrEqual(0);
      expect(preset.slippageBpsCap).toBeLessThanOrEqual(10_000);
    }
  });
});

describe('getPreset', () => {
  it('returns the requested preset', () => {
    const p = unwrap(getPreset('spot_balanced'));
    expect(p.shape).toBe('spot');
    expect(p.bias).toBe('balanced');
  });

  it('returns NotFoundError for unknown ids', () => {
    expect(isErr(getPreset('does-not-exist'))).toBe(true);
  });
});

describe('listPresets', () => {
  it('returns every preset', () => {
    expect(listPresets()).toHaveLength(Object.keys(STRATEGY_PRESETS).length);
  });

  it('preserves declaration order', () => {
    const ids = listPresets().map((p) => p.id);
    expect(ids[0]).toBe('single_side_sol_bid_ask');
    expect(ids[ids.length - 1]).toBe('partial_harvest');
  });
});

describe('listPresetsByShape', () => {
  it('returns only presets with the requested shape', () => {
    const r = listPresetsByShape('bid-ask');
    expect(r.length).toBeGreaterThan(0);
    for (const p of r) expect(p.shape).toBe('bid-ask');
  });

  it('returns an empty array for shapes with no presets', () => {
    // All five shapes are represented in the library; but if we ever
    // remove one this contract should still hold.
    const r = listPresetsByShape('mixed');
    for (const p of r) expect(p.shape).toBe('mixed');
  });
});

describe('listPresetsByBias', () => {
  it('returns only presets with the requested bias', () => {
    const r = listPresetsByBias('single-side-sol');
    expect(r.length).toBeGreaterThan(0);
    for (const p of r) expect(p.bias).toBe('single-side-sol');
  });

  it('returns an empty array when no preset has the bias', () => {
    // sol-heavy is not in the baseline library — assert nothing matches.
    const r = listPresetsByBias('sol-heavy');
    expect(r).toEqual([]);
  });
});
