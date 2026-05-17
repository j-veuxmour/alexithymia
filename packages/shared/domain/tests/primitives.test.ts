import { type Result, type ValidationError, isErr, isOk } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import {
  BasisPoints,
  MintAddress,
  PoolAddress,
  SolanaAddress,
  TxSignature,
  UnixMs,
  UnixSec,
  WalletAddress,
} from '../src/primitives.js';

// Known-good Solana mainnet addresses (length 44 base58).
const VALID_PUBKEY = 'So11111111111111111111111111111111111111112';
// A plausible-shaped tx signature (88 base58 chars).
const VALID_SIG =
  '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW';

type AddressCtor = { readonly create: (v: string) => Result<unknown, ValidationError> };

describe('Solana base58 address constructors', () => {
  const cases: ReadonlyArray<readonly [string, AddressCtor]> = [
    ['SolanaAddress', SolanaAddress],
    ['PoolAddress', PoolAddress],
    ['MintAddress', MintAddress],
    ['WalletAddress', WalletAddress],
  ];

  for (const [name, ctor] of cases) {
    it(`${name} accepts a valid base58 pubkey`, () => {
      expect(isOk(ctor.create(VALID_PUBKEY))).toBe(true);
    });
    it(`${name} rejects an invalid string`, () => {
      expect(isErr(ctor.create('not-a-real-address'))).toBe(true);
    });
    it(`${name} rejects strings containing forbidden base58 chars`, () => {
      expect(isErr(ctor.create('0OIl00000000000000000000000000000000'))).toBe(true);
    });
  }
});

describe('TxSignature', () => {
  it('accepts a valid signature shape', () => {
    expect(isOk(TxSignature.create(VALID_SIG))).toBe(true);
  });
  it('rejects too-short input', () => {
    expect(isErr(TxSignature.create('abc'))).toBe(true);
  });
});

describe('BasisPoints', () => {
  it('accepts 0..10000', () => {
    expect(isOk(BasisPoints.create(0))).toBe(true);
    expect(isOk(BasisPoints.create(10_000))).toBe(true);
    expect(isOk(BasisPoints.create(250))).toBe(true);
  });
  it('rejects out-of-range and non-integer', () => {
    expect(isErr(BasisPoints.create(-1))).toBe(true);
    expect(isErr(BasisPoints.create(10_001))).toBe(true);
    expect(isErr(BasisPoints.create(1.5))).toBe(true);
  });
});

describe('UnixMs / UnixSec', () => {
  it('accept non-negative integers', () => {
    expect(isOk(UnixMs.create(0))).toBe(true);
    expect(isOk(UnixSec.create(1_700_000_000))).toBe(true);
  });
  it('reject negatives and non-integers', () => {
    expect(isErr(UnixMs.create(-1))).toBe(true);
    expect(isErr(UnixSec.create(1.5))).toBe(true);
  });
});
