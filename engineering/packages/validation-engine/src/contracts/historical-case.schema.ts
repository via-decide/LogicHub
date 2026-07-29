import { z } from 'zod';
import { Sha256Schema } from '@logichub-engineering/shared';
import { RuleIdSchema } from './case.schema.js';
import { RuleResultStatusSchema } from './rule-result.schema.js';

/**
 * Comparison of a kernel decision against a documented outcome. A narrative
 * proposal is never converted into a documented physical outcome.
 */
export const ComparisonClassificationSchema = z.enum([
  'agrees_with_documented_outcome',
  'detects_documented_failure',
  'misses_documented_failure',
  'false_warning',
  'insufficient_evidence',
  'not_applicable',
]);
export type ComparisonClassification = z.infer<typeof ComparisonClassificationSchema>;

export const OutcomeEvidenceClassSchema = z.enum([
  /** instrumented physical measurement or documented physical failure */
  'documented_physical_outcome',
  /** design document / spec / plan without executed physical result */
  'design_record_no_outcome',
  /** narrative essay / claim without raw data or instrument record */
  'narrative_claim',
  /** explicitly synthetic material — excluded from historical metrics */
  'synthetic',
]);
export type OutcomeEvidenceClass = z.infer<typeof OutcomeEvidenceClassSchema>;

export const HistoricalCaseSchema = z.object({
  schemaVersion: z.literal('0.1.0'),
  caseId: z.string().min(1),
  productOrSubsystem: z.string().min(1),
  sourceRepository: z.string().min(1),
  sourceFile: z.string().min(1),
  sourceContentSha256: Sha256Schema,
  sourceGitRevision: z.string().min(1),
  sourceDate: z.string().nullable(),
  originalDecision: z.string().min(1),
  originalAssumptions: z.array(z.string()),
  documentedObservedOutcome: z.string().nullable(),
  outcomeEvidenceClass: OutcomeEvidenceClassSchema,
  relevantRuleFamilies: z.array(RuleIdSchema),
  normalizedKernelInputsRef: z.string().nullable(),
  missingInputs: z.array(z.string()),
  kernelResultStatus: RuleResultStatusSchema.nullable(),
  kernelResultHash: Sha256Schema.nullable(),
  comparisonClassification: ComparisonClassificationSchema,
  notes: z.string(),
});
export type HistoricalCase = z.infer<typeof HistoricalCaseSchema>;

export const HistoricalCaseManifestSchema = z.object({
  schemaVersion: z.literal('0.1.0'),
  generatedAt: z.string(),
  targetCaseCount: z.number().int().positive(),
  sourceBackedCaseCount: z.number().int().nonnegative(),
  casesWithDocumentedPhysicalOutcome: z.number().int().nonnegative(),
  blockerReport: z.string().min(1),
  cases: z.array(HistoricalCaseSchema),
});
export type HistoricalCaseManifest = z.infer<typeof HistoricalCaseManifestSchema>;
