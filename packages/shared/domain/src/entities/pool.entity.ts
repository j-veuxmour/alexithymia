import { z } from 'zod';
import { MintAddressSchema, PoolAddressSchema } from './_schemas.js';

export const PoolSchema = z.object({
  address: PoolAddressSchema,
  baseMint: MintAddressSchema,
  quoteMint: MintAddressSchema,
  baseDecimals: z.number().int().min(0).max(18),
  quoteDecimals: z.number().int().min(0).max(18),
  binStep: z.number().int().positive(),
  baseFeeBps: z.number().int().min(0).max(10_000),
  protocolFeeBps: z.number().int().min(0).max(10_000),
  tvlLamports: z.coerce.bigint().nonnegative(),
  volume24hLamports: z.coerce.bigint().nonnegative(),
  createdAt: z.coerce.date(),
  discoveredAt: z.coerce.date(),
  source: z.string(),
});

export type Pool = z.infer<typeof PoolSchema>;
