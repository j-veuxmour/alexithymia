import type { MintAddress } from '@alexithymia/shared-domain';
import type {
  CandidateFeatures,
  HardFilter,
  HardFilterResult,
} from '../signal.types.js';

const ok = (reason: string, context: Record<string, unknown> = {}): HardFilterResult => ({
  passed: true,
  reason,
  context,
});

const fail = (reason: string, context: Record<string, unknown> = {}): HardFilterResult => ({
  passed: false,
  reason,
  context,
});

/**
 * Compose multiple filters into one. Evaluates *all* filters (not
 * short-circuit) so the result enumerates every failed check — useful for
 * explainability and for distinguishing single-cause from multi-cause
 * rejections.
 */
export const combineFilters = <T>(filters: readonly HardFilter<T>[]): HardFilter<T> => {
  return (input: T): HardFilterResult => {
    const failures: HardFilterResult[] = [];
    for (let i = 0; i < filters.length; i += 1) {
      const f = filters[i] as HardFilter<T>;
      const r = f(input);
      if (!r.passed) failures.push(r);
    }
    if (failures.length === 0) {
      return ok('all filters passed');
    }
    return fail(failures.map((f) => f.reason).join('; '), {
      failed: failures.map((f) => ({ reason: f.reason, context: f.context })),
    });
  };
};

// ── Built-in candidate filter library ────────────────────────────────────

export const minTvlFilter = (thresholdLamports: bigint): HardFilter<CandidateFeatures> => {
  return (features) =>
    features.tvlLamports >= thresholdLamports
      ? ok(`TVL ${features.tvlLamports} ≥ ${thresholdLamports}`, {
          tvlLamports: features.tvlLamports,
          thresholdLamports,
        })
      : fail(`TVL ${features.tvlLamports} below floor ${thresholdLamports}`, {
          tvlLamports: features.tvlLamports,
          thresholdLamports,
        });
};

export const minAgeFilter = (thresholdMs: number): HardFilter<CandidateFeatures> => {
  return (features) =>
    features.ageMs >= thresholdMs
      ? ok(`age ${features.ageMs} ms ≥ ${thresholdMs} ms`, {
          ageMs: features.ageMs,
          thresholdMs,
        })
      : fail(`age ${features.ageMs} ms below ${thresholdMs} ms`, {
          ageMs: features.ageMs,
          thresholdMs,
        });
};

export const mintAuthorityRenouncedFilter = (): HardFilter<CandidateFeatures> => {
  return (features) =>
    features.mintAuthorityRenounced
      ? ok('mint authority renounced')
      : fail('mint authority not renounced');
};

export const freezeAuthorityRenouncedFilter = (): HardFilter<CandidateFeatures> => {
  return (features) =>
    features.freezeAuthorityRenounced
      ? ok('freeze authority renounced')
      : fail('freeze authority not renounced');
};

export const minVolume24hFilter = (thresholdLamports: bigint): HardFilter<CandidateFeatures> => {
  return (features) =>
    features.volume24hLamports >= thresholdLamports
      ? ok(`24h volume ${features.volume24hLamports} ≥ ${thresholdLamports}`, {
          volume24hLamports: features.volume24hLamports,
          thresholdLamports,
        })
      : fail(`24h volume ${features.volume24hLamports} below ${thresholdLamports}`, {
          volume24hLamports: features.volume24hLamports,
          thresholdLamports,
        });
};

export const notBlacklistedFilter = (
  blacklist: readonly MintAddress[],
): HardFilter<CandidateFeatures> => {
  // Convert to Set for O(1) lookup; branded strings compare by underlying value.
  const set = new Set<string>(blacklist as readonly string[]);
  return (features) =>
    set.has(features.baseMint as unknown as string)
      ? fail('base mint is blacklisted', { baseMint: features.baseMint })
      : ok('base mint not on blacklist', { baseMint: features.baseMint });
};
