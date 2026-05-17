import { z } from 'zod';
import { PoolAddressSchema, SnapshotIdSchema } from './_schemas.js';

/**
 * Point-in-time snapshot of all signals computed for a pool. Persisted to
 * the TimescaleDB hypertable for backtesting and lesson attribution.
 */
export const SignalSnapshotSchema = z.object({
  id: SnapshotIdSchema,
  poolAddress: PoolAddressSchema,
  capturedAt: z.coerce.date(),
  score: z.number(),
  signals: z.record(z.string(), z.number()),
  regime: z.string().nullable(),
});

export type SignalSnapshot = z.infer<typeof SignalSnapshotSchema>;
