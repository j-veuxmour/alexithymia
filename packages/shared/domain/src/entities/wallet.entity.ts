import { z } from 'zod';
import { WalletAddressSchema, WalletIdSchema } from './_schemas.js';

/**
 * Wallet metadata. Never stores private keys or KMS-derived material —
 * that lives in the Signing Service only. The `kmsKeyRef` here is an
 * opaque pointer the signer uses to locate the actual key.
 */
export const WalletSchema = z.object({
  id: WalletIdSchema,
  address: WalletAddressSchema,
  label: z.string().min(1).max(64),
  kmsKeyRef: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export type Wallet = z.infer<typeof WalletSchema>;
