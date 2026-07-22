import { z } from 'zod';
import { Sha256Schema } from '@logichub-engineering/shared';
import { CONFIDENCE_CLASSES } from '../confidence.js';
import { MissingInputSchema } from './quantity.schema.js';

/**
 * Allowed rule-result states. `unknown` is never `pass`; `requires_validation`
 * marks results that are calculable but gated on physical evidence.
 * `ambiguous` is used by the optical rule when two classes fall within the
 * ambiguity margin.
 */
export const RuleResultStatusSchema = z.enum([
  'pass',
  'warning',
  'fail',
  'ambiguous',
  'unknown',
  'error',
  'requires_validation',
]);
export type RuleResultStatus = z.infer<typeof RuleResultStatusSchema>;

export const ConfidenceClassSchema = z.enum(CONFIDENCE_CLASSES);

/** One deterministic calculation step in the trace. */
export const TraceStepSchema = z.object({
  step: z.string().min(1),
  formula: z.string().optional(),
  inputs: z.record(z.string(), z.unknown()),
  output: z.unknown(),
  unit: z.string().optional(),
});
export type TraceStep = z.infer<typeof TraceStepSchema>;

/** One named check inside a rule (a rule aggregates many checks). */
export const CheckFindingSchema = z.object({
  check: z.string().min(1),
  status: RuleResultStatusSchema,
  detail: z.string().min(1),
  threshold: z.unknown().optional(),
  observed: z.unknown().optional(),
});
export type CheckFinding = z.infer<typeof CheckFindingSchema>;

export const RuleResultSchema = z.object({
  schemaVersion: z.literal('0.1.0'),
  ruleId: z.string().min(1),
  ruleVersion: z.string().min(1),
  /** normalized inputs actually consumed (canonical units) */
  inputs: z.record(z.string(), z.unknown()),
  /** input name -> provenance string */
  inputProvenance: z.record(z.string(), z.string()),
  assumptions: z.array(z.string()),
  /** human-readable formula / deterministic procedure identifiers used */
  procedure: z.array(z.string()),
  trace: z.array(TraceStepSchema),
  thresholds: z.record(z.string(), z.unknown()),
  checks: z.array(CheckFindingSchema),
  /** headline computed metrics in canonical units (null = not computable) */
  metrics: z.record(z.string(), z.union([z.number(), z.string(), z.null()])),
  status: RuleResultStatusSchema,
  confidenceClass: ConfidenceClassSchema,
  confidenceRationale: z.string().min(1),
  unknowns: z.array(MissingInputSchema),
  warnings: z.array(z.string()),
  failureModes: z.array(z.string()),
  requiredTests: z.array(z.string()),
  affectedObjects: z.array(z.string()),
  evidenceReferences: z.array(z.string()),
  /** SHA-256 of the JCS canonical form of this result (hash field zeroed) */
  resultHash: Sha256Schema,
});
export type RuleResult = z.infer<typeof RuleResultSchema>;

/** Severity ordering for combining check statuses. Pass is weakest. */
const STATUS_SEVERITY: Record<RuleResultStatus, number> = {
  pass: 0,
  warning: 1,
  requires_validation: 2,
  ambiguous: 3,
  unknown: 4,
  fail: 5,
  error: 6,
};

/**
 * Combine check statuses into an overall rule status: the most severe wins.
 * `unknown` outranks `warning`/`requires_validation` so missing data can never
 * be laundered into a soft pass; `fail`/`error` outrank everything.
 */
export function combineStatuses(statuses: RuleResultStatus[]): RuleResultStatus {
  if (statuses.length === 0) return 'unknown';
  let worst: RuleResultStatus = 'pass';
  for (const s of statuses) {
    if (STATUS_SEVERITY[s] > STATUS_SEVERITY[worst]) worst = s;
  }
  return worst;
}
