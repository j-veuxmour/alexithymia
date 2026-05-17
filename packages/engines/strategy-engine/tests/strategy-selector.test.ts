import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import { selectStrategy } from '../src/strategy-selector.js';
import type {
  NarrativeClass,
  RegimeLabel,
  StrategySelectionInputs,
} from '../src/strategy.types.js';

const inputs = (overrides: Partial<StrategySelectionInputs> = {}): StrategySelectionInputs => ({
  regime: 'transitional',
  volatility: 100,
  ...overrides,
});

describe('selectStrategy', () => {
  it('risk-off → single_side_sol_bid_ask regardless of volatility', () => {
    expect(unwrap(selectStrategy(inputs({ regime: 'risk-off', volatility: 0 }))).id).toBe(
      'single_side_sol_bid_ask',
    );
    expect(unwrap(selectStrategy(inputs({ regime: 'risk-off', volatility: 5_000 }))).id).toBe(
      'single_side_sol_bid_ask',
    );
  });

  it('transitional → spot_balanced', () => {
    expect(unwrap(selectStrategy(inputs({ regime: 'transitional' }))).id).toBe('spot_balanced');
  });

  it('risk-on + low volatility → curve_narrow', () => {
    expect(unwrap(selectStrategy(inputs({ regime: 'risk-on', volatility: 500 }))).id).toBe(
      'curve_narrow',
    );
  });

  it('risk-on + high volatility + memecoin → single_sided_reseed', () => {
    expect(
      unwrap(
        selectStrategy(inputs({ regime: 'risk-on', volatility: 1_500, narrative: 'memecoin' })),
      ).id,
    ).toBe('single_sided_reseed');
  });

  it('risk-on + high volatility + non-memecoin → bid_ask_wide', () => {
    expect(
      unwrap(selectStrategy(inputs({ regime: 'risk-on', volatility: 1_500, narrative: 'defi' })))
        .id,
    ).toBe('bid_ask_wide');
  });

  it('risk-on + high volatility + undefined narrative → bid_ask_wide', () => {
    expect(unwrap(selectStrategy(inputs({ regime: 'risk-on', volatility: 1_500 }))).id).toBe(
      'bid_ask_wide',
    );
  });

  it('risk-on at exactly the high-vol threshold takes the high-vol branch', () => {
    expect(unwrap(selectStrategy(inputs({ regime: 'risk-on', volatility: 800 }))).id).toBe(
      'bid_ask_wide',
    );
  });

  it('rejects an unknown regime', () => {
    expect(isErr(selectStrategy({ regime: 'sideways' as RegimeLabel, volatility: 100 }))).toBe(
      true,
    );
  });

  it('rejects negative volatility', () => {
    expect(isErr(selectStrategy(inputs({ volatility: -1 })))).toBe(true);
  });

  it('rejects non-finite volatility', () => {
    expect(isErr(selectStrategy(inputs({ volatility: Number.NaN })))).toBe(true);
    expect(isErr(selectStrategy(inputs({ volatility: Number.POSITIVE_INFINITY })))).toBe(true);
  });

  it('rejects an unknown narrative when provided', () => {
    expect(
      isErr(selectStrategy(inputs({ narrative: 'speculative' as NarrativeClass }))),
    ).toBe(true);
  });

  it('accepts narrative = unknown', () => {
    expect(
      unwrap(selectStrategy(inputs({ regime: 'risk-on', volatility: 500, narrative: 'unknown' })))
        .id,
    ).toBe('curve_narrow');
  });
});
