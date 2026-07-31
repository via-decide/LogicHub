import { transition, type TransitionResult } from '@logichub-engineering/shared';
import { PR_TRANSITIONS, type PullRequestState, type PipelineRun } from '../pipeline/merge-gate.js';
import type {
  Issue,
  Claim,
  PhysicalPullRequest,
  ReleaseCondition,
} from './marketplace.schema.js';

/**
 * Pure state transitions for the marketplace domain — no database, no
 * persistence, no clock reads (every function that needs "now" takes it as
 * an argument, same pattern `_orders.js`'s `orderRecord` already uses: a
 * caller can produce the same result twice and compare them). Callers under
 * `api/marketplace/` do the persisting; this file only decides what's legal.
 *
 * Every `PhysicalPullRequest` state change reuses `transitionPullRequest`'s
 * underlying `PR_TRANSITIONS` map from `pipeline/merge-gate.ts` rather than
 * encoding a second, parallel state machine here — an illegal transition
 * (e.g. skipping straight from DRAFT to PASSED) is rejected the same way
 * regardless of which caller in this package attempts it.
 */

export interface WorkflowDecision {
  allowed: boolean;
  reason: string;
}

/** Whether a vendor may claim this issue right now. */
export function canClaimIssue(issue: Issue): WorkflowDecision {
  if (issue.status !== 'OPEN') {
    return {
      allowed: false,
      reason: `Issue is ${issue.status}, not OPEN. Only an open issue can be claimed.`,
    };
  }
  return { allowed: true, reason: 'Issue is open.' };
}

/** The issue as it should be persisted once a claim is accepted. */
export function markIssueClaimed(issue: Issue): Issue {
  const decision = canClaimIssue(issue);
  if (!decision.allowed) throw new Error(decision.reason);
  return { ...issue, status: 'CLAIMED' };
}

/**
 * The issue as it should be persisted once its current claim's pull request
 * reaches FAILED.
 *
 * `PR_TRANSITIONS` (`pipeline/merge-gate.ts`) makes FAILED terminal for a
 * pull request deliberately — a rejected submission can't be re-evaluated
 * into a pass, only a genuinely new payload (new digest) can move forward,
 * per `canRetrigger`'s whole reason for existing. But a vendor's only path
 * to submit that new payload is a fresh claim, and `canClaimIssue` only
 * allows claiming an OPEN issue — without this, a single failed attempt
 * would permanently strand the issue at CLAIMED with no pull request that
 * can ever pass. Reopening it here is what makes "fail once, fix it, try
 * again" possible at all, via a new claim/new pull request rather than
 * resurrecting the failed one.
 */
export function reopenIssueAfterFailure(issue: Issue): Issue {
  return { ...issue, status: 'OPEN' };
}

/** A new pull request for a freshly accepted claim, starting at DRAFT. */
export function createPullRequestFromClaim(
  id: string,
  issue: Issue,
  claim: Claim,
  now: string,
): PhysicalPullRequest {
  if (claim.issueId !== issue.id) {
    throw new Error(`Claim ${claim.id} is for issue ${claim.issueId}, not ${issue.id}.`);
  }
  return {
    id,
    schemaVersion: '0.1.0',
    issueId: issue.id,
    claimId: claim.id,
    vendorId: claim.vendorId,
    state: 'DRAFT',
    evaluatedDigests: [],
    createdAt: now,
    updatedAt: now,
  };
}

function applyTransition(
  pr: PhysicalPullRequest,
  to: PullRequestState,
  now: string,
): PhysicalPullRequest {
  const result: TransitionResult<PullRequestState> = transition(pr.state, to, PR_TRANSITIONS);
  if (!result.valid) {
    throw new Error(
      `Cannot move pull request ${pr.id} from ${pr.state} to ${to}. `
      + `Allowed from here: [${result.allowedTargets.join(', ') || 'none — terminal state'}].`,
    );
  }
  return { ...pr, state: to, updatedAt: now };
}

/** DRAFT → IN_INSPECTION, once a sealed submission has been accepted for this PR. */
export function beginInspection(pr: PhysicalPullRequest, now: string): PhysicalPullRequest {
  return applyTransition(pr, 'IN_INSPECTION', now);
}

/** IN_INSPECTION → EVALUATING, immediately before the pipeline runs. */
export function beginEvaluation(pr: PhysicalPullRequest, now: string): PhysicalPullRequest {
  return applyTransition(pr, 'EVALUATING', now);
}

/**
 * EVALUATING → whatever `runPipeline` decided (PASSED or FAILED), and record
 * the run's digest as evaluated so `canRetrigger` sees it on the next attempt.
 *
 * A run whose own state isn't PASSED or FAILED (there is no third option in
 * `PipelineRun`) would mean the pipeline itself returned something the state
 * machine doesn't recognise — `applyTransition` rejects it the same way it
 * rejects any other illegal target, rather than this function special-casing
 * an "impossible" value into a silent pass-through.
 */
export function applyRunResult(
  pr: PhysicalPullRequest,
  run: PipelineRun,
  now: string,
): PhysicalPullRequest {
  const next = applyTransition(pr, run.state, now);
  const evaluatedDigests = run.digest && !next.evaluatedDigests.includes(run.digest)
    ? [...next.evaluatedDigests, run.digest]
    : next.evaluatedDigests;
  return { ...next, evaluatedDigests };
}

/**
 * PASSED → MERGED. Represents the physical claim being accepted into the
 * repository's history — deliberately independent of whether a payment
 * actually moved. `commerce`'s `ACTIVE_PHASE` is 1: no funds move in this
 * build, and `releasePayment`'s decision is recorded and displayed
 * separately (see `api/marketplace/release.js`), not folded into this
 * transition. A PR that passed CI is real regardless of settlement rails.
 */
export function mergePullRequest(pr: PhysicalPullRequest, now: string): PhysicalPullRequest {
  return applyTransition(pr, 'MERGED', now);
}

/**
 * Whether every release condition has actually passed.
 *
 * `PENDING` is not treated as satisfied — a single pending condition blocks
 * exactly as a failed one does. An empty condition list is never "met": a
 * release decision with nothing checked is not the same as one that checked
 * everything and found it clean.
 */
export function allConditionsMet(conditions: readonly ReleaseCondition[]): boolean {
  return conditions.length > 0 && conditions.every(condition => condition.status === 'PASSED');
}
