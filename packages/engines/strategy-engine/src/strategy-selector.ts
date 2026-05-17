import { err, ok, type Result, ValidationError } from '@alexithymia/shared-errors';
import { getPreset } from './strategy-library.js';
import type {
  NarrativeClass,
  RegimeLabel,
  StrategyPreset,
  StrategySelectionInputs,
} from './strategy.types.js';

const VALID_REGIMES: ReadonlySet<RegimeLabel> = new Set<RegimeLabel>([
  'risk-on',
  'risk-off',
  'transitional',
]);

const VALID_NARRATIVES: ReadonlySet<NarrativeClass> = new Set<NarrativeClass>([
  'memecoin',
  'ai-agent',
  'gaming',
  'defi',
  'rwa',
  'unknown',
]);

/** Volatility threshold (caller's unit) above which a regime is treated as
 *  "high volatility" for selector purposes. Calibrated against the regime
 *  detector's default `highVolBps` of 800. */
const HIGH_VOL_THRESHOLD = 800;

/**
 * Rule-based preset selection. Deterministic, explainable, no LLM.
 *
 *   risk-off                            → single_side_sol_bid_ask (defensive)
 *   risk-on  & low vol                  → curve_narrow            (concentrate)
 *   risk-on  & high vol & memecoin      → single_sided_reseed     (DCA-out path)
 *   risk-on  & high vol & other         → bid_ask_wide            (capture edges)
 *   transitional                        → spot_balanced           (neutral)
 *
 * The Strategist Manager LLM remains free to override with richer
 * narrative context; this is the deterministic baseline a worker can
 * pick without any model invocation.
 */
export const selectStrategy = (
  inputs: StrategySelectionInputs,
): Result<StrategyPreset, ValidationError> => {
  if (!VALID_REGIMES.has(inputs.regime)) {
    return err(
      new ValidationError(`unknown regime "${inputs.regime}"`, {
        context: { regime: inputs.regime },
      }),
    );
  }
  if (!Number.isFinite(inputs.volatility) || inputs.volatility < 0) {
    return err(
      new ValidationError('volatility must be a non-negative finite number', {
        context: { volatility: inputs.volatility },
      }),
    );
  }
  if (inputs.narrative !== undefined && !VALID_NARRATIVES.has(inputs.narrative)) {
    return err(
      new ValidationError(`unknown narrative "${inputs.narrative}"`, {
        context: { narrative: inputs.narrative },
      }),
    );
  }

  const highVol = inputs.volatility >= HIGH_VOL_THRESHOLD;

  let presetId: string;
  if (inputs.regime === 'risk-off') {
    presetId = 'single_side_sol_bid_ask';
  } else if (inputs.regime === 'transitional') {
    presetId = 'spot_balanced';
  } else if (highVol && inputs.narrative === 'memecoin') {
    presetId = 'single_sided_reseed';
  } else if (highVol) {
    presetId = 'bid_ask_wide';
  } else {
    presetId = 'curve_narrow';
  }

  const preset = getPreset(presetId);
  // Every branch above maps to a baseline preset shipped in the library,
  // so this surface is unreachable in practice — kept as a defense-in-depth
  // guard against future selector edits.
  /* v8 ignore start */
  if (!preset.ok) {
    return err(
      new ValidationError(`selector chose unknown preset "${presetId}"`, {
        cause: preset.error,
      }),
    );
  }
  /* v8 ignore stop */
  return ok(preset.value);
};
