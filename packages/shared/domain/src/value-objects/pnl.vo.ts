declare const __pnl: unique symbol;
declare const __signedSol: unique symbol;

/**
 * Signed SOL quantity in lamports. Distinct from SolAmount (unsigned) to
 * keep the type system honest about whether negatives are allowed.
 */
export type SignedSolAmount = bigint & { readonly [__signedSol]: 'SignedSolAmount' };

/**
 * Position-level profit & loss split into realized and unrealized halves.
 * Both fields live in lamports. The brand is type-only.
 */
export type Pnl = {
  readonly realized: SignedSolAmount;
  readonly unrealized: SignedSolAmount;
} & { readonly [__pnl]: 'Pnl' };

const asSigned = (n: bigint): SignedSolAmount => n as SignedSolAmount;

export const SignedSolAmount = {
  zero: asSigned(0n),
  fromLamports: (lamports: bigint): SignedSolAmount => asSigned(lamports),
  toLamports: (s: SignedSolAmount): bigint => s as unknown as bigint,
  toSol: (s: SignedSolAmount): number => Number(s) / 1e9,
  neg: (s: SignedSolAmount): SignedSolAmount => asSigned(-(s as unknown as bigint)),
  add: (a: SignedSolAmount, b: SignedSolAmount): SignedSolAmount => asSigned(a + b),
  sub: (a: SignedSolAmount, b: SignedSolAmount): SignedSolAmount => asSigned(a - b),
  cmp: (a: SignedSolAmount, b: SignedSolAmount): -1 | 0 | 1 => {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  },
};

export const Pnl = {
  zero: { realized: SignedSolAmount.zero, unrealized: SignedSolAmount.zero } as Pnl,

  create(realized: bigint, unrealized: bigint): Pnl {
    return {
      realized: SignedSolAmount.fromLamports(realized),
      unrealized: SignedSolAmount.fromLamports(unrealized),
    } as Pnl;
  },

  total(pnl: Pnl): SignedSolAmount {
    return SignedSolAmount.add(pnl.realized, pnl.unrealized);
  },

  isProfit(pnl: Pnl): boolean {
    return Pnl.total(pnl) > 0n;
  },

  isLoss(pnl: Pnl): boolean {
    return Pnl.total(pnl) < 0n;
  },

  isBreakEven(pnl: Pnl): boolean {
    return Pnl.total(pnl) === 0n;
  },
};
