import { err, ok, type Result, ValidationError } from '@alexithymia/shared-errors';
import {
  type SlippageInputs,
  type SlippageResult,
  SLIPPAGE_VOLATILITY_FACTOR,
} from './strategy.types.js';

const MAX_BPS = 10_000;

// Callers only pass non-negative numbers (volatility is validated, impact
// is computed from non-negative lamports), so only the upper bound matters.
const clampBpsUpper = (n: number): number => (n > MAX_BPS ? MAX_BPS : n);

/**
 * Recommend a slippage budget in basis points.
 *
 *   volComponent = round(volatilityBps · SLIPPAGE_VOLATILITY_FACTOR)
 *   impactBps    = round((tradeSize / depth) · 10_000)
 *   raw          = max(volComponent, impactBps)            // 0..MAX_BPS
 *   recommended  = min(raw, presetSlippageBpsCap?)         // cap if set
 *
 * The `max` combinator is deliberate: each component encodes a distinct
 * risk (volatility = price drift during execution; impact = mechanical
 * AMM slippage). Taking the max gives the trade enough headroom for
 * whichever risk dominates. The preset cap is a hard ceiling — when it
 * binds, `cappedBy = 'preset-cap'` flags the trade as constrained.
 */
export const recommendSlippageBps = (
  inputs: SlippageInputs,
): Result<SlippageResult, ValidationError> => {
  if (!Number.isFinite(inputs.volatilityBps) || inputs.volatilityBps < 0) {
    return err(
      new ValidationError('volatilityBps must be a non-negative finite number', {
        context: { volatilityBps: inputs.volatilityBps },
      }),
    );
  }
  if (inputs.depthLamports <= 0n) {
    return err(
      new ValidationError('depthLamports must be positive', {
        context: { depthLamports: inputs.depthLamports },
      }),
    );
  }
  if (inputs.tradeSizeLamports < 0n) {
    return err(
      new ValidationError('tradeSizeLamports must be non-negative', {
        context: { tradeSizeLamports: inputs.tradeSizeLamports },
      }),
    );
  }
  if (inputs.presetSlippageBpsCap !== undefined) {
    if (
      !Number.isInteger(inputs.presetSlippageBpsCap) ||
      inputs.presetSlippageBpsCap < 0 ||
      inputs.presetSlippageBpsCap > MAX_BPS
    ) {
      return err(
        new ValidationError(`presetSlippageBpsCap must be an integer in [0, ${MAX_BPS}]`, {
          context: { presetSlippageBpsCap: inputs.presetSlippageBpsCap },
        }),
      );
    }
  }

  const volComponent = clampBpsUpper(Math.round(inputs.volatilityBps * SLIPPAGE_VOLATILITY_FACTOR));
  // Compute impact in bps via integer math to avoid float drift on lamport
  // values; clamp to MAX_BPS so a trade larger than the pool depth doesn't
  // produce a meaningless > 100% slippage figure.
  const impactRaw = (inputs.tradeSizeLamports * BigInt(MAX_BPS)) / inputs.depthLamports;
  const impactBps = clampBpsUpper(impactRaw > BigInt(MAX_BPS) ? MAX_BPS : Number(impactRaw));

  const raw = volComponent >= impactBps ? volComponent : impactBps;
  const dominant: 'volatility' | 'depth-impact' =
    volComponent >= impactBps ? 'volatility' : 'depth-impact';

  if (inputs.presetSlippageBpsCap !== undefined && raw > inputs.presetSlippageBpsCap) {
    return ok({
      recommendedBps: inputs.presetSlippageBpsCap,
      volComponentBps: volComponent,
      impactBps,
      cappedBy: 'preset-cap',
    });
  }
  return ok({
    recommendedBps: raw,
    volComponentBps: volComponent,
    impactBps,
    cappedBy: dominant,
  });
};
