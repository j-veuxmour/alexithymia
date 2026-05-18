import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import { enforceSingleSideSolDeploy } from '../src/single-side-deploy.js';

const validInput = {
  amountXLamports: 0n,
  amountYLamports: 500_000_000n, // 0.5 SOL
  activeBinId: 100,
  minBinId: 50,
  maxBinId: 100,
  binsAbove: 0,
};

describe('enforceSingleSideSolDeploy', () => {
  it('accepts canonical single-side SOL deploy', () => {
    const r = unwrap(enforceSingleSideSolDeploy(validInput));
    expect(r.amountYLamports).toBe(500_000_000n);
    expect(r.activeBinId).toBe(100);
    expect(r.minBinId).toBe(50);
    expect(r.maxBinId).toBe(100);
    expect(r.binsBelow).toBe(50);
  });

  it('accepts upsidePct of exactly 0', () => {
    expect(
      unwrap(enforceSingleSideSolDeploy({ ...validInput, upsidePct: 0 })).binsBelow,
    ).toBe(50);
  });

  it('rejects non-zero amountX (token side liquidity)', () => {
    expect(
      isErr(enforceSingleSideSolDeploy({ ...validInput, amountXLamports: 1n })),
    ).toBe(true);
  });

  it('rejects negative amountX', () => {
    expect(
      isErr(enforceSingleSideSolDeploy({ ...validInput, amountXLamports: -1n })),
    ).toBe(true);
  });

  it('rejects zero amountY', () => {
    expect(
      isErr(enforceSingleSideSolDeploy({ ...validInput, amountYLamports: 0n })),
    ).toBe(true);
  });

  it('rejects negative amountY', () => {
    expect(
      isErr(enforceSingleSideSolDeploy({ ...validInput, amountYLamports: -100n })),
    ).toBe(true);
  });

  it('rejects non-integer binsAbove', () => {
    expect(isErr(enforceSingleSideSolDeploy({ ...validInput, binsAbove: 1.5 }))).toBe(true);
  });

  it('rejects negative binsAbove', () => {
    expect(isErr(enforceSingleSideSolDeploy({ ...validInput, binsAbove: -1 }))).toBe(true);
  });

  it('rejects binsAbove > 0', () => {
    expect(isErr(enforceSingleSideSolDeploy({ ...validInput, binsAbove: 5 }))).toBe(true);
  });

  it('rejects non-finite upsidePct', () => {
    expect(
      isErr(enforceSingleSideSolDeploy({ ...validInput, upsidePct: Number.NaN })),
    ).toBe(true);
  });

  it('rejects non-zero upsidePct', () => {
    expect(
      isErr(enforceSingleSideSolDeploy({ ...validInput, upsidePct: 5 })),
    ).toBe(true);
  });

  it('rejects non-integer activeBinId', () => {
    expect(isErr(enforceSingleSideSolDeploy({ ...validInput, activeBinId: 1.5 }))).toBe(true);
  });

  it('rejects non-integer minBinId/maxBinId', () => {
    expect(isErr(enforceSingleSideSolDeploy({ ...validInput, minBinId: 1.5 }))).toBe(true);
    expect(isErr(enforceSingleSideSolDeploy({ ...validInput, maxBinId: 99.5 }))).toBe(true);
  });

  it('rejects minBinId > maxBinId', () => {
    expect(
      isErr(
        enforceSingleSideSolDeploy({ ...validInput, minBinId: 200, maxBinId: 100 }),
      ),
    ).toBe(true);
  });

  it('rejects maxBinId != activeBinId', () => {
    expect(
      isErr(
        enforceSingleSideSolDeploy({
          ...validInput,
          activeBinId: 100,
          minBinId: 50,
          maxBinId: 99,
        }),
      ),
    ).toBe(true);
  });
});
