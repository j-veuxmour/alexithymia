import { type Result, ValidationError, err, ok } from '@alexithymia/shared-errors';
import { valueInLamports } from './cost-basis.js';
import type { ILResult, PriceLamports, TokenAmount } from './pricing.types.js';

/**
 * Combined lamport-SOL value of a two-token LP position at the supplied
 * prices. Forwards validation to `valueInLamports` per leg.
 */
export const lpValueLamports = (
  base: TokenAmount,
  quote: TokenAmount,
  basePriceLamports: PriceLamports,
  quotePriceLamports: PriceLamports,
): Result<bigint, ValidationError> => {
  const baseValue = valueInLamports({ ...base, priceLamports: basePriceLamports });
  if (!baseValue.ok) return baseValue;
  const quoteValue = valueInLamports({ ...quote, priceLamports: quotePriceLamports });
  if (!quoteValue.ok) return quoteValue;
  return ok(baseValue.value + quoteValue.value);
};

/**
 * Value of the *initial* position composition at *current* prices —
 * i.e. the counterfactual "what if we had just held the deposited tokens".
 */
export const hodlValueLamports = (
  initialBase: TokenAmount,
  initialQuote: TokenAmount,
  currentBasePriceLamports: PriceLamports,
  currentQuotePriceLamports: PriceLamports,
): Result<bigint, ValidationError> => {
  return lpValueLamports(
    initialBase,
    initialQuote,
    currentBasePriceLamports,
    currentQuotePriceLamports,
  );
};

/**
 * Impermanent loss in basis points:
 *
 *   il_bps = (lp - hodl) / hodl * 10_000
 *
 * Negative ⇒ LP underperforms HODL (the usual case). Positive ⇒ LP
 * outperforms HODL (e.g. after fees in mean-reverting price action).
 *
 * Returns Err when `hodl ≤ 0` (no baseline to compare against).
 *
 * Rounded with banker's truncation toward zero; the bps grain is well
 * below the precision a strategy can act on.
 */
export const impermanentLossBps = (
  lpValueLamports: bigint,
  hodlValueLamports: bigint,
): Result<number, ValidationError> => {
  if (hodlValueLamports <= 0n) {
    return err(
      new ValidationError('hodlValueLamports must be > 0', {
        context: { hodlValueLamports },
      }),
    );
  }
  if (lpValueLamports < 0n) {
    return err(
      new ValidationError('lpValueLamports must be non-negative', {
        context: { lpValueLamports },
      }),
    );
  }
  // (lp - hodl) * 10000 / hodl — keep bigint for precision, then narrow.
  const numerator = (lpValueLamports - hodlValueLamports) * 10_000n;
  const bps = numerator / hodlValueLamports;
  return ok(Number(bps));
};

export interface CurrentILInput {
  readonly initialBase: TokenAmount;
  readonly initialQuote: TokenAmount;
  readonly currentBase: TokenAmount;
  readonly currentQuote: TokenAmount;
  readonly currentBasePriceLamports: PriceLamports;
  readonly currentQuotePriceLamports: PriceLamports;
}

/** Convenience wrapper: compute LP value, HODL value, and IL in one call. */
export const computeCurrentIL = (input: CurrentILInput): Result<ILResult, ValidationError> => {
  const lp = lpValueLamports(
    input.currentBase,
    input.currentQuote,
    input.currentBasePriceLamports,
    input.currentQuotePriceLamports,
  );
  if (!lp.ok) return lp;
  const hodl = hodlValueLamports(
    input.initialBase,
    input.initialQuote,
    input.currentBasePriceLamports,
    input.currentQuotePriceLamports,
  );
  if (!hodl.ok) return hodl;
  const bps = impermanentLossBps(lp.value, hodl.value);
  if (!bps.ok) return bps;
  return ok({
    lpValueLamports: lp.value,
    hodlValueLamports: hodl.value,
    ilBps: bps.value,
  });
};

export interface ProjectedILInput {
  readonly initialBase: TokenAmount;
  readonly initialQuote: TokenAmount;
  /** Position composition predicted by the DLMM rebalance at the scenario price. */
  readonly simulatedBase: TokenAmount;
  readonly simulatedQuote: TokenAmount;
  readonly scenarioBasePriceLamports: PriceLamports;
  readonly scenarioQuotePriceLamports: PriceLamports;
}

/**
 * Project IL for a hypothetical future state. The caller (DLMM Engine) is
 * responsible for computing `simulatedBase` / `simulatedQuote` consistent
 * with how the position would rebalance at `scenarioPrice`. This engine
 * only does the valuation arithmetic.
 */
export const projectedImpermanentLossBps = (
  input: ProjectedILInput,
): Result<ILResult, ValidationError> => {
  return computeCurrentIL({
    initialBase: input.initialBase,
    initialQuote: input.initialQuote,
    currentBase: input.simulatedBase,
    currentQuote: input.simulatedQuote,
    currentBasePriceLamports: input.scenarioBasePriceLamports,
    currentQuotePriceLamports: input.scenarioQuotePriceLamports,
  });
};
