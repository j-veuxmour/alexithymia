import {
  type ProjectedILInput,
  projectedImpermanentLossBps,
  tvlImpactBps,
} from '@alexithymia/engine-pricing';
import { type Result, ValidationError, err, ok } from '@alexithymia/shared-errors';
import type { RiskCheckResult } from './risk.types.js';

const validateBps = (value: number, field: string): Result<void, ValidationError> => {
  if (!Number.isInteger(value) || value < 0) {
    return err(
      new ValidationError(`${field} must be a non-negative integer`, { context: { value } }),
    );
  }
  return ok(undefined);
};

/**
 * Project the candidate position's IL under the supplied price scenario
 * via Pricing Engine, then gate it against a maximum acceptable IL.
 *
 *   passed = |ilBps| ≤ maxIlBps
 *
 * IL bps may be negative (loss vs HODL); the gate uses absolute magnitude
 * since both directions of dislocation represent risk to deal with.
 */
export const checkProjectedIL = (
  scenario: ProjectedILInput,
  maxIlBps: number,
): Result<RiskCheckResult, ValidationError> => {
  const bps = validateBps(maxIlBps, 'maxIlBps');
  if (!bps.ok) return bps;

  const projected = projectedImpermanentLossBps(scenario);
  if (!projected.ok) {
    return err(
      new ValidationError('failed to project impermanent loss', { cause: projected.error }),
    );
  }
  const ilMagnitude = Math.abs(projected.value.ilBps);
  const passed = ilMagnitude <= maxIlBps;
  return ok({
    id: 'position.projected-il',
    passed,
    reason: passed
      ? `projected |IL| ${ilMagnitude} bps within cap ${maxIlBps} bps`
      : `projected |IL| ${ilMagnitude} bps exceeds cap ${maxIlBps} bps`,
    context: {
      ilBps: projected.value.ilBps,
      maxIlBps,
      lpValueLamports: projected.value.lpValueLamports,
      hodlValueLamports: projected.value.hodlValueLamports,
    },
  });
};

/**
 * Gate the candidate deposit's TVL footprint via Pricing Engine.
 *
 *   passed = deposit / preDepositTvl · 10_000 ≤ maxImpactBps
 *
 * Deny when the deposit would represent too large a share of pool TVL —
 * a signal both for adverse selection (we move the price) and for thin
 * liquidity (other LPs can exit before us).
 */
export const checkTvlImpact = (
  depositLamports: bigint,
  preDepositTvlLamports: bigint,
  maxImpactBps: number,
): Result<RiskCheckResult, ValidationError> => {
  const bps = validateBps(maxImpactBps, 'maxImpactBps');
  if (!bps.ok) return bps;

  const impact = tvlImpactBps(depositLamports, preDepositTvlLamports);
  if (!impact.ok) {
    return err(new ValidationError('failed to compute TVL impact', { cause: impact.error }));
  }
  const passed = impact.value <= maxImpactBps;
  return ok({
    id: 'position.tvl-impact',
    passed,
    reason: passed
      ? `TVL impact ${impact.value} bps within cap ${maxImpactBps} bps`
      : `TVL impact ${impact.value} bps exceeds cap ${maxImpactBps} bps`,
    context: { impactBps: impact.value, maxImpactBps },
  });
};

export interface PositionRiskInput {
  readonly ilScenario: ProjectedILInput;
  readonly maxIlBps: number;
  readonly depositLamports: bigint;
  readonly preDepositTvlLamports: bigint;
  readonly maxTvlImpactBps: number;
}

/** Run the position-level checks and return their results. */
export const evaluatePositionRisk = (
  input: PositionRiskInput,
): Result<readonly RiskCheckResult[], ValidationError> => {
  const il = checkProjectedIL(input.ilScenario, input.maxIlBps);
  if (!il.ok) return il;
  const tvl = checkTvlImpact(
    input.depositLamports,
    input.preDepositTvlLamports,
    input.maxTvlImpactBps,
  );
  if (!tvl.ok) return tvl;
  return ok([il.value, tvl.value]);
};
