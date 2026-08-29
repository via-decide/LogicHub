# ADR-0004: Constraint evaluation approach for Phase 5

Date: 2026-08-28
Status: Accepted

## Context

repository-engine's `computeSemDiff` already reports which `Constraint` records changed as
*declared text* between two revisions (`CONSTRAINT_ADDED` / `CONSTRAINT_CHANGED` /
`CONSTRAINT_REMOVED` deltas, and `affectedBlockingConstraints` in `EngineeringPrSummary`). It does
not evaluate whether a proposed revision's actual design *satisfies* a constraint. Master spec
section 3.1 requires this evaluation to feed a real, computed boolean into merge gate #10
("no blocking constraint is violated") — never a placeholder that always passes.

Two candidate implementations were considered:

1. Reuse `@logichub-engineering/validation-engine`'s SEC-* rule kernel
   (`SEC-POWER-THERMAL-001`, `SEC-OPTICAL-CLASSIFICATION-001`,
   `SEC-INTERFACE-INTEGRITY-001`, `SEC-MECHANICAL-RUGGEDNESS-001`,
   `SEC-MANUFACTURING-ECONOMICS-001`), populating its `RuleInputs`
   (`PowerThermalInputs`, `OpticalClassificationInputs`, etc.) from a
   `FingerprintDescriptor`/`EngineeringObject[]` set.
2. A small, scoped, deterministic constraint-only evaluator, owned by `domain`, that interprets a
   `Constraint`'s free-form `expression`/`expected` fields directly.

## Decision

Option 2. A scoped evaluator (`packages/domain/src/constraint-evaluation.ts`) recognizes a fixed,
documented set of machine-checkable expression shapes:

- `object_must_exist` / `object_must_not_exist` — an `EngineeringObject` with a given
  `semanticKey` must (not) be present in the target revision's object set.
- `no_delta_type` — none of a listed set of `DeltaType`s (optionally scoped to specific
  semantic IDs) may appear in the base→proposed delta set.
- `property_equals` — a named property on a target-revision object must equal `expected`.

Any `Constraint.expression` that does not parse into one of these shapes evaluates to
`'requires_validation'` — never a fabricated `'pass'`. Evaluation severity follows the
`Constraint.severity` field: a `blocking` constraint that fails evaluates to `'violation'`; a
non-blocking one evaluates to `'warning'`.

## Rationale for rejecting option 1

- `validation-engine`'s five rule categories model fixed physical-domain calculations for a
  `ProductCase` built against `reference-products/*` (power/thermal budgets, optical
  classification, interface integrity, mechanical ruggedness, manufacturing economics). A generic
  `Constraint` record's `category` field (`electrical | mechanical | thermal | manufacturing |
  supply_chain | cost | reliability | interface | project_policy`) and free-form
  `expression`/`expected` fields do not map one-to-one onto those five rule IDs or their typed
  input shapes — building that adapter would mean guessing a `ProductCase` out of whatever a
  project author happened to write into `expression`, which is exactly the kind of fabricated
  interpretation the non-goals section prohibits ("No AI-generated electrical approval").
- ADR-0003 already draws the boundary: `validation-engine` owns *physical rule calculations*;
  it does not own PR/merge-gate policy, and nothing in its charter is described as a general
  constraint-satisfaction evaluator over arbitrary project-authored constraints.
- The five SEC-* rules require full `ProductCase` inputs that a KiCad import does not produce
  today (there is no code path anywhere that derives `PowerThermalInputs` etc. from a
  `FingerprintDescriptor`); building that derivation is out of Phase 5's scope
  ("No expansion of engineering-graph unless... write down why repository-engine's existing graph
  wasn't enough" — the same discipline applies here: don't add a second inference layer when the
  existing `Constraint` contract already carries an `expression`/`expected` pair meant to be
  evaluated directly).

## Consequences

- `Constraint.expression` for any constraint that should gate a merge must use one of the four
  documented kinds above. Constraints authored with an unrecognized expression shape correctly
  block on `'requires_validation'` rather than silently passing — visible in the UI's Constraints
  tab per the epistemic-state convention (measured vs. estimated vs. unknown).
- `hasBlockingConstraintViolation()` is the single function review-engine's merge gate #10 calls;
  it is pure and untestable-by-omission (unit tests cover all four expression kinds plus the
  unrecognized-shape fallback).
- If a future need for physical-rule-backed constraints emerges (e.g. "this net's current draw
  must stay under the SEC-POWER-THERMAL-001 budget"), that is a deliberate follow-up ADR defining
  the `Constraint` → `ProductCase` mapping explicitly — not a default reached for here.
