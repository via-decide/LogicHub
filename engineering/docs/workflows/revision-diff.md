# Revision Diff Workflow

## Overview

`RevisionComparisonService` (`packages/domain/src/revision-comparison-service.ts`) compares two already-imported revisions of the same project and returns a semantic diff plus constraint evaluation. It adds no new diffing or hashing logic — it orchestrates `repository-engine`'s fingerprint/semdiff algorithms and `domain`'s own constraint evaluator (see `docs/validation/constraint-engine.md`).

Entry point: `comparisonService.compareRevisions(repoPath, baseRevisionId, headRevisionId)`, also exposed as `GET /revisions/:baseRevisionId/diff/:headRevisionId`.

## Steps

1. **Load revisions** — both `baseRevisionId` and `headRevisionId` are read from `RevisionRepository`. Both must exist and belong to the same project, or the call throws `LH_REVISION_NOT_FOUND` / `LH_GIT_ANCESTRY_INVALID`.

2. **Fingerprint, with cache** — for each revision, `loadOrRebuildFingerprint` first looks for a cached `revision_manifest` artifact (see below). If none is found, or the cached one fails hash verification, it calls `repository-engine`'s `buildFingerprint({ repoPath, commitRef })`, which re-walks and re-parses the whole KiCad project tree at that commit.

3. **Semantic diff** — `computeSemDiff({ base, proposed })` (repository-engine) produces the `SemDiffResult`: the ordered `DeltaRecord[]` list plus the `prSummary` (review domains touched, counts, etc.). This is the same algorithm exercised by repository-engine's own test suite; domain does not reimplement any part of it.

4. **Constraint evaluation** — every `Constraint` persisted against the head revision is evaluated against the head revision's `EngineeringObject`s and the diff's `DeltaRecord[]` via `evaluateConstraints` (see `docs/validation/constraint-engine.md`). `hasBlockingConstraintViolation` folds the outcomes into the single boolean merge gate #10 reads.

5. **Result** — `RevisionComparisonResult` bundles `baseRevision`, `headRevision`, `semDiff`, `constraints`, `constraintOutcomes`, and `hasBlockingConstraintViolation`. Nothing is persisted by this step beyond the fingerprint cache (step 2) — the diff itself is recomputed, not stored, so it can never go stale relative to the constraints or objects it reads.

## Fingerprint caching

`buildFingerprint` re-walks and re-parses the entire repo tree, so its result is cached as a content-addressed `revision_manifest` artifact keyed by revision id (one per revision, written the first time that revision is fingerprinted). The cache is a plain artifact under `ArtifactStore` — no separate cache store or TTL logic — and is always SHA-256 hash-verified via `ArtifactStore.verify()` before being trusted; a missing or failed-verification cache silently falls back to a full rebuild rather than serving stale or tampered data.

## Events

`diff.started` / `diff.completed` / `diff.failed` bracket the whole comparison. `constraint.evaluated` fires once per evaluated constraint; `constraint.violated` and `constraint.unknown` fire additionally when the outcome warrants it. See `docs/architecture/system-overview.md` for how these are consumed.

## What this workflow does not do

- It does not persist the `SemDiffResult` — every call recomputes it from the two revisions' current state, so a diff is never served stale.
- It does not decide merge eligibility — `hasBlockingConstraintViolation` is one input among sixteen that `review-engine`'s merge gates evaluate (`docs/validation/merge-gates.md`).
- It does not render a visual (pixel) diff — see `VisualDiffService` in `packages/domain/src/visual-diff-service.ts` for the separate, side-by-side SVG-pairing service used by the PR view's schematic/PCB tabs; per the master spec's explicit non-goals, there is no pixel-level image comparison.
