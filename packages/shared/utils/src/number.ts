export const LAMPORTS_PER_SOL = 1_000_000_000n;

export const clamp = (n: number, min: number, max: number): number => {
  if (Number.isNaN(n)) throw new RangeError('clamp: input is NaN');
  if (min > max) throw new RangeError('clamp: min > max');
  if (n < min) return min;
  if (n > max) return max;
  return n;
};

export const clampBigInt = (n: bigint, min: bigint, max: bigint): bigint => {
  if (min > max) throw new RangeError('clampBigInt: min > max');
  if (n < min) return min;
  if (n > max) return max;
  return n;
};

export const roundTo = (n: number, decimals: number): number => {
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new RangeError('roundTo: decimals must be a non-negative integer');
  }
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
};

export const isFiniteNumber = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n);

/**
 * Lossy conversion for display only. The returned float must not be reused
 * for any on-chain math — round-trip through solToLamports would drift.
 */
export const lamportsToSol = (lamports: bigint): number => Number(lamports) / 1e9;

export const solToLamports = (sol: number): bigint => {
  if (!Number.isFinite(sol)) throw new TypeError('solToLamports: sol must be finite');
  // Round before BigInt to avoid float-precision drift on the final cast.
  return BigInt(Math.round(sol * 1e9));
};

/**
 * Multiply a lamport-denominated quantity by a basis-point fraction.
 * `bpsOf(1_000_000n, 250)` → 25_000n  (2.5 %).
 */
export const bpsOf = (value: bigint, bps: number): bigint => {
  if (!Number.isInteger(bps) || bps < 0) {
    throw new RangeError('bpsOf: bps must be a non-negative integer');
  }
  return (value * BigInt(bps)) / 10_000n;
};

/**
 * Multiply a lamport-denominated quantity by a parts-per-million fraction.
 */
export const ppmOf = (value: bigint, ppm: number): bigint => {
  if (!Number.isInteger(ppm) || ppm < 0) {
    throw new RangeError('ppmOf: ppm must be a non-negative integer');
  }
  return (value * BigInt(ppm)) / 1_000_000n;
};
