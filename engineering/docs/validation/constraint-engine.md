# Constraint Engine

## Overview

`packages/domain/src/constraint-evaluation.ts` evaluates whether a proposed revision's actual design satisfies a project's `Constraint` records (`docs/contracts/constraint.md`). It is a small, scoped, deterministic evaluator — not a reuse of `validation-engine`'s physical-rule kernel — recognizing a fixed, documented set of machine-checkable expression shapes. See `docs/decisions/adr-0004-constraint-evaluation.md` for the full rationale, including why validation-engine's SEC-* rules were rejected as a base.

## Recognized expression kinds

`Constraint.expression` is free-form JSON; `parseConstraintExpression` recognizes exactly four shapes and returns `null` for anything else:

| `kind` | Fields | Checks |
|---|---|---|
| `object_must_exist` | `semanticKey` | An `EngineeringObject` with this `semanticKey` is present in the target revision. |
| `object_must_not_exist` | `semanticKey` | No `EngineeringObject` with this `semanticKey` is present. |
| `no_delta_type` | `deltaTypes: string[]`, `semanticKeys?: string[]` | None of the listed `DeltaType`s appear in the base→proposed delta set (optionally scoped to specific semantic ids on either side of the delta). |
| `property_equals` | `semanticKey`, `property` | The named property on the target-revision object with this `semanticKey` deep-equals `Constraint.expected`. |

An expression that doesn't parse into one of these shapes evaluates to `'requires_validation'` — never a fabricated `'pass'`. This is visible in the UI's Constraints tab per the epistemic-state convention (measured vs. estimated vs. unknown).

## Severity mapping

Evaluation outcome follows `Constraint.severity`:

- A failing `blocking` constraint evaluates to `'violation'`.
- A failing non-blocking constraint evaluates to `'warning'`.
- `property_equals` against a `semanticKey` that isn't found in the target revision evaluates to `'unknown'` regardless of severity (there is nothing to compare).

## The semantic-key namespace gotcha

`object_must_exist` / `object_must_not_exist` / `property_equals` compare against `EngineeringObject.semanticKey`, which is kicad-adapter's extractor format (e.g. `component:D2`). This is a **different namespace** from the semantic ids repository-engine's diff uses in `DeltaRecord.oldSemanticId` / `newSemanticId` (e.g. `schematic::D2`), which is what `no_delta_type`'s `semanticKeys` filter matches against instead. Using the wrong namespace for a given expression kind makes the object/delta lookup silently miss — no match, no throw — rather than error. Constraint authors (and anyone integrating a future typed-change-intent producer) must pick the namespace that matches the expression kind they're writing.

## Where it runs

`RevisionComparisonService.compareRevisions` (`docs/workflows/revision-diff.md`) calls `evaluateConstraints(constraints, targetObjects, deltas)` for every constraint persisted against the head revision, then `hasBlockingConstraintViolation(constraints, outcomes)` folds the per-constraint outcomes into the single boolean merge gate #10 (`docs/validation/merge-gates.md`) reads. Both functions are pure — no persistence or I/O — and are unit-tested in isolation (`packages/domain/__tests__/constraint-evaluation.test.ts`) covering all four expression kinds plus the unrecognized-shape fallback.

## Future extension

A future need for physical-rule-backed constraints (e.g. "this net's current draw must stay under a power/thermal budget") is a deliberate follow-up — a new ADR defining an explicit `Constraint` → `validation-engine` `ProductCase` mapping — not something this evaluator reaches for on its own.
