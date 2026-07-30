import type { SemanticProductDiff } from '../schemas/diff.schema.js';
import type {
  ReleaseBlocker,
  ReleaseDecision,
  ReviewRecord,
  StalenessRecord,
} from '../schemas/governance.schema.js';

export interface ReleaseRequest {
  revisionId: string;
  diff: SemanticProductDiff;
  review: ReviewRecord | null;
  staleRecords: readonly StalenessRecord[];
}

/**
 * Decide whether a revision may be released.
 *
 * Release fails closed. A failed check, an area nobody could evaluate, stale
 * evidence, a missing or negative review — each blocks on its own. There is
 * deliberately no override parameter: a gate that can be forced is not a gate,
 * and adding one later should require changing this signature in a way that
 * shows up in review.
 */
export function decideRelease(request: ReleaseRequest): ReleaseDecision {
  const blockers: ReleaseBlocker[] = [];

  const failed = request.diff.validationChecks.filter(c => c.verdict === 'FAIL');
  for (const check of failed) {
    blockers.push({
      code: 'release.validation-failed',
      message: `${check.label} failed: ${check.detail}`,
    });
  }

  const unknown = request.diff.validationChecks.filter(c => c.verdict === 'UNKNOWN');
  for (const check of unknown) {
    // An unrun check is not a passed check, so it cannot be released past.
    blockers.push({
      code: 'release.validation-unknown',
      message: `${check.label} could not be evaluated: ${check.detail}`,
    });
  }

  // A rule that ran and came back short of a clean pass blocks too. A thermal
  // margin computed from an estimated thermal resistance is a number waiting on
  // a bench, not a result — releasing past it would be treating a simulation as
  // a verification.
  const unresolved = request.diff.validationChecks.filter(
    c => c.verdict === 'WARNING' || c.verdict === 'REQUIRES_VALIDATION',
  );
  for (const check of unresolved) {
    blockers.push({
      code: check.verdict === 'WARNING'
        ? 'release.validation-warning'
        : 'release.validation-requires-physical-evidence',
      message: `${check.label} did not clear: ${check.detail}`,
    });
  }

  for (const area of request.diff.affectedAreas.filter(a => !a.evaluated)) {
    blockers.push({
      code: 'release.area-unevaluated',
      message: `${area.area} is affected by this change but was not evaluated.`,
    });
  }

  for (const stale of request.staleRecords) {
    blockers.push({
      code: `release.stale-${stale.kind}`,
      message: stale.message,
    });
  }

  if (request.review === null) {
    blockers.push({
      code: 'release.no-review',
      message: 'This revision has not been reviewed.',
    });
  } else if (request.review.verdict !== 'APPROVED') {
    blockers.push({
      code: 'release.changes-requested',
      message: `Review by ${request.review.reviewedBy} requested changes.`,
    });
  }

  blockers.sort((a, b) => {
    if (a.code !== b.code) return a.code < b.code ? -1 : 1;
    return a.message < b.message ? -1 : a.message > b.message ? 1 : 0;
  });

  return {
    revisionId: request.revisionId,
    released: blockers.length === 0,
    blockers,
    summary: blockers.length === 0
      ? 'No blockers. This revision may be released.'
      : `${blockers.length} blocker(s) prevent release.`,
  };
}
