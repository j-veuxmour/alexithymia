import { type Result, ValidationError, err, ok } from '@alexithymia/shared-errors';
import type { SolAmount } from './sol-amount.vo.js';

declare const __riskBudget: unique symbol;

/**
 * Hard ceilings the portfolio must respect. Bps fields live in [0, 10_000].
 *
 *  - maxDrawdownBps: kill-switch threshold on peak-to-trough portfolio drop.
 *  - dailyLossCap: hard cap on net loss within a UTC trading day (lamports).
 *  - maxExposureBps: fraction of portfolio that may be deployed at once.
 *
 * Brand is type-only.
 */
export type RiskBudget = {
  readonly maxDrawdownBps: number;
  readonly dailyLossCap: SolAmount;
  readonly maxExposureBps: number;
} & { readonly [__riskBudget]: 'RiskBudget' };

const isBps = (n: number): boolean => Number.isInteger(n) && n >= 0 && n <= 10_000;

export interface RiskBudgetInput {
  readonly maxDrawdownBps: number;
  readonly dailyLossCap: SolAmount;
  readonly maxExposureBps: number;
}

export const RiskBudget = {
  create(input: RiskBudgetInput): Result<RiskBudget, ValidationError> {
    if (!isBps(input.maxDrawdownBps)) {
      return err(
        new ValidationError('maxDrawdownBps must be an integer in [0, 10000]', {
          context: { maxDrawdownBps: input.maxDrawdownBps },
        }),
      );
    }
    if (!isBps(input.maxExposureBps)) {
      return err(
        new ValidationError('maxExposureBps must be an integer in [0, 10000]', {
          context: { maxExposureBps: input.maxExposureBps },
        }),
      );
    }
    return ok({
      maxDrawdownBps: input.maxDrawdownBps,
      dailyLossCap: input.dailyLossCap,
      maxExposureBps: input.maxExposureBps,
    } as RiskBudget);
  },
};
