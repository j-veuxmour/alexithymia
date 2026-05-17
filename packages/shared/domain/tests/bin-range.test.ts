import { isErr, isOk, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import { BinRange } from '../src/value-objects/bin-range.vo.js';

describe('BinRange', () => {
  it('accepts a valid range', () => {
    expect(isOk(BinRange.create(-10, 10))).toBe(true);
    expect(isOk(BinRange.create(0, 0))).toBe(true);
  });

  it('rejects non-integer bounds', () => {
    expect(isErr(BinRange.create(1.5, 10))).toBe(true);
    expect(isErr(BinRange.create(-1, 10.5))).toBe(true);
  });

  it('rejects out-of-range bounds', () => {
    expect(isErr(BinRange.create(BinRange.MIN_BIN_ID - 1, 0))).toBe(true);
    expect(isErr(BinRange.create(0, BinRange.MAX_BIN_ID + 1))).toBe(true);
  });

  it('rejects lower > upper', () => {
    expect(isErr(BinRange.create(5, 4))).toBe(true);
  });

  it('width is inclusive', () => {
    const r = unwrap(BinRange.create(-2, 2));
    expect(BinRange.width(r)).toBe(5);
  });

  it('contains is inclusive on both ends', () => {
    const r = unwrap(BinRange.create(-2, 2));
    expect(BinRange.contains(r, -2)).toBe(true);
    expect(BinRange.contains(r, 0)).toBe(true);
    expect(BinRange.contains(r, 2)).toBe(true);
    expect(BinRange.contains(r, 3)).toBe(false);
    expect(BinRange.contains(r, -3)).toBe(false);
  });
});
