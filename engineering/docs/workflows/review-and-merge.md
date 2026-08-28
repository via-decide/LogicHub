# Review and Merge Workflow

## Overview

Two packages divide this workflow per ADR-0003: `review-engine` is pure policy (review-state folding, the 16 merge gates), `domain`'s `ReviewService` and `MergeService` are the I/O-performing wrappers that load real state, call the pure engine, and persist the result. Neither package imports the other's pure logic into itself — `review-engine` has no persistence or git dependency at all.

## Review state model

A PR accumulates two lists: `approvals` and `changeRequests` (both `ReviewRecord[]`). `review-engine`'s `summarizeReviewState` (`packages/review-engine/src/review-workflow.ts`) folds them on a **latest-decision-per-reviewer** basis, not raw list length: if the same reviewer approves and later requests changes, only the later `request_changes` counts; a later `approve` from that reviewer resolves it back out. This is why `unresolvedChangeRequests`, not `changeRequests.length`, is what merge gate #14 reads.

`nextPrStatus` walks **one legal hop** of the frozen `PullRequestTransitions` graph (master spec section 16) at a time: `draft/open → changes_requested`, `changes_requested → open`, `open → approved`. There is deliberately no edge from `approved` back to `changes_requested` — a `request_changes` submitted after approval still updates the review history (and so still blocks gate #14 when recalculated), it just does not revert the coarse status label. `ReviewService.submitReview` calls `nextPrStatus` repeatedly (up to 4 hops) so one review submission that crosses the final approval threshold lands directly on `approved`, not stuck at the intermediate `open`.

## Submitting a review

`POST /pull-requests/:pullRequestId/reviews` → `ReviewService.submitReview(pullRequestId, reviewer, decision, comment?)`:

1. Rejects with `LH_STATE_TRANSITION_INVALID` if the PR is already `merged`, `closed`, or `rejected`.
2. `approve` → `EngineeringPullRequestRepository.addApproval`; `request_changes` → `addChangeRequest`; `comment` mutates neither list (there is no separate comment-log entity in the frozen `EngineeringPullRequest` contract — the call succeeds but is not persisted as its own audit record).
3. Re-derives status via `nextPrStatus` and persists only the hops that actually changed, emitting `pull_request.reviewed` and, when the status label itself changes, `pull_request.changes_requested` / `pull_request.approved`.

`POST /pull-requests/:pullRequestId/close` → `ReviewService.closePullRequest` moves any non-terminal PR to `closed` — not one of master spec section 12's named minimum endpoints, but section 13 explicitly requires a Close action alongside Comment/Approve/Request changes/Recalculate/Merge, and `PullRequestTransitions` already allows `closed` from every non-terminal state.

## Merge gates

`MergeService.recalculateEligibility` and `MergeService.mergePullRequest` both build a fresh `MergeGateInput` from persistence + git-adapter + a live `RevisionComparisonService.compareRevisions` call, then hand it to `review-engine`'s pure `evaluateMergeGates`. See `docs/validation/merge-gates.md` for the full 16-gate table.

**Recalculate is never trusted as a cache** — `mergePullRequest` recomputes gates 1–15 immediately before attempting the merge, even if `recalculateEligibility` was just called, because state (approvals, artifact hashes, base staleness) can change between the two calls.

## Merging

`POST /pull-requests/:pullRequestId/merge` → `MergeService.mergePullRequest(pullRequestId, repoPath, mergedBy)`:

1. Rejects an already-`merged`/`closed`/`rejected` PR (`LH_STATE_TRANSITION_INVALID`).
2. Recomputes gates 1–15. If any fails, persists the blockers, emits `pull_request.merge_blocked`, and throws `LH_MERGE_BLOCKED` — no git operation is attempted.
3. Opens the repo via `git-adapter` and calls `GitRepository.merge(baseBranch, headRevision.gitCommitSha, ...)`, producing a real merge commit SHA.
4. Persists a new `Revision` (`status: 'merged'`) whose snapshot hashes are copied from the head revision — a fast-forward-preserving merge carries head's tree, so head's already-computed hashes still describe the merged content.
5. Gate 16 (`MERGE_PRODUCES_REVISION`) is undecidable before the merge runs — `evaluateMergeGates` reports it as `'pending'` on every pre-merge call (`recalculateEligibility` included) and is only resolved to `pass`/`fail` in this final re-evaluation, once the new revision has actually been persisted.
6. Updates the PR's `mergeEligibility`, `mergedAt`, `mergedRevisionId`, and `status: 'merged'`; emits `pull_request.merged`.

## Events emitted across this workflow

`pull_request.created` → (`pull_request.reviewed` × N, `pull_request.changes_requested` / `pull_request.approved` as status changes) → `pull_request.merge_blocked` (zero or more, on failed attempts) → `pull_request.merged`. See `packages/domain/__tests__/events.test.ts` for an end-to-end ordering assertion against the real fixture.
