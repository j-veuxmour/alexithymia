import type { RiskCheckId, RiskCheckResult, RiskPolicyDecision } from './risk.types.js';

/**
 * Compose a final policy decision from a flat list of check results.
 * The policy is conservative: any failed check denies, regardless of
 * how many others passed. The denying set is preserved so the Risk
 * Manager can pick a specific remediation per check id.
 */
export const composeRiskPolicy = (checks: readonly RiskCheckResult[]): RiskPolicyDecision => {
  const denying: RiskCheckId[] = [];
  for (let i = 0; i < checks.length; i += 1) {
    const c = checks[i] as RiskCheckResult;
    if (!c.passed) denying.push(c.id);
  }
  return {
    verdict: denying.length === 0 ? 'allow' : 'deny',
    checks,
    denyingChecks: denying,
  };
};
