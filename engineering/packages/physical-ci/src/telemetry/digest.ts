import type { z } from 'zod';
import { hashValue } from '@logichub-engineering/project-capsule';
import {
  SubmissionSchema,
  TelemetryPayloadSchema,
  type Submission,
  type TelemetryPayload,
} from './telemetry.schema.js';

/**
 * Content addressing for physical telemetry.
 *
 * The whole model rests on this: a payload's identity *is* its content. There is
 * no separate id a vendor could keep stable while changing a reading underneath
 * it. Alter one coordinate and it becomes a different payload, with a different
 * name, which the pipeline has never seen and has certainly never passed.
 *
 * `hashValue` from the capsule package is reused rather than reimplemented. It
 * canonicalises first — keys sorted at every depth, `undefined` treated as
 * absent, `-0` normalised, non-finite refused — so two payloads that differ only
 * in JSON key order hash the same, and two that differ in any value do not.
 */

/** Reasons a payload can be rejected before any rule is evaluated. */
export const DIGEST_ERRORS = {
  malformed: 'ERR_PAYLOAD_MALFORMED',
  mismatch: 'ERR_DIGEST_MISMATCH',
} as const;

export type DigestErrorCode = (typeof DIGEST_ERRORS)[keyof typeof DIGEST_ERRORS];

export interface DigestAccepted {
  ok: true;
  digest: string;
  payload: TelemetryPayload;
}

export interface DigestRejected {
  ok: false;
  code: DigestErrorCode;
  detail: string;
  /** What the payload actually hashes to, when it could be computed at all. */
  computedDigest: string | null;
}

export type DigestResult = DigestAccepted | DigestRejected;

/**
 * The digest of a payload.
 *
 * Deliberately takes the payload, not the submission: the declared digest is
 * the vendor's claim about this value and cannot be an input to it.
 */
export function telemetryDigest(payload: TelemetryPayload): string {
  return hashValue(payload);
}

/**
 * Accept a submission only if it is well formed and hashes to what it claims.
 *
 * A mismatch is not a warning and not a retryable condition. It means the bytes
 * that were measured and the bytes that arrived are different, and no rule
 * should be run against either — there is nothing to evaluate, only something
 * to reject.
 */
export function verifySubmission(raw: unknown): DigestResult {
  const parsed = SubmissionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      code: DIGEST_ERRORS.malformed,
      detail: parsed.error.issues
        .map((issue: z.ZodIssue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .sort()
        .join('; '),
      computedDigest: null,
    };
  }

  const submission: Submission = parsed.data;
  const computed = telemetryDigest(submission.payload);

  if (computed !== submission.declaredDigest) {
    return {
      ok: false,
      code: DIGEST_ERRORS.mismatch,
      detail:
        `Declared ${submission.declaredDigest} but the payload hashes to ${computed}. `
        + 'The submission was altered after it was signed, or was never signed over '
        + 'this content.',
      computedDigest: computed,
    };
  }

  return { ok: true, digest: computed, payload: submission.payload };
}

/** Parse a payload without a declared digest, for a producer building one. */
export function sealPayload(raw: unknown): Submission {
  const payload = TelemetryPayloadSchema.parse(raw);
  return { payload, declaredDigest: telemetryDigest(payload) };
}
