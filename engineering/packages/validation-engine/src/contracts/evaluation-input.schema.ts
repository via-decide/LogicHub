import { z } from 'zod';

/**
 * Intent capture — every evaluation records what decision was being made,
 * over which objects, preserving which constraints, with which assumptions
 * and known-missing inputs.
 */
export const EvaluationIntentSchema = z.object({
  productId: z.string().min(1),
  productRevision: z.string().min(1),
  evaluationId: z.string().min(1),
  requestedDecision: z.string().min(1),
  targetObjects: z.array(z.string()),
  preservedConstraints: z.array(z.string()),
  optimizationTargets: z.array(z.string()),
  permittedChanges: z.array(z.string()),
  prohibitedChanges: z.array(z.string()),
  knownAssumptions: z.array(z.string()),
  missingInputs: z.array(z.string()),
  evidenceSources: z.array(z.string()),
  evaluationProfile: z.string().min(1),
  ruleVersions: z.record(z.string(), z.string()),
});
export type EvaluationIntent = z.infer<typeof EvaluationIntentSchema>;
