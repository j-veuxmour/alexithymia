import { err, ok, type Result, ValidationError } from '@alexithymia/shared-errors';
import type { BetaArm, RNG } from '../signal.types.js';

/**
 * Box-Muller transform: two uniforms → one standard normal.
 *
 * Uses the polar branch; consumes two RNG draws per sample. Guards against
 * the rare `u1 === 0` case (log undefined) by re-drawing.
 */
const normalSample = (rng: RNG): number => {
  let u1 = rng();
  while (u1 === 0) u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

/**
 * Marsaglia–Tsang squeeze method for Gamma(k, 1) sampling.
 *
 * For shape k < 1 uses Stuart's boost: G(k) ≡ G(k+1) · U^(1/k).
 * For shape k ≥ 1, the squeeze step accepts ~96 % of proposals; the slow
 * path uses the exact log-density comparison.
 */
const gammaSample = (k: number, rng: RNG): number => {
  if (k < 1) {
    const g = gammaSample(k + 1, rng);
    let u = rng();
    while (u === 0) u = rng();
    return g * u ** (1 / k);
  }
  const d = k - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  // Bounded-attempt loop; in practice ~2 iterations are needed.
  for (let attempts = 0; attempts < 1_000; attempts += 1) {
    const x = normalSample(rng);
    const v = (1 + c * x) ** 3;
    if (v <= 0) continue;
    const u = rng();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x ** 2 + d * (1 - v + Math.log(v))) return d * v;
  }
  // Numerical accident; surface rather than spin forever.
  throw new Error('gammaSample: exceeded attempt budget');
};

/**
 * Draw one sample from Beta(α, β) using the Gamma-ratio identity:
 *
 *   B(α, β) ≡ G(α) / (G(α) + G(β))
 *
 * Returns Err for non-positive parameters. The caller supplies the RNG so
 * tests can be deterministic.
 */
export const sampleBeta = (
  alpha: number,
  beta: number,
  rng: RNG,
): Result<number, ValidationError> => {
  if (!Number.isFinite(alpha) || alpha <= 0) {
    return err(
      new ValidationError('alpha must be a positive finite number', { context: { alpha } }),
    );
  }
  if (!Number.isFinite(beta) || beta <= 0) {
    return err(
      new ValidationError('beta must be a positive finite number', { context: { beta } }),
    );
  }
  const x = gammaSample(alpha, rng);
  const y = gammaSample(beta, rng);
  return ok(x / (x + y));
};

/**
 * Thompson-sample one arm: draw one Beta sample per arm, return the arm
 * with the highest sample. Pure deterministic given the RNG. Returns Err
 * on empty input or invalid arm parameters.
 */
export const pickArm = (
  arms: readonly BetaArm[],
  rng: RNG,
): Result<BetaArm, ValidationError> => {
  if (arms.length === 0) {
    return err(new ValidationError('pickArm requires at least one arm'));
  }
  let best: BetaArm | null = null;
  let bestSample = -Infinity;
  for (let i = 0; i < arms.length; i += 1) {
    const arm = arms[i] as BetaArm;
    const sample = sampleBeta(arm.alpha, arm.beta, rng);
    if (!sample.ok) {
      return err(
        new ValidationError(`invalid Beta parameters on arm "${arm.id}"`, {
          cause: sample.error,
        }),
      );
    }
    if (sample.value > bestSample) {
      bestSample = sample.value;
      best = arm;
    }
  }
  // Unreachable: arms.length > 0 guarantees at least one iteration.
  return ok(best as BetaArm);
};
