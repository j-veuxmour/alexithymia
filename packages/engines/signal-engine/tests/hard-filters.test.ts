import type { MintAddress } from '@alexithymia/shared-domain';
import { describe, expect, it } from 'vitest';
import {
  combineFilters,
  freezeAuthorityRenouncedFilter,
  minAgeFilter,
  minTvlFilter,
  minVolume24hFilter,
  mintAuthorityRenouncedFilter,
  notBlacklistedFilter,
} from '../src/filters/hard-filters.js';
import type { CandidateFeatures, HardFilter } from '../src/signal.types.js';

const mint = (s: string): MintAddress => s as unknown as MintAddress;

const makeFeatures = (overrides: Partial<CandidateFeatures> = {}): CandidateFeatures => ({
  tvlLamports: 100_000_000_000n,
  ageMs: 24 * 60 * 60 * 1000,
  mintAuthorityRenounced: true,
  freezeAuthorityRenounced: true,
  baseMint: mint('So11111111111111111111111111111111111111112'),
  volume24hLamports: 50_000_000_000n,
  ...overrides,
});

describe('minTvlFilter', () => {
  it('passes when TVL meets the floor', () => {
    const r = minTvlFilter(100_000_000_000n)(makeFeatures());
    expect(r.passed).toBe(true);
  });

  it('passes at exactly the floor', () => {
    const r = minTvlFilter(100_000_000_000n)(makeFeatures({ tvlLamports: 100_000_000_000n }));
    expect(r.passed).toBe(true);
  });

  it('fails below the floor', () => {
    const r = minTvlFilter(200_000_000_000n)(makeFeatures());
    expect(r.passed).toBe(false);
    expect(r.context.tvlLamports).toBe(100_000_000_000n);
  });
});

describe('minAgeFilter', () => {
  it('passes when age meets the floor', () => {
    expect(minAgeFilter(60_000)(makeFeatures({ ageMs: 60_000 })).passed).toBe(true);
  });

  it('fails below the floor', () => {
    const r = minAgeFilter(60_000)(makeFeatures({ ageMs: 30_000 }));
    expect(r.passed).toBe(false);
    expect(r.context.ageMs).toBe(30_000);
  });
});

describe('mintAuthorityRenouncedFilter', () => {
  it('passes when renounced', () => {
    expect(mintAuthorityRenouncedFilter()(makeFeatures()).passed).toBe(true);
  });

  it('fails when not renounced', () => {
    expect(
      mintAuthorityRenouncedFilter()(makeFeatures({ mintAuthorityRenounced: false })).passed,
    ).toBe(false);
  });
});

describe('freezeAuthorityRenouncedFilter', () => {
  it('passes when renounced', () => {
    expect(freezeAuthorityRenouncedFilter()(makeFeatures()).passed).toBe(true);
  });

  it('fails when not renounced', () => {
    expect(
      freezeAuthorityRenouncedFilter()(makeFeatures({ freezeAuthorityRenounced: false })).passed,
    ).toBe(false);
  });
});

describe('minVolume24hFilter', () => {
  it('passes when volume meets the floor', () => {
    expect(minVolume24hFilter(50_000_000_000n)(makeFeatures()).passed).toBe(true);
  });

  it('fails below the floor', () => {
    const r = minVolume24hFilter(100_000_000_000n)(makeFeatures());
    expect(r.passed).toBe(false);
    expect(r.context.volume24hLamports).toBe(50_000_000_000n);
  });
});

describe('notBlacklistedFilter', () => {
  const SOL = mint('So11111111111111111111111111111111111111112');
  const BONK = mint('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');

  it('passes when the mint is not on the list', () => {
    expect(notBlacklistedFilter([BONK])(makeFeatures({ baseMint: SOL })).passed).toBe(true);
  });

  it('fails when the mint is on the list', () => {
    expect(notBlacklistedFilter([SOL, BONK])(makeFeatures({ baseMint: SOL })).passed).toBe(false);
  });

  it('passes against an empty blacklist', () => {
    expect(notBlacklistedFilter([])(makeFeatures()).passed).toBe(true);
  });
});

describe('combineFilters', () => {
  it('passes when every sub-filter passes', () => {
    const combined = combineFilters<CandidateFeatures>([
      minTvlFilter(1n),
      mintAuthorityRenouncedFilter(),
    ]);
    expect(combined(makeFeatures()).passed).toBe(true);
  });

  it('collects every failing sub-filter, not just the first', () => {
    const combined = combineFilters<CandidateFeatures>([
      minTvlFilter(10_000_000_000_000n),
      mintAuthorityRenouncedFilter(),
      freezeAuthorityRenouncedFilter(),
    ]);
    const r = combined(
      makeFeatures({ mintAuthorityRenounced: false, freezeAuthorityRenounced: false }),
    );
    expect(r.passed).toBe(false);
    const failed = r.context.failed as readonly { reason: string }[];
    expect(failed).toHaveLength(3);
  });

  it('an empty filter list passes trivially', () => {
    const combined = combineFilters<CandidateFeatures>([]);
    expect(combined(makeFeatures()).passed).toBe(true);
  });

  it('preserves order of failures', () => {
    const f1: HardFilter<CandidateFeatures> = () => ({
      passed: false,
      reason: 'first',
      context: {},
    });
    const f2: HardFilter<CandidateFeatures> = () => ({
      passed: true,
      reason: 'ok',
      context: {},
    });
    const f3: HardFilter<CandidateFeatures> = () => ({
      passed: false,
      reason: 'third',
      context: {},
    });
    const r = combineFilters([f1, f2, f3])(makeFeatures());
    expect(r.reason).toBe('first; third');
  });
});
