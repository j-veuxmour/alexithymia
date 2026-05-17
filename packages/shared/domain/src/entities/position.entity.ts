import { z } from 'zod';
import {
  PoolAddressSchema,
  PositionIdSchema,
  TxSignatureSchema,
  WalletAddressSchema,
} from './_schemas.js';

export const PositionStatusSchema = z.enum(['open', 'closing', 'closed', 'failed']);
export type PositionStatus = z.infer<typeof PositionStatusSchema>;

export const PositionSchema = z.object({
  id: PositionIdSchema,
  poolAddress: PoolAddressSchema,
  ownerWallet: WalletAddressSchema,
  status: PositionStatusSchema,
  lowerBinId: z.number().int(),
  upperBinId: z.number().int(),
  costBasisLamports: z.coerce.bigint().nonnegative(),
  baseTokenAmount: z.coerce.bigint().nonnegative(),
  quoteTokenAmount: z.coerce.bigint().nonnegative(),
  openedAt: z.coerce.date(),
  closedAt: z.coerce.date().nullable(),
  openTxSignature: TxSignatureSchema.nullable(),
  closeTxSignature: TxSignatureSchema.nullable(),
  strategyId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type Position = z.infer<typeof PositionSchema>;
