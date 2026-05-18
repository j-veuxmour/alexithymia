import { describe, expect, it } from 'vitest';
import {
  defaultProgramPolicy,
  isForbiddenIxDiscriminator,
  isProgramAllowed,
  leadingDiscriminatorHex,
  METEORA_DISCRIMINATORS,
  PROGRAM_IDS,
} from '../src/allowed-programs.js';

const fromHex = (hex: string): Uint8Array => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
};

describe('leadingDiscriminatorHex', () => {
  it('encodes first 8 bytes lower-case hex', () => {
    const data = new Uint8Array([0x00, 0x10, 0xab, 0xcd, 0x12, 0x34, 0xff, 0x01, 0x99]);
    expect(leadingDiscriminatorHex(data)).toBe('0010abcd1234ff01');
  });
  it('handles short data', () => {
    expect(leadingDiscriminatorHex(new Uint8Array([0xaa, 0xbb]))).toBe('aabb');
  });
  it('empty data → empty string', () => {
    expect(leadingDiscriminatorHex(new Uint8Array(0))).toBe('');
  });
});

describe('isProgramAllowed', () => {
  const policy = defaultProgramPolicy();
  it('whitelists Meteora DLMM', () => {
    expect(isProgramAllowed(policy, PROGRAM_IDS.METEORA_DLMM)).toBe(true);
  });
  it('whitelists Jupiter V6', () => {
    expect(isProgramAllowed(policy, PROGRAM_IDS.JUPITER_V6)).toBe(true);
  });
  it('rejects random unlisted program', () => {
    const other = PROGRAM_IDS.MEMO;
    const stripped = defaultProgramPolicy();
    // Construct a fresh policy without MEMO to confirm exclusion.
    const restricted = {
      allowedPrograms: new Set([...stripped.allowedPrograms].filter((p) => p !== other)),
      forbiddenIxDiscriminators: stripped.forbiddenIxDiscriminators,
    };
    expect(isProgramAllowed(restricted, other)).toBe(false);
  });
});

describe('isForbiddenIxDiscriminator', () => {
  const policy = defaultProgramPolicy();
  it('detects forbidden initializeBinArray', () => {
    const data = new Uint8Array(8);
    const bytes = fromHex(METEORA_DISCRIMINATORS.INITIALIZE_BIN_ARRAY);
    data.set(bytes);
    expect(isForbiddenIxDiscriminator(policy, PROGRAM_IDS.METEORA_DLMM, data)).toBe(true);
  });
  it('detects forbidden initializeBinArrayBitmapExtension with trailing payload', () => {
    const disc = fromHex(METEORA_DISCRIMINATORS.INITIALIZE_BIN_ARRAY_BITMAP_EXTENSION);
    const data = new Uint8Array([...disc, 1, 2, 3, 4]);
    expect(isForbiddenIxDiscriminator(policy, PROGRAM_IDS.METEORA_DLMM, data)).toBe(true);
  });
  it('returns false for allowed discriminator on same program', () => {
    const data = new Uint8Array([0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]);
    expect(isForbiddenIxDiscriminator(policy, PROGRAM_IDS.METEORA_DLMM, data)).toBe(false);
  });
  it('returns false for programs without any forbidden list', () => {
    const data = new Uint8Array(8);
    expect(isForbiddenIxDiscriminator(policy, PROGRAM_IDS.SYSTEM, data)).toBe(false);
  });
  it('returns false when data is shorter than 8 bytes', () => {
    expect(
      isForbiddenIxDiscriminator(policy, PROGRAM_IDS.METEORA_DLMM, new Uint8Array(4)),
    ).toBe(false);
  });
});
