import { z } from 'zod';
import { DecisionIdSchema } from './_schemas.js';

export const AgentKindSchema = z.enum([
  'analyst-manager',
  'portfolio-manager',
  'risk-manager',
  'strategist-manager',
  'learning-manager',
  'dispatch-officer',
]);
export type AgentKind = z.infer<typeof AgentKindSchema>;

export const DecisionActionSchema = z.enum([
  'deploy',
  'hold',
  'close',
  'claim',
  'skip',
  'swap',
  'pause',
  'resume',
]);
export type DecisionAction = z.infer<typeof DecisionActionSchema>;

/**
 * Structured agent decision record. Captures reasoning, risks weighed, and
 * rejected alternatives — explainability is non-negotiable for any LLM-driven
 * action. Inspired by Meridian's structured decision log, made first-class.
 */
export const DecisionSchema = z.object({
  id: DecisionIdSchema,
  agentKind: AgentKindSchema,
  action: DecisionActionSchema,
  subjectId: z.string().min(1),
  reasoning: z.string().min(1),
  risks: z.array(z.string()).default([]),
  rejectedAlternatives: z
    .array(
      z.object({
        action: DecisionActionSchema,
        rationale: z.string(),
      }),
    )
    .default([]),
  modelTier: z.enum(['premium', 'balanced', 'cheap', 'local']).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.coerce.date(),
});

export type Decision = z.infer<typeof DecisionSchema>;
