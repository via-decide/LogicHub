# Domain Model

## Overview

Ten contract entities (master spec section 4), each with a TypeScript type, a Zod runtime schema, a generated JSON Schema, a SQLite persistence model, and its own doc under `docs/contracts/*.md`. This document is the cross-cutting view: how they relate, what's immutable, and which of `domain`'s services own writing each one. Field-by-field detail lives in the per-contract docs; this page does not repeat it.

## Entity relationships

```
Project 1──* Revision 1──* EngineeringObject
                │
                ├──* Constraint
                ├──* Decision
                ├──* Artifact
                └──* ValidationResult

Project 1──* ChangeIntent (proposes a change against a baseRevisionId)
Project 1──* EngineeringPullRequest (baseRevisionId + headRevisionId, both Revisions)
Module (independent, versioned; may reference a sourceProjectId/sourceRevisionId)
```

Every child row carries `projectId` and (except `Project`/`Module`) `revisionId`, enforced as SQLite foreign keys in `packages/persistence/src/migrations/001-initial-schema.ts`.

## Immutability

Per architectural principle 1.3: after a `Revision` is created, `persistence`'s `RevisionRepository` has no operation that mutates its `gitCommitSha`, snapshot hashes, or `EngineeringObject`/`Artifact`/`ValidationResult` rows tied to it. `ImportService.importRevision` refuses to re-import a commit that already has a `Revision` (`LH_REVISION_ALREADY_IMPORTED`) rather than silently updating the existing one. Corrections are new revisions, full stop — there is no "edit revision" endpoint anywhere in `apps/api`.

## Who writes what

| Entity | Written by | Notes |
|---|---|---|
| `Project` | `CatalogService.createProject` | Slug must be unique. |
| `Revision` | `ImportService.importRevision`, `MergeService.mergePullRequest` | The merge path creates one more `Revision` (`status: 'merged'`) per successful merge, in addition to every imported one. |
| `EngineeringObject` | `ImportService.importRevision` | Extracted by `kicad-adapter`; never edited after creation. |
| `Constraint` | not written by any Phase 5–8 domain service | Constraints are seeded directly against a revision (e.g. by a future authoring tool or test fixture); `RevisionComparisonService` only reads and evaluates them (`docs/validation/constraint-engine.md`). |
| `Decision` | not written by any Phase 5–8 domain service | `MergeService`'s gate 12 (`REQUIRED_DECISIONS_PRESENT`) reads `DecisionRepository`; nothing in Phases 5–8 creates `Decision` rows — a future Zayvora-style typed-change-intent producer, or manual authoring, is expected to. |
| `Artifact` | `ImportService` (ERC/DRC reports), `RevisionComparisonService` (cached fingerprint manifest) | Always content-addressed (`docs/architecture/artifact-storage.md`). |
| `ValidationResult` | `ImportService` (`kicad_import`, `erc`, `drc`), `CatalogService.validateRevisionSchema` (`schema`) | `status` distinguishes `pass`/`warning`/`fail`/`error`/`unknown`/`skipped` — see architectural principle 1.5. |
| `ChangeIntent` | `CatalogService.createChangeIntent` | Optionally referenced by an `EngineeringPullRequest.changeIntentId`; not otherwise consumed by Phases 5–8's workflows. |
| `Module` | `CatalogService.createModule` | CRUD only; not yet linked into the PR/merge workflow. |
| `EngineeringPullRequest` | `CatalogService.createPullRequest`, `ReviewService`, `MergeService` | The one entity with a real state machine (below). |

## State machines actually enforced

- **`EngineeringPullRequest.status`**: `draft → open → changes_requested → open → approved → merged`, with `closed`/`rejected` reachable from every non-terminal state. Enforced one hop at a time by `review-engine`'s `nextPrStatus` and walked by `ReviewService.submitReview` — see `docs/workflows/review-and-merge.md` for the exact mechanics, including the deliberate absence of an `approved → changes_requested` edge.
- **`Revision.status`**: the SQLite schema's `CHECK` constraint enumerates `draft/imported/validating/validated/review/merged/rejected/failed`, but Phases 5–8's services only ever write `imported` (on import) and `merged` (on merge) — the intermediate validating/validated/review states described in master spec section 16 are not driven by any current domain service; they exist in the contract and schema for a future validation-pipeline workflow to use.
- **`ChangeIntent.status`**: same situation — the full `captured → planned → executing → generated → validating → validated → review → accepted` lifecycle is in the schema (`CHECK` constraint, enum in `contracts`), but `CatalogService.createChangeIntent` only ever writes the initial `captured` state; nothing currently advances it further, since Phases 5–8 do not implement an automated change-generation pipeline (that's Zayvora's eventual role — see `docs/workflows/engineering-pr.md`).

## Snapshot hashing

`computeSnapshotHashes` (`persistence`) produces `snapshotHash`, `engineeringObjectSnapshotHash`, `constraintSnapshotHash`, `decisionSnapshotHash`, `bomSnapshotHash`, and `artifactManifestHash` for a `Revision` at import time, from its actual persisted objects/constraints/decisions/BOM items/artifacts. These are what merge gate 4 (`MANIFEST_INTEGRITY`) implicitly depends on being trustworthy — reaching `MergeService.buildGateInput` at all means the revision's fingerprint was successfully rebuilt or its cached manifest passed hash verification.

## Structured events

`domain`'s optional `DomainEventSink` (`packages/domain/src/events.ts`) is emitted at real lifecycle points across `ImportService`, `RevisionComparisonService`, `ReviewService`, `MergeService`, and `CatalogService`. Master spec section 19 names a longer minimum list than is currently emitted; the table below is what actually exists today, so it isn't mistaken for full section-19 coverage.

| Emitted | Not yet emitted |
|---|---|
| `project.created`, `project.import.started/completed/failed` | `revision.validation.started/completed/failed` |
| `revision.imported`, `revision.snapshot.created` | `engineering_object.extracted`, `engineering_graph.snapshot.created` |
| `kicad.erc.completed`, `kicad.drc.completed` | `artifact.created`, `artifact.hash.verified`, `artifact.hash.failed` |
| `diff.started/completed/failed` | `decision.created/accepted/superseded` (no domain service writes `Decision` rows yet) |
| `constraint.evaluated/violated/unknown` | `security.denied`, `tool.timeout`, `state.invalid` |
| `pull_request.created/reviewed/changes_requested/approved/merge_blocked/merged` | |

Every emitted event carries at minimum `name` and `timestamp`; most carry `projectId`/`revisionId`/`pullRequestId`, `actor`, and `result` where applicable — see `packages/domain/src/events.ts` for the exact per-event shape and `packages/domain/__tests__/events.test.ts` for an ordering assertion against the real fixture.
