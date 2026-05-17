/**
 * Result<T, E> — explicit success/failure without throwing.
 *
 * Use Result for expected failure paths (validation, lookup misses, IO that
 * may fail). Reserve `throw` for genuinely exceptional conditions (programmer
 * error, irrecoverable invariant breaches).
 */

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const isOk = <T, E>(r: Result<T, E>): r is Ok<T> => r.ok;
export const isErr = <T, E>(r: Result<T, E>): r is Err<E> => !r.ok;

export const map = <T, U, E>(r: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
  r.ok ? ok(fn(r.value)) : r;

export const mapErr = <T, E, F>(r: Result<T, E>, fn: (error: E) => F): Result<T, F> =>
  r.ok ? r : err(fn(r.error));

export const andThen = <T, U, E>(r: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> =>
  r.ok ? fn(r.value) : r;

export const orElse = <T, E, F>(r: Result<T, E>, fn: (error: E) => Result<T, F>): Result<T, F> =>
  r.ok ? r : fn(r.error);

export const unwrap = <T, E>(r: Result<T, E>): T => {
  if (r.ok) return r.value;
  if (r.error instanceof Error) throw r.error;
  throw new Error(`Result.unwrap on Err: ${String(r.error)}`);
};

export const unwrapOr = <T, E>(r: Result<T, E>, fallback: T): T => (r.ok ? r.value : fallback);

export const unwrapOrElse = <T, E>(r: Result<T, E>, fn: (error: E) => T): T =>
  r.ok ? r.value : fn(r.error);

export const fromThrowable = <T>(fn: () => T): Result<T, unknown> => {
  try {
    return ok(fn());
  } catch (e) {
    return err(e);
  }
};

export const fromPromise = async <T>(p: Promise<T>): Promise<Result<T, unknown>> => {
  try {
    return ok(await p);
  } catch (e) {
    return err(e);
  }
};

/**
 * Short-circuit on first Err. Returns all values in input order on success.
 */
export const all = <T, E>(results: readonly Result<T, E>[]): Result<T[], E> => {
  const values: T[] = [];
  for (const r of results) {
    if (!r.ok) return r;
    values.push(r.value);
  }
  return ok(values);
};
