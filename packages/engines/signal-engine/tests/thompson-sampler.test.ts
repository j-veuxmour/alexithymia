import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import type { BetaArm, RNG } from '../src/signal.types.js';
import { pickArm, sampleBeta } from '../src/bandits/thompson-sampler.js';

/**
 * Deterministic, seedable RNG (mulberry32). The Thompson sampler is
 * non-trivially stochastic; pinning the RNG keeps tests reproducible
 * and lets us exercise specific branches without flakiness.
 */
const mulberry32 = (seed: number): RNG => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Build a synthetic RNG that returns the given queued values, then falls
 * back to mulberry32 once the queue is drained. Lets us craft specific
 * retry branches (u1=0, u=0) deterministically.
 */
const queuedRng = (queue: readonly number[], seed: number): RNG => {
  let i = 0;
  const fallback = mulberry32(seed);
  return () => {
    if (i < queue.length) {
      const v = queue[i] as number;
      i += 1;
      return v;
    }
    return fallback();
  };
};

describe('sampleBeta', () => {
  it('produces samples in [0, 1] for valid parameters', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 200; i += 1) {
      const s = unwrap(sampleBeta(2, 3, rng));
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic given the same RNG seed', () => {
    const a = unwrap(sampleBeta(2, 5, mulberry32(7)));
    const b = unwrap(sampleBeta(2, 5, mulberry32(7)));
    expect(a).toBe(b);
  });

  it('mean of many samples is near α / (α+β)', () => {
    const rng = mulberry32(1234);
    let sum = 0;
    const n = 5_000;
    for (let i = 0; i < n; i += 1) {
      sum += unwrap(sampleBeta(8, 2, rng));
    }
    // Posterior mean 0.8 ± ~0.02 with n=5000 — generous tolerance.
    expect(sum / n).toBeCloseTo(0.8, 1);
  });

  it('exercises the Stuart-boost branch when alpha < 1', () => {
    const rng = mulberry32(99);
    const s = unwrap(sampleBeta(0.5, 0.5, rng));
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });

  it('retries when normalSample draws u1 = 0', () => {
    // First two normalSample draws return 0 in the u1 slot, forcing the
    // `while (u1 === 0)` retry; the loop then resumes with valid values.
    const rng = queuedRng([0, 0, 0], 11);
    const s = unwrap(sampleBeta(0.5, 2, rng));
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });

  it('retries when the Stuart-boost factor u draws 0 (k<1 path)', () => {
    // gammaSample(0.5, rng) recursively calls gammaSample(1.5, rng) first
    // (3 draws to accept fast), then draws u for the boost factor. A 0
    // there triggers the `while (u === 0) u = rng()` retry on line 28.
    const rng = queuedRng(
      [
        0.5, 0.5, 0.1, // inner gammaSample(1.5, ...) accepts fast: u1, u2, u
        0, // boost factor u → retry
        0.7, // resumed boost factor u
      ],
      31,
    );
    const s = unwrap(sampleBeta(0.5, 2, rng));
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });

  it('exercises the v <= 0 continue branch in Marsaglia-Tsang', () => {
    // For k = 1.5, d ≈ 1.1667, c ≈ 0.3086. A negative x with magnitude >
    // 1/c (~3.24) makes v = (1 + c·x)^3 negative, triggering the continue
    // on line 37. u1 = 0.001 + u2 = 0.5 produces x ≈ -3.72 via Box-Muller.
    const rng = queuedRng([0.001, 0.5], 7);
    const s = unwrap(sampleBeta(1.5, 1.5, rng));
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });

  it('rejects non-positive alpha', () => {
    expect(isErr(sampleBeta(0, 1, mulberry32(0)))).toBe(true);
    expect(isErr(sampleBeta(-1, 1, mulberry32(0)))).toBe(true);
  });

  it('rejects non-finite alpha', () => {
    expect(isErr(sampleBeta(Number.NaN, 1, mulberry32(0)))).toBe(true);
    expect(isErr(sampleBeta(Number.POSITIVE_INFINITY, 1, mulberry32(0)))).toBe(true);
  });

  it('rejects non-positive beta', () => {
    expect(isErr(sampleBeta(1, 0, mulberry32(0)))).toBe(true);
    expect(isErr(sampleBeta(1, -1, mulberry32(0)))).toBe(true);
  });

  it('rejects non-finite beta', () => {
    expect(isErr(sampleBeta(1, Number.NaN, mulberry32(0)))).toBe(true);
  });

  it('throws when the Marsaglia-Tsang loop exhausts its attempt budget', () => {
    // An RNG that returns NaN makes every acceptance comparison false,
    // so the squeeze loop can never settle. Surfaces the bounded-attempt
    // guard rather than spinning forever.
    const nanRng: RNG = () => Number.NaN;
    expect(() => sampleBeta(4, 2, nanRng)).toThrow(/attempt budget/);
  });
});

describe('pickArm', () => {
  const makeArm = (id: string, a: number, b: number): BetaArm => ({ id, alpha: a, beta: b });

  it('returns one of the input arms', () => {
    const arms = [makeArm('a', 5, 2), makeArm('b', 1, 4), makeArm('c', 3, 3)];
    const winner = unwrap(pickArm(arms, mulberry32(123)));
    expect(arms.map((x) => x.id)).toContain(winner.id);
  });

  it('over many draws, prefers the arm with the highest mean reward', () => {
    const arms = [
      makeArm('strong', 90, 10), // mean 0.9
      makeArm('weak', 10, 90), // mean 0.1
    ];
    const rng = mulberry32(7);
    const counts: Record<string, number> = { strong: 0, weak: 0 };
    for (let i = 0; i < 500; i += 1) {
      const winner = unwrap(pickArm(arms, rng));
      counts[winner.id] = (counts[winner.id] ?? 0) + 1;
    }
    const strong = counts.strong ?? 0;
    const weak = counts.weak ?? 0;
    expect(strong).toBeGreaterThan(weak * 5);
  });

  it('is deterministic given the same RNG seed', () => {
    const arms = [makeArm('a', 4, 2), makeArm('b', 2, 4)];
    expect(unwrap(pickArm(arms, mulberry32(42))).id).toBe(
      unwrap(pickArm(arms, mulberry32(42))).id,
    );
  });

  it('errors on empty arm list', () => {
    expect(isErr(pickArm([], mulberry32(0)))).toBe(true);
  });

  it('propagates Err when an arm has invalid Beta parameters', () => {
    const arms = [makeArm('a', 1, 1), makeArm('bad', 0, 1)];
    expect(isErr(pickArm(arms, mulberry32(0)))).toBe(true);
  });

  it('single arm wins by default', () => {
    expect(unwrap(pickArm([makeArm('only', 1, 1)], mulberry32(0))).id).toBe('only');
  });
});
