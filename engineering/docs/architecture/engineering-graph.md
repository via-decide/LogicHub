# Engineering Graph

## Status: not implemented as a distinct graph

Master spec section 5 calls for a revision-scoped engineering graph supporting 13 typed relationship kinds (`contains`, `depends_on`, `connects_to`, `powered_by`, `implemented_by`, `constrained_by`, `validated_by`, `represented_by`, `replaces`, `derived_from`, `supplied_by`, `instantiates`, `supersedes`), object lookup by semantic key, bidirectional dependency traversal, affected-object calculation, graph snapshot hashing, revision comparison, constraint target resolution, and decision/artifact linkage.

`packages/engineering-graph/` exists as an empty package (`README.md` only, no `src/`) — a placeholder left from an earlier phase, not something Phase 5–8 built or was asked to build (this task's explicit scope was "do not re-implement anything already built/tested" against Phases 0–4's foundation, and the graph was not part of that foundation either). This document exists so that gap is stated plainly rather than implied by the package's mere presence, per the "never fabricate a result" convention applied to documentation as much as to runtime behavior.

## What substitutes for it today

None of section 5's required graph capabilities are unmet outright — most are covered by other real mechanisms, just not under a unified `EngineeringGraph` abstraction with typed edges:

| Required capability | What actually provides it |
|---|---|
| Object lookup by semantic key | `EngineeringObjectRepository` + a SQLite index on `(revision_id, semantic_key)` (`packages/persistence/src/migrations/001-initial-schema.ts`). |
| Comparison between revisions | `repository-engine`'s `computeSemDiff` (`docs/workflows/revision-diff.md`) — a full semantic diff, but expressed as an ordered `DeltaRecord[]` list, not graph-edge deltas. |
| Constraint target resolution | `Constraint.targetObjectIds` plus the constraint evaluator's own `semanticKey`-based lookups (`docs/validation/constraint-engine.md`) — direct, not graph traversal. |
| Decision-to-object / artifact-to-object linkage | `Decision.evidenceArtifactIds`/`constraintsConsidered` and `Artifact.revisionId`/`sourcePaths` — foreign-key-style references, not graph edges. |
| Graph snapshot hashing | `Revision.engineeringObjectSnapshotHash` (`computeSnapshotHashes`) hashes the object set as a whole; there is no separate relationship/edge hash. |

## What is genuinely missing

- **Typed relationship edges** — `EngineeringObject.relationships` is a persisted JSON field (see `docs/contracts/engineering-object.md`) but nothing in Phases 5–8 populates or reads it as a queryable graph; no code constructs `contains`/`depends_on`/`connects_to`/etc. edges from KiCad extraction today.
- **Outbound/inbound dependency traversal and affected-object calculation** — there is no traversal API. "What does changing net N affect?" is currently only answerable by reading `DeltaRecord`s from a diff between two revisions that actually differ in that respect, not by querying a live graph of the current revision alone.

## If this becomes necessary

Master spec section 5 itself says: "The graph may initially use relational tables and adjacency records. Do not add a separate graph database unless evidence proves it necessary." Building it properly means populating `EngineeringObject.relationships` at extraction time (kicad-adapter) and adding traversal queries over it (a `packages/engineering-graph` implementation, or a `domain`-level `GraphService`) — a scoped follow-up, not a Phase 5–8 addition, consistent with how ADR-0004 treated a similarly-tempting expansion (reusing `validation-engine`'s rule kernel) as out of scope without a dedicated decision record first.
