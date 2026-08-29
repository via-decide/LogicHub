# Engineering Pull Request Workflow

## Overview

An `EngineeringPullRequest` (`docs/contracts/engineering-pull-request.md`) proposes merging a `headRevision` into a `baseBranch` at `baseRevisionId`. Creating one is a thin, low-complexity step handled by `CatalogService.createPullRequest` (`packages/domain/src/catalog-service.ts`); the interesting work — diffing, validation, review, and merge gating — happens in the workflows this one links to.

## Preconditions

Both `baseRevisionId` and `headRevisionId` must already be imported revisions of the same project (see `docs/workflows/kicad-import.md`). `CatalogService.createPullRequest` validates both exist (`LH_REVISION_NOT_FOUND` otherwise) before creating the PR record.

## Steps

1. **Create** — `POST /projects/:projectId/pull-requests` (`CatalogService.createPullRequest`) allocates the next sequential `number` for the project, sets `status: 'open'`, `approvals: []`, `changeRequests: []`, and `requiredApprovals` (default `1`, caller-overridable). Emits `pull_request.created`.

2. **Inspect** — `GET /pull-requests/:pullRequestId` returns the PR record. The diff itself is not stored on the PR; the web UI's PR view fetches it separately via `GET /revisions/:baseRevisionId/diff/:headRevisionId` (`docs/workflows/revision-diff.md`) using the PR's own `baseRevisionId`/`headRevisionId`.

3. **Review domains** — the diff's `semDiff.prSummary.reviewDomainsRequired` names which of schematic / PCB / BOM / constraints / decisions / validation actually changed, so the PR view can show only the tabs with real content (mirroring the ten-section review breakdown in master spec section 13, item 10) rather than a fixed tab list regardless of what changed.

4. **Review and merge** — see `docs/workflows/review-and-merge.md` for approve / request-changes / close / recalculate / merge.

## Endpoints

| Method | Path | Service call |
|---|---|---|
| `POST` | `/projects/:projectId/pull-requests` | `CatalogService.createPullRequest` |
| `GET` | `/projects/:projectId/pull-requests` | `CatalogService.listPullRequests` |
| `GET` | `/pull-requests/:pullRequestId` | `CatalogService.getPullRequest` |
| `POST` | `/pull-requests/:pullRequestId/reviews` | `ReviewService.submitReview` |
| `POST` | `/pull-requests/:pullRequestId/close` | `ReviewService.closePullRequest` |
| `POST` | `/pull-requests/:pullRequestId/recalculate` | `MergeService.recalculateEligibility` |
| `POST` | `/pull-requests/:pullRequestId/merge` | `MergeService.mergePullRequest` |

## Future integration points

This workflow does not implement Zayvora or DAXINI integration (out of scope per master spec section 21), but its shape is deliberately narrow enough to support them later without redesign:

- **Zayvora** (typed change intents): `ChangeIntent` is already a first-class contract (`docs/contracts/change-intent.md`) with a `changeIntentId` field on `EngineeringPullRequest` — a future Zayvora caller submits a `ChangeIntent` via `POST /projects/:projectId/change-intents`, then references it when creating the PR. No workflow change is required.
- **DAXINI** (isolated validation jobs): every validation the PR's merge gates read (`kicad_import`, `erc`, `drc`, `schema`) is a `ValidationResult` row keyed by `revisionId` and written by whatever validator ran it (`ImportService`'s pipeline today). A future out-of-process DAXINI worker can write the same `ValidationResult` shape independently — the merge gates only ever read what is persisted, never how it was produced.
