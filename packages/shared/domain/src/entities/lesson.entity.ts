import { z } from 'zod';
import { DecisionIdSchema, LessonIdSchema } from './_schemas.js';

export const LessonScopeSchema = z.enum([
  'pool-selection',
  'range-sizing',
  'exit-timing',
  'risk-management',
  'allocation',
  'narrative',
  'regime',
]);
export type LessonScope = z.infer<typeof LessonScopeSchema>;

/**
 * Forensic lesson extracted from past outcomes. The `statisticalBacking`
 * field is the structured evidence the Learning Engine produced (sample
 * size, p-value, effect size) — required, not optional.
 */
export const LessonSchema = z.object({
  id: LessonIdSchema,
  scope: LessonScopeSchema,
  statement: z.string().min(1),
  statisticalBacking: z.object({
    sampleSize: z.number().int().nonnegative(),
    pValue: z.number().min(0).max(1).nullable(),
    effectSize: z.number().nullable(),
    method: z.string(),
  }),
  sourceDecisionIds: z.array(DecisionIdSchema).default([]),
  active: z.boolean().default(true),
  createdAt: z.coerce.date(),
  retiredAt: z.coerce.date().nullable(),
});

export type Lesson = z.infer<typeof LessonSchema>;
