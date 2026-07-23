import { z } from 'zod';
import { createLogicHubError } from '@logichub-engineering/shared';
import type { RuleResultStatus } from '../contracts/rule-result.schema.js';
import type { ComparisonClassification } from '../contracts/historical-case.schema.js';

/**
 * A documented outcome record supplied for comparison. The evidence class
 * matters: narrative claims and design records without executed physical
 * results can never produce agreement/detection classifications — they cap
 * at insufficient_evidence / not_applicable.
 */
export const DocumentedOutcomeSchema = z.object({
  description: z.string().min(1),
  evidenceClass: z.enum([
    'documented_physical_outcome',
    'design_record_no_outcome',
    'narrative_claim',
    'synthetic',
  ]),
  /** did the documented outcome constitute a physical failure? */
  observedFailure: z.boolean().nullable(),
});
export type DocumentedOutcome = z.infer<typeof DocumentedOutcomeSchema>;

const FAILURE_DETECTING: RuleResultStatus[] = ['fail', 'warning'];
const NON_COMMITTAL: RuleResultStatus[] = ['unknown', 'requires_validation', 'ambiguous', 'error'];

/**
 * Deterministic comparison of a kernel result status with a documented
 * outcome. Never converts a narrative proposal into a documented physical
 * outcome; never counts synthetic material as historical evidence.
 */
export function compareWithOutcome(
  kernelStatus: RuleResultStatus,
  outcome: DocumentedOutcome,
): ComparisonClassification {
  if (outcome.evidenceClass === 'synthetic') {
    return 'not_applicable';
  }
  if (outcome.evidenceClass === 'narrative_claim' || outcome.evidenceClass === 'design_record_no_outcome') {
    return 'insufficient_evidence';
  }
  // documented_physical_outcome from here on
  if (outcome.observedFailure === null) {
    throw createLogicHubError(
      'LH_SCHEMA_INVALID',
      'documented_physical_outcome requires observedFailure=true|false — an outcome with unknown failure state is not a documented outcome',
    );
  }
  if (outcome.observedFailure) {
    if (FAILURE_DETECTING.includes(kernelStatus)) return 'detects_documented_failure';
    if (NON_COMMITTAL.includes(kernelStatus)) return 'insufficient_evidence';
    return 'misses_documented_failure'; // kernel said pass, reality failed — the metric that must stay at zero
  }
  if (kernelStatus === 'pass') return 'agrees_with_documented_outcome';
  if (FAILURE_DETECTING.includes(kernelStatus)) return 'false_warning';
  return 'insufficient_evidence';
}

/** A silent false pass: kernel pass against a documented physical failure. */
export function isFalsePass(kernelStatus: RuleResultStatus, outcome: DocumentedOutcome): boolean {
  return (
    outcome.evidenceClass === 'documented_physical_outcome' &&
    outcome.observedFailure === true &&
    kernelStatus === 'pass'
  );
}
