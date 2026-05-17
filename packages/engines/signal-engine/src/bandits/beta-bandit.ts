import { err, ok, type Result, ValidationError } from '@alexithymia/shared-errors';
import type { BetaArm } from '../signal.types.js';

const validatePositive = (value: number, field: string): Result<void, ValidationError> => {
  if (!Number.isFinite(value) || value <= 0) {
    return err(
      new ValidationError(`${field} must be a positive finite number`, { context: { value } }),
    );
  }
  return ok(undefined);
};

/**
 * Create a Beta-distributed arm. Default prior Beta(1, 1) is uniform —
 * implies zero observations and maximum uncertainty.
 */
export const createArm = (
  id: string,
  priorAlpha: number = 1,
  priorBeta: number = 1,
): Result<BetaArm, ValidationError> => {
  if (id.length === 0) {
    return err(new ValidationError('id must be a non-empty string'));
  }
  const a = validatePositive(priorAlpha, 'priorAlpha');
  if (!a.ok) return a;
  const b = validatePositive(priorBeta, 'priorBeta');
  if (!b.ok) return b;
  return ok({ id, alpha: priorAlpha, beta: priorBeta });
};

/** Record one win observation: α ← α + 1. */
export const recordWin = (arm: BetaArm): BetaArm => ({
  id: arm.id,
  alpha: arm.alpha + 1,
  beta: arm.beta,
});

/** Record one loss observation: β ← β + 1. */
export const recordLoss = (arm: BetaArm): BetaArm => ({
  id: arm.id,
  alpha: arm.alpha,
  beta: arm.beta + 1,
});

/** Posterior mean reward of the arm: α / (α + β). */
export const meanReward = (arm: BetaArm): number => arm.alpha / (arm.alpha + arm.beta);

/** Total observations supporting the arm's posterior. */
export const observationCount = (arm: BetaArm): number =>
  arm.alpha + arm.beta - 2; // subtract the Beta(1, 1) prior
