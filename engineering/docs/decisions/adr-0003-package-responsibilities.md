# ADR-0003: Package responsibility boundaries

Date: 2026-07-22
Status: Accepted

## Context

The engineering platform has 12+ packages. Three require especially clear ownership boundaries to
prevent logic duplication and circular dependencies:
- `validation-engine` — physical rule calculations
- `review-engine` — PR lifecycle and merge-gate policy
- `domain` — application orchestration and side effects

Without explicit boundaries, merge-gate conditions might be implemented in both the review engine
(as policy) and the domain layer (as workflow steps), or validation formulas might leak into the
review engine.

## Decision

### validation-engine

Owns: rule definitions, unit normalization, deterministic calculations, confidence classification,
evidence requirements, pass/warning/fail/unknown/requires_validation states, calculation traces,
rule-version management.

Does not own: database access, Git operations, PR lifecycle, merge policy.

Input: typed product case. Output: canonical ValidationResult with deterministic hash.

### review-engine

Owns: review-state calculation, approval handling, change-request resolution, all 16 merge-gate
conditions, merge-eligibility result, blocker generation.

Does not own: persistence, Git merge side effects, artifact storage, API concerns.

Input: current PR state + validation summaries + constraint summaries + ERC/DRC results + review
records + revision state + git state. Output: MergeEligibility (eligible: boolean,
blockers: MergeBlocker[]).

### domain

Owns: application orchestration — project service, revision service, operation coordinator,
import/validation/diff/PR/merge workflows, artifact orchestration, structured event emission.

Loads state from persistence, calls pure engines (validation-engine, review-engine,
repository-engine), performs side effects (git operations, file I/O, database writes), and
persists results.

Does not own: validation formulas, merge-gate policy, KiCad parsing, graph algorithms, diff
algorithms.

### Boundary rules

1. `validation-engine` and `review-engine` are pure — no persistence or I/O dependencies.
2. `domain` is the only package that imports from both `validation-engine` and `review-engine`.
3. Neither `validation-engine` nor `review-engine` imports the other.
4. `apps/api` imports only from `domain` (and `contracts` for request/response types).

## Consequences

- Adding a new merge-gate condition means editing `review-engine` only.
- Adding a new validation rule means editing `validation-engine` only.
- Changing how a workflow is orchestrated means editing `domain` only.
- The API layer never calls engine libraries directly — always through domain services.
- Testing engines in isolation requires no database or filesystem setup.
