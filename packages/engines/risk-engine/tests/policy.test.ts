import { describe, expect, it } from 'vitest';
import { composeRiskPolicy } from '../src/policy.js';
import type { RiskCheckResult } from '../src/risk.types.js';

const pass = (id: RiskCheckResult['id']): RiskCheckResult => ({
  id,
  passed: true,
  reason: 'ok',
  context: {},
});

const fail = (id: RiskCheckResult['id']): RiskCheckResult => ({
  id,
  passed: false,
  reason: 'tripped',
  context: {},
});

describe('composeRiskPolicy', () => {
  it('allow when every check passes', () => {
    const r = composeRiskPolicy([pass('portfolio.drawdown'), pass('circuit.kill-switch')]);
    expect(r.verdict).toBe('allow');
    expect(r.denyingChecks).toEqual([]);
  });

  it('deny when any check fails', () => {
    const r = composeRiskPolicy([pass('portfolio.drawdown'), fail('circuit.kill-switch')]);
    expect(r.verdict).toBe('deny');
    expect(r.denyingChecks).toEqual(['circuit.kill-switch']);
  });

  it('collects every failing check, preserving order', () => {
    const r = composeRiskPolicy([
      fail('portfolio.drawdown'),
      pass('portfolio.daily-loss-cap'),
      fail('circuit.consecutive-losses'),
    ]);
    expect(r.verdict).toBe('deny');
    expect(r.denyingChecks).toEqual(['portfolio.drawdown', 'circuit.consecutive-losses']);
  });

  it('preserves all checks on the decision (not just denying ones)', () => {
    const checks: readonly RiskCheckResult[] = [
      pass('portfolio.drawdown'),
      fail('circuit.kill-switch'),
    ];
    const r = composeRiskPolicy(checks);
    expect(r.checks).toBe(checks);
  });

  it('empty input → allow with empty denyingChecks', () => {
    const r = composeRiskPolicy([]);
    expect(r.verdict).toBe('allow');
    expect(r.denyingChecks).toEqual([]);
  });
});
