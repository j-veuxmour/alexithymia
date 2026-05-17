import { describe, expect, it } from 'vitest';
import {
  all,
  andThen,
  err,
  fromPromise,
  fromThrowable,
  isErr,
  isOk,
  map,
  mapErr,
  ok,
  orElse,
  unwrap,
  unwrapOr,
  unwrapOrElse,
} from '../src/result.js';

describe('Result', () => {
  it('ok and err carry their payloads', () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
    expect(err('nope')).toEqual({ ok: false, error: 'nope' });
  });

  it('isOk and isErr narrow correctly', () => {
    const a = ok(1);
    const b = err('x');
    expect(isOk(a)).toBe(true);
    expect(isErr(a)).toBe(false);
    expect(isOk(b)).toBe(false);
    expect(isErr(b)).toBe(true);
  });

  describe('map', () => {
    it('transforms Ok value', () => {
      expect(map(ok(2), (n) => n * 3)).toEqual(ok(6));
    });
    it('passes Err through', () => {
      expect(map(err('e'), (n: number) => n + 1)).toEqual(err('e'));
    });
  });

  describe('mapErr', () => {
    it('transforms Err value', () => {
      expect(mapErr(err('a'), (e) => `${e}!`)).toEqual(err('a!'));
    });
    it('passes Ok through', () => {
      expect(mapErr(ok(1), (e: string) => `${e}!`)).toEqual(ok(1));
    });
  });

  describe('andThen', () => {
    it('chains Ok through fn returning Result', () => {
      const r = andThen(ok(2), (n) => (n > 0 ? ok(n + 1) : err('neg')));
      expect(r).toEqual(ok(3));
    });
    it('short-circuits on Err', () => {
      const r = andThen(err<string>('start'), (n: number) => ok(n));
      expect(r).toEqual(err('start'));
    });
  });

  describe('orElse', () => {
    it('recovers from Err', () => {
      const r = orElse(err('bad'), (e) => ok(`recovered:${e}`));
      expect(r).toEqual(ok('recovered:bad'));
    });
    it('passes Ok through', () => {
      const r = orElse(ok(1), (_e: string) => ok(99));
      expect(r).toEqual(ok(1));
    });
  });

  describe('unwrap family', () => {
    it('unwrap returns Ok value', () => {
      expect(unwrap(ok(7))).toBe(7);
    });
    it('unwrap throws Error from Err', () => {
      const e = new Error('boom');
      expect(() => unwrap(err(e))).toThrow(e);
    });
    it('unwrap wraps non-Error Err in Error', () => {
      expect(() => unwrap(err('bad'))).toThrow(/bad/);
    });
    it('unwrapOr returns fallback on Err', () => {
      expect(unwrapOr(err('e'), 5)).toBe(5);
      expect(unwrapOr(ok(7), 5)).toBe(7);
    });
    it('unwrapOrElse invokes fn on Err', () => {
      expect(unwrapOrElse(err<string>('e'), (s) => s.length)).toBe(1);
      expect(unwrapOrElse(ok(7), (_s: string) => 0)).toBe(7);
    });
  });

  describe('fromThrowable', () => {
    it('captures return value as Ok', () => {
      expect(fromThrowable(() => 1)).toEqual(ok(1));
    });
    it('captures thrown value as Err', () => {
      const r = fromThrowable(() => {
        throw new Error('x');
      });
      expect(isErr(r)).toBe(true);
    });
  });

  describe('fromPromise', () => {
    it('captures resolved value', async () => {
      await expect(fromPromise(Promise.resolve(1))).resolves.toEqual(ok(1));
    });
    it('captures rejected reason', async () => {
      const r = await fromPromise(Promise.reject(new Error('no')));
      expect(isErr(r)).toBe(true);
    });
  });

  describe('all', () => {
    it('aggregates Oks in order', () => {
      const r = all([ok(1), ok(2), ok(3)]);
      expect(r).toEqual(ok([1, 2, 3]));
    });
    it('short-circuits on first Err', () => {
      const r = all([ok(1), err('boom'), ok(3)]);
      expect(r).toEqual(err('boom'));
    });
    it('returns ok([]) on empty input', () => {
      expect(all([])).toEqual(ok([]));
    });
  });
});
