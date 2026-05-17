import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import {
  createArm,
  meanReward,
  observationCount,
  recordLoss,
  recordWin,
} from '../src/bandits/beta-bandit.js';

describe('createArm', () => {
  it('defaults to Beta(1, 1) — uniform prior, zero observations', () => {
    const arm = unwrap(createArm('arm-1'));
    expect(arm.id).toBe('arm-1');
    expect(arm.alpha).toBe(1);
    expect(arm.beta).toBe(1);
    expect(observationCount(arm)).toBe(0);
  });

  it('accepts explicit positive priors', () => {
    const arm = unwrap(createArm('arm-1', 5, 2));
    expect(arm.alpha).toBe(5);
    expect(arm.beta).toBe(2);
  });

  it('rejects empty id', () => {
    expect(isErr(createArm(''))).toBe(true);
  });

  it('rejects non-positive priorAlpha', () => {
    expect(isErr(createArm('a', 0, 1))).toBe(true);
    expect(isErr(createArm('a', -1, 1))).toBe(true);
  });

  it('rejects non-finite priorAlpha', () => {
    expect(isErr(createArm('a', Number.NaN, 1))).toBe(true);
    expect(isErr(createArm('a', Number.POSITIVE_INFINITY, 1))).toBe(true);
  });

  it('rejects non-positive priorBeta', () => {
    expect(isErr(createArm('a', 1, 0))).toBe(true);
  });

  it('rejects non-finite priorBeta', () => {
    expect(isErr(createArm('a', 1, Number.NaN))).toBe(true);
  });
});

describe('recordWin / recordLoss', () => {
  it('recordWin increments alpha and is immutable', () => {
    const arm = unwrap(createArm('a'));
    const after = recordWin(arm);
    expect(after.alpha).toBe(arm.alpha + 1);
    expect(after.beta).toBe(arm.beta);
    expect(arm.alpha).toBe(1); // original untouched
  });

  it('recordLoss increments beta and is immutable', () => {
    const arm = unwrap(createArm('a'));
    const after = recordLoss(arm);
    expect(after.alpha).toBe(arm.alpha);
    expect(after.beta).toBe(arm.beta + 1);
    expect(arm.beta).toBe(1);
  });

  it('preserves arm id through win/loss updates', () => {
    const arm = unwrap(createArm('momentum'));
    expect(recordWin(arm).id).toBe('momentum');
    expect(recordLoss(arm).id).toBe('momentum');
  });
});

describe('meanReward', () => {
  it('uniform prior has mean 0.5', () => {
    expect(meanReward(unwrap(createArm('a')))).toBeCloseTo(0.5, 10);
  });

  it('alpha-heavy posterior favors higher reward', () => {
    expect(meanReward(unwrap(createArm('a', 9, 1)))).toBeCloseTo(0.9, 10);
  });
});

describe('observationCount', () => {
  it('subtracts the Beta(1, 1) prior so a fresh arm has 0 obs', () => {
    expect(observationCount(unwrap(createArm('a')))).toBe(0);
  });

  it('counts each win/loss as one observation', () => {
    const arm = recordLoss(recordWin(recordWin(unwrap(createArm('a')))));
    expect(observationCount(arm)).toBe(3);
  });
});
