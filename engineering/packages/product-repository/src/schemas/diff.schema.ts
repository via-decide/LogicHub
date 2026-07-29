import { z } from 'zod';

export const ChangeKindSchema = z.enum([
  'node-added', 'node-removed', 'parameter-changed', 'metric-changed', 'connection-changed',
]);
export type ChangeKind = z.infer<typeof ChangeKindSchema>;

export const SemanticChangeSchema = z.object({
  kind: ChangeKindSchema,
  nodeId: z.string().min(1).nullable(),
  nodeType: z.string().min(1).nullable(),
  field: z.string().min(1),
  before: z.string(),
  after: z.string(),
  /** Human-readable form, e.g. "Battery changed: 3S -> 4S". */
  headline: z.string().min(1),
});
export type SemanticChange = z.infer<typeof SemanticChangeSchema>;

/**
 * A domain the change reaches into.
 *
 * `evaluated` is the important field. An area can be affected without the
 * platform being able to say anything about the consequence — thermal load is
 * the standing example, since no thermal model runs in this release. Listing
 * it as affected but unevaluated is honest; leaving it out would hide it, and
 * marking it passed would be a lie.
 */
export const AffectedAreaSchema = z.object({
  area: z.string().min(1),
  domain: z.enum(['electrical', 'mechanical', 'firmware', 'thermal', 'application']),
  reason: z.string().min(1),
  evaluated: z.boolean(),
  /** Set when evaluated; describes what actually changed in that area. */
  effect: z.string().nullable(),
});
export type AffectedArea = z.infer<typeof AffectedAreaSchema>;

/**
 * PASS, FAIL, or UNKNOWN. There is no fourth state and no default: a check
 * that could not be run is UNKNOWN, and UNKNOWN is never treated as PASS.
 */
export const CheckVerdictSchema = z.enum(['PASS', 'FAIL', 'UNKNOWN']);
export type CheckVerdict = z.infer<typeof CheckVerdictSchema>;

export const ValidationCheckSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  verdict: CheckVerdictSchema,
  detail: z.string().min(1),
});
export type ValidationCheck = z.infer<typeof ValidationCheckSchema>;

export const SemanticProductDiffSchema = z.object({
  fromRevisionId: z.string().min(1).nullable(),
  toRevisionId: z.string().min(1),
  changes: z.array(SemanticChangeSchema),
  affectedAreas: z.array(AffectedAreaSchema),
  validationChecks: z.array(ValidationCheckSchema),
  /** True when any check failed. */
  hasFailures: z.boolean(),
  /** True when any affected area could not be evaluated. */
  hasUnevaluatedAreas: z.boolean(),
  summary: z.string().min(1),
});
export type SemanticProductDiff = z.infer<typeof SemanticProductDiffSchema>;
