/**
 * Shared zod schemas reused across entities. Mirrors the branded primitives
 * in ../primitives.ts but as bare schemas (no Result wrapping) so entity
 * schemas can compose cleanly.
 */
import { z } from 'zod';

const BASE58_PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const BASE58_SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;

export const PoolAddressSchema = z.string().regex(BASE58_PUBKEY_RE, 'invalid pool address');
export const WalletAddressSchema = z.string().regex(BASE58_PUBKEY_RE, 'invalid wallet address');
export const MintAddressSchema = z.string().regex(BASE58_PUBKEY_RE, 'invalid mint address');
export const TxSignatureSchema = z.string().regex(BASE58_SIGNATURE_RE, 'invalid tx signature');

export const PositionIdSchema = z.string().uuid();
export const DecisionIdSchema = z.string().uuid();
export const LessonIdSchema = z.string().uuid();
export const SnapshotIdSchema = z.string().uuid();
export const WalletIdSchema = z.string().uuid();
