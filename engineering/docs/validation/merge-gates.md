# Merge Gates

## Overview

`evaluateMergeGates` (`packages/review-engine/src/merge-gates.ts`) is a pure function over an already-computed `MergeGateInput` — no persistence, git, or other I/O (ADR-0003: review-engine owns all 16 merge-gate conditions and the eligibility result, domain owns gathering the inputs). It implements master spec section 11's 16 gates exactly.

```ts
evaluateMergeGates(input: MergeGateInput): { eligible: boolean; blockers: MergeBlocker[]; checks: MergeGateCheck[] }
```

## The 16 gates

| # | Code | Description |
|---|---|---|
| 1 | `SAME_PROJECT` | Base and head revisions belong to the same project. |
| 2 | `ANCESTRY` | Head revision descends from the declared base revision. |
| 3 | `BASE_NOT_STALE` | Base revision has not become stale. |
| 4 | `MANIFEST_INTEGRITY` | Revision manifests pass integrity validation. |
| 5 | `ARTIFACT_HASHES_VALID` | Artifact hashes are valid. |
| 6 | `SCHEMA_VALIDATIONS_PASS` | Required schema validations pass. |
| 7 | `KICAD_IMPORT_VALID` | KiCad import validation passes. |
| 8 | `ERC_NO_BLOCKING_FAILURES` | ERC does not contain blocking failures. |
| 9 | `DRC_NO_BLOCKING_FAILURES` | DRC does not contain blocking failures. |
| 10 | `NO_BLOCKING_CONSTRAINT_VIOLATION` | No blocking constraint is violated. |
| 11 | `NO_UNKNOWN_REQUIRED_VALIDATION` | No required validation remains "unknown". |
| 12 | `REQUIRED_DECISIONS_PRESENT` | Required decision records exist. |
| 13 | `REQUIRED_APPROVALS_SATISFIED` | Required approval count is satisfied. |
| 14 | `NO_UNRESOLVED_REQUEST_CHANGES` | No active "request_changes" review remains unresolved. |
| 15 | `WORKING_TREE_CLEAN` | The repository working tree is clean. |
| 16 | `MERGE_PRODUCES_REVISION` | The merge operation produces a new immutable revision. |

Gates 1–15 are true preconditions: `eligible` is `true` iff every one of them evaluates to `'pass'`. Gate 16 is a **postcondition** of the merge operation itself — undecidable before the merge runs — and is always reported as `'pending'` on every pre-merge evaluation, `MergeService.recalculateEligibility` included, and is never counted toward `eligible`. It only resolves to `'pass'`/`'fail'` when `MergeService.mergePullRequest` re-evaluates immediately after actually running the merge (`mergeProducedRevision: true`).

## How inputs are gathered

`MergeService.buildGateInput` (`packages/domain/src/merge-service.ts`) is the only place that assembles a `MergeGateInput`:

- **Gates 1–3** — `git-adapter`'s `isAncestor` and `checkStaleBase` against the two revisions' commit SHAs.
- **Gate 4** — reaching this point in `buildGateInput` at all means both revisions' fingerprints were readable from git and, when a cached `revision_manifest` artifact existed, it passed hash verification (`RevisionComparisonService` never trusts an unverified cache) — so `manifestIntegrityValid` is unconditionally `true` here.
- **Gate 5** — every `Artifact` on the head revision is re-verified against `ArtifactStore.verify()`.
- **Gates 6, 7, 8, 9, 11** — read from `ValidationResultRepository.findByRevisionId(headRevisionId)`, filtered by `validationType` (`schema`, `kicad_import`, `erc`, `drc`). A `'skipped'` evidence status (kicad-cli unavailable) is honestly folded into `hasUnknownRequiredValidation`, never treated as a blocking ERC/DRC failure — gate 11 exists precisely to catch missing evidence that gates 8/9 alone would silently pass through.
- **Gate 10** — `RevisionComparisonService.compareRevisions(...).hasBlockingConstraintViolation` (`docs/validation/constraint-engine.md`).
- **Gate 12** — `true` unless the diff's `semDiff.prSummary.reviewDomainsRequired` includes `'decision'` and no `Decision` records exist for the head revision.
- **Gates 13, 14** — `review-engine`'s `summarizeReviewState({ approvals, changeRequests })` against the PR's own history (`docs/workflows/review-and-merge.md`).
- **Gate 15** — `git-adapter`'s `validateState().clean`.

## Recalculation is never cached

Both `POST /pull-requests/:id/recalculate` and `POST /pull-requests/:id/merge` call `buildGateInput` + `evaluateMergeGates` fresh — `MergeService.mergePullRequest` recomputes gates 1–15 immediately before attempting the git merge even if `recalculateEligibility` was just called moments earlier, because approvals, artifact state, or base staleness can change in between. `evaluateMergeGates` itself has no memory of a previous call: a fresh `MergeGateInput` always yields a fresh, independent result.

## Testing

`packages/review-engine/__tests__/merge-gates.test.ts` exercises every one of the 16 gates independently (36 test cases). `packages/domain/__tests__/merge-service.test.ts` and the fixture-backed `packages/domain/__tests__/fixture-import-and-diff.test.ts` exercise the full recalculate → blocked-merge → approve → merge flow end-to-end against real git and real repository-engine output.
