# @logichub-engineering/review-engine

EngineeringPullRequest lifecycle policy (ADR-0003): review-state calculation, approval/change-request
handling, and all 16 merge-gate conditions. Pure — no persistence, no Git, no other I/O; `domain` is
the only package that gathers real inputs (from persistence, git-adapter, and its own constraint
evaluation) and calls into this package.

- `applyReview` / `summarizeReviewState` / `nextPrStatus` — review workflow. Approval and
  change-request counts use latest-decision-per-reviewer semantics: a reviewer's newest decision
  supersedes their own older one. `nextPrStatus` returns one legal hop of the frozen
  `PullRequestTransitions` graph (master spec section 16) at a time -- callers (domain's
  `ReviewService`) walk it repeatedly to cross more than one hop (e.g.
  `changes_requested -> open -> approved`) in a single review submission. Once a PR reaches
  `approved` it never reverts on a later `request_changes` (the graph has no edge back down); the
  review history still updates, so merge gate #14 still blocks at merge time regardless of the
  coarse status label.
- `evaluateMergeGates` — the 16 numbered conditions from master spec section 11, verbatim. Gates
  1-15 are real preconditions that gate `eligible`; gate 16 ("the merge operation produces a new
  immutable revision") is a postcondition of the merge itself and reports `'pending'` until the
  caller re-evaluates with `mergeProducedRevision` set, immediately after actually merging.

Because this function is pure and stateless, "recalculate merge eligibility immediately before
merge, never trust an earlier cached result" (master spec section 11) falls out for free: every call
takes a fresh `MergeGateInput` and returns a fresh result with no memory of any previous call.
