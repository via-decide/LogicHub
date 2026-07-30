import { z } from 'zod';

/**
 * A judgement someone made about a specific revision.
 *
 * A decision is always bound to the revision it was made against and names
 * the subject it covers. It is never rewritten: when the design moves, the
 * decision is marked stale rather than quietly carried forward.
 */
export const ValidationDecisionSchema = z.object({
  id: z.string().min(1),
  revisionId: z.string().min(1),
  /** What the decision is about, e.g. 'motor.voltage' or a node id. */
  subject: z.string().min(1),
  verdict: z.enum(['ACCEPTED', 'REJECTED', 'WAIVED']),
  rationale: z.string().min(1),
  decidedBy: z.string().min(1),
  decidedAt: z.string().min(1),
});
export type ValidationDecision = z.infer<typeof ValidationDecisionSchema>;

/**
 * Evidence captured against a specific build.
 *
 * Evidence belongs to the revision and the hardware and firmware it was taken
 * on. It does not migrate: a reading from one build is not evidence about a
 * different one.
 */
export const EvidenceBindingSchema = z.object({
  ref: z.string().min(1),
  revisionId: z.string().min(1),
  hardwareRevision: z.string().min(1),
  firmwareRevision: z.string().min(1),
  /** Subjects this evidence speaks to, used to decide whether it went stale. */
  subjects: z.array(z.string().min(1)),
  capturedAt: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export type EvidenceBinding = z.infer<typeof EvidenceBindingSchema>;

export const StalenessReasonSchema = z.enum([
  'subject-changed',
  'hardware-revision-changed',
  'firmware-revision-changed',
]);
export type StalenessReason = z.infer<typeof StalenessReasonSchema>;

export const StalenessRecordSchema = z.object({
  /** Identifier of the decision or evidence that went stale. */
  id: z.string().min(1),
  kind: z.enum(['decision', 'evidence']),
  reason: StalenessReasonSchema,
  subject: z.string().min(1),
  fromRevisionId: z.string().min(1),
  message: z.string().min(1),
});
export type StalenessRecord = z.infer<typeof StalenessRecordSchema>;

export const ReviewRecordSchema = z.object({
  revisionId: z.string().min(1),
  reviewedBy: z.string().min(1),
  reviewedAt: z.string().min(1),
  verdict: z.enum(['APPROVED', 'CHANGES_REQUESTED']),
  notes: z.string(),
});
export type ReviewRecord = z.infer<typeof ReviewRecordSchema>;

export const ReleaseBlockerSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});
export type ReleaseBlocker = z.infer<typeof ReleaseBlockerSchema>;

/**
 * The outcome of asking to release a revision.
 *
 * Release fails closed. Anything unresolved — a failed check, an unevaluated
 * area, stale evidence, a missing review — blocks it. There is no override in
 * this API, because a release that can be forced past its own blockers is not
 * a gate.
 */
export const ReleaseDecisionSchema = z.object({
  revisionId: z.string().min(1),
  released: z.boolean(),
  blockers: z.array(ReleaseBlockerSchema),
  summary: z.string().min(1),
});
export type ReleaseDecision = z.infer<typeof ReleaseDecisionSchema>;
