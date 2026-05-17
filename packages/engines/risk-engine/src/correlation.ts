import type { MintAddress } from '@alexithymia/shared-domain';
import { type Result, ValidationError, err, ok } from '@alexithymia/shared-errors';
import type { OpenPositionRef, RiskCheckResult } from './risk.types.js';

export interface CorrelationCandidate {
  readonly baseMint: MintAddress;
  readonly quoteMint: MintAddress;
}

/**
 * Number of open positions that share either the base or the quote mint
 * with the candidate. Used as a first-line concentration proxy until
 * narrative/regime correlation arrives via Signal Engine.
 */
export const tokenOverlapCount = (
  openPositions: readonly OpenPositionRef[],
  candidate: CorrelationCandidate,
): number => {
  let count = 0;
  for (let i = 0; i < openPositions.length; i += 1) {
    const p = openPositions[i] as OpenPositionRef;
    if (p.baseMint === candidate.baseMint || p.quoteMint === candidate.quoteMint) {
      count += 1;
    } else if (p.baseMint === candidate.quoteMint || p.quoteMint === candidate.baseMint) {
      count += 1;
    }
  }
  return count;
};

/**
 * Gate concentration by token overlap. `maxOverlap` is the largest number
 * of already-open positions that may share a mint with the candidate.
 *
 *   passed = overlap ≤ maxOverlap
 */
export const checkTokenConcentration = (
  openPositions: readonly OpenPositionRef[],
  candidate: CorrelationCandidate,
  maxOverlap: number,
): Result<RiskCheckResult, ValidationError> => {
  if (!Number.isInteger(maxOverlap) || maxOverlap < 0) {
    return err(
      new ValidationError('maxOverlap must be a non-negative integer', {
        context: { maxOverlap },
      }),
    );
  }
  const overlap = tokenOverlapCount(openPositions, candidate);
  const passed = overlap <= maxOverlap;
  return ok({
    id: 'correlation.token-overlap',
    passed,
    reason: passed
      ? `token overlap ${overlap} within cap ${maxOverlap}`
      : `token overlap ${overlap} exceeds cap ${maxOverlap}`,
    context: { overlap, maxOverlap },
  });
};
