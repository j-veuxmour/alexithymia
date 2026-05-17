import { err, NotFoundError, ok, type Result } from '@alexithymia/shared-errors';
import type {
  StrategyBias,
  StrategyPreset,
  StrategyShape,
} from './strategy.types.js';

/**
 * Catalog of deterministic deploy presets. Combines four ALEXITHYMIA
 * baselines with five ported Meridian strategies (`custom_ratio_spot`,
 * `single_sided_reseed`, `fee_compounding`, `multi_layer`,
 * `partial_harvest`). Aspek lifecycle (re-seed, harvest, compound) is
 * surfaced via `lifecycle`; engine emits the parameters, agent
 * (Portfolio Manager / Strategist Manager) wires the lifecycle policy
 * into actual execution.
 */
const PRESETS: Readonly<Record<string, StrategyPreset>> = {
  single_side_sol_bid_ask: {
    id: 'single_side_sol_bid_ask',
    name: 'Single-Side SOL Bid-Ask',
    shape: 'bid-ask',
    bias: 'single-side-sol',
    lifecycle: 'none',
    binsBelowPctBps: 10_000,
    slippageBpsCap: 300,
    bestFor: 'Defensive deploys in high volatility or risk-off regimes',
    notes: 'amount_x = 0; all bins below the active bin. Closes on OOR-up.',
  },
  spot_balanced: {
    id: 'spot_balanced',
    name: 'Spot Balanced',
    shape: 'spot',
    bias: 'balanced',
    lifecycle: 'none',
    binsBelowPctBps: 5_000,
    slippageBpsCap: 200,
    bestFor: 'Transitional regimes with no clear directional read',
    notes: 'Uniform allocation across the bin range. Symmetric exposure.',
  },
  curve_narrow: {
    id: 'curve_narrow',
    name: 'Curve Narrow',
    shape: 'curve',
    bias: 'balanced',
    lifecycle: 'none',
    binsBelowPctBps: 5_000,
    slippageBpsCap: 150,
    bestFor: 'Calm risk-on regimes — concentrate liquidity for fee yield',
    notes: 'Gaussian-like concentration near the active bin. Tighter range.',
  },
  bid_ask_wide: {
    id: 'bid_ask_wide',
    name: 'Bid-Ask Wide',
    shape: 'bid-ask',
    bias: 'balanced',
    lifecycle: 'none',
    binsBelowPctBps: 5_000,
    slippageBpsCap: 350,
    bestFor: 'Volatile risk-on regimes — capture fee spikes at range edges',
    notes: 'Barbell shape; widest practical range for volatility absorption.',
  },
  // ── Ported from Meridian ──────────────────────────────────────────────
  custom_ratio_spot: {
    id: 'custom_ratio_spot',
    name: 'Custom Ratio Spot',
    shape: 'spot',
    bias: 'token-heavy',
    lifecycle: 'none',
    binsBelowPctBps: 7_500, // 75% token bias → 75% bins below
    slippageBpsCap: 250,
    bestFor: 'Expressing directional bias while earning fees both ways',
    notes:
      'bins_below:bins_above ratio expresses directional view. Default 75% token-heavy; caller may flip bias.',
  },
  single_sided_reseed: {
    id: 'single_sided_reseed',
    name: 'Single-Sided Bid-Ask + Re-seed',
    shape: 'bid-ask',
    bias: 'single-side-sol',
    lifecycle: 're-seed',
    binsBelowPctBps: 10_000,
    slippageBpsCap: 300,
    bestFor: 'Riding volatile tokens down without cutting losses',
    notes:
      'After OOR-down, redeploy token-only bid-ask at the new lower price. Full close only when token dead or after N re-seeds with declining performance.',
  },
  fee_compounding: {
    id: 'fee_compounding',
    name: 'Fee Compounding',
    shape: 'any',
    bias: 'balanced',
    lifecycle: 'compound',
    binsBelowPctBps: 5_000,
    slippageBpsCap: 200,
    bestFor: 'Stable, range-bound pools — maximize yield via fee compounding',
    notes: 'When unclaimed fees > threshold AND in range: claim_fees → add_liquidity back.',
  },
  multi_layer: {
    id: 'multi_layer',
    name: 'Multi-Layer Composite',
    shape: 'mixed',
    bias: 'balanced',
    lifecycle: 'composite',
    binsBelowPctBps: 5_000,
    slippageBpsCap: 250,
    bestFor: 'High-volume pools — sculpt a custom distribution via stacked shapes',
    notes:
      'Deploy with first shape; add-liquidity with additional shapes onto the same position. All layers share the position bin range.',
  },
  partial_harvest: {
    id: 'partial_harvest',
    name: 'Partial Harvest',
    shape: 'any',
    bias: 'balanced',
    lifecycle: 'partial-harvest',
    binsBelowPctBps: 5_000,
    slippageBpsCap: 200,
    bestFor: 'Lock in profits without fully exiting winners',
    notes: 'At return >= TP threshold: withdraw_liquidity(50%). Remainder keeps running.',
  },
};

/** Read-only handle to every preset, used by selector and listings. */
export const STRATEGY_PRESETS: Readonly<Record<string, StrategyPreset>> = PRESETS;

/** Fetch a preset by id. Returns NotFoundError when unknown. */
export const getPreset = (id: string): Result<StrategyPreset, NotFoundError> => {
  const preset = PRESETS[id];
  if (preset === undefined) {
    return err(
      new NotFoundError(`unknown strategy preset "${id}"`, {
        context: { id, available: Object.keys(PRESETS) },
      }),
    );
  }
  return ok(preset);
};

/** All presets in declaration order — stable for listings. */
export const listPresets = (): readonly StrategyPreset[] => Object.values(PRESETS);

export const listPresetsByShape = (shape: StrategyShape): readonly StrategyPreset[] =>
  Object.values(PRESETS).filter((p) => p.shape === shape);

export const listPresetsByBias = (bias: StrategyBias): readonly StrategyPreset[] =>
  Object.values(PRESETS).filter((p) => p.bias === bias);
