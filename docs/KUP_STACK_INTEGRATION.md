# KUP Stack Integration

This is LogicHub's side of KUP-STACK-001 (cross-system interoperability
coordinating LogicHub, Orchade, and ViaDecide through versioned contracts).
Full architecture and the frozen ownership matrix: `via-decide/kup-program`,
`docs/stack/`.

**Important scoping note**: this repo has two largely-independent things
under active development right now — the real, typed hardware-engineering
platform at `engineering/` (`Project`/`Revision`/`EngineeringObject`/
`Decision`/`ValidationResult`/etc., Zod + generated JSON Schema, wired into
`engineering/apps/api` and root `apps/web`), and a separate root-site
effort (`scripts/build-workspace.mjs`) currently repositioning the live
site around "hardware revision" terminology using a hardcoded fixture, not
the typed contracts. **Everything below refers to `engineering/packages/contracts`
only.** Any future KUP export adapter (KUP-STACK-001D) must read from that
real system, never the root-site fixture generator.

## What this system owns

Engineering truth: engineering project, requirements, design revision,
technical specification, BOM revision, test specification, engineering
model, equipment design, interface specification, validation result,
technical evidence. Concretely: `engineering/packages/contracts`'
`Project`, `Revision`, `EngineeringObject`, `Constraint`, `Decision`,
`Artifact`, `ChangeIntent`, `ValidationResult`, `Module`,
`EngineeringPullRequest`.

## What it does not own

Live property state, current tank level, current crop state, property
observations, or customer decision state — those belong to Orchade and
ViaDecide respectively.

**Naming note**: this package's own `Decision` schema (`question`,
`alternatives`, `rationale`, `confidence`, `status`) is an *engineering*
decision (e.g. "which component"), not the same concept as ViaDecide's
`DecisionCase` (a property/commercial decision). In any `KupCanonicalRef`,
LogicHub's decisions use `entityType: "ENGINEERING_DECISION"` — never a
bare `"DECISION"`. See kup-program's `docs/stack/CANONICAL_REFERENCE.md`.

## What it exports

Not yet built. Planned: `EngineeringArtifactExport` (KUP-STACK-001D, →
Orchade/ViaDecide), triggered by an `ENGINEERING_REVISION_RELEASED` event
once a `Revision` is validated and frozen.

## What it imports

Not yet built. Planned: `PropertyEngineeringRequirement` (KUP-STACK-001E,
from Orchade) and requirements raised from ViaDecide decisions
(KUP-STACK-001G/013). A raised requirement becomes a new `Revision` in
this system's own contracts — LogicHub never accepts a remote system's
requirement as if it were already a validated engineering fact; unknown
physical constraints (e.g. "actual dynamic head") stay explicitly UNKNOWN
rather than being silently filled in.

## Supported contract version

`KUP_INTEROP_V1` (`contractVersion: "1"`). Schema hashes pinned in
`interop/contract-lock.json`, sourced from `via-decide/kup-program` commit
`5f77a5c0eb65aa476a3a28e8e16dcd4324426def` (KUP-STACK-001A/B, PR #63 branch
tip, pending merge — update `sourceCommit` once merged; single-field change).

## Source-of-truth rules

LogicHub is the sole source of truth for engineering revisions. No other
system writes into `engineering/packages/contracts`' data directly —
Orchade raises a `PROPERTY_REQUIREMENT_RAISED` event, ViaDecide raises
`ENGINEERING_REQUIREMENT_CREATED`; LogicHub validates and creates its own
`Revision` in response.

## Failure behavior

Not yet wired to real adapters (see `_status` in `.well-known/kup-stack.json`).
Once KUP-STACK-001D lands, a consumer offline (Orchade/ViaDecide) must not
block LogicHub's own engineering work continuing locally (spec Part 24).
Failure codes follow kup-program's `docs/stack/FAILURE_AND_UNKNOWN_POLICY.md`.
