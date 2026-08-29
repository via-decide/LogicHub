# System Overview

## Why this architecture exists

LogicHub turns a KiCad hardware project into something reviewable the way a software pull request is: import a revision, diff it semantically against a base, gate a merge on real evidence (ERC/DRC, constraints, decisions, approvals), and merge only through an explicit human action. Six architectural principles (master spec section 1) shape every package boundary described below:

1. **Git remains the file-history authority** — LogicHub does not reimplement version control. Every `Revision` references a real Git commit SHA (`git-adapter`), and LogicHub only adds semantic information keyed to that SHA.
2. **Engineering state is larger than a Git tree** — a `Revision` is the git commit *plus* its engineering-object snapshot, constraint set, decision records, artifact manifest, validation results, BOM snapshot, and tool-version metadata (`docs/architecture/domain-model.md`).
3. **Revisions are immutable** — once created, a revision's SHA, snapshot, artifacts, and validation results never change. Corrections create a new revision, never an edit to an old one. `persistence`'s repositories expose no update-in-place operation for these fields.
4. **Generated artifacts are content-addressed** — every artifact is stored and looked up by its SHA-256 hash (`docs/architecture/artifact-storage.md`).
5. **Unknown is not pass** — validation and constraint states distinguish `pass` / `warning` / `fail` / `error` / `unknown` / `skipped` / `requires_validation`. Missing evidence (no kicad-cli, an unparseable constraint expression) is reported as such, never silently treated as a pass — this is the "never fabricate a result" convention that runs through kicad-adapter, `constraint-evaluation.ts`, and the merge gates alike.
6. **Human approval remains required** — `MergeService` never merges without recomputing all 16 merge gates immediately beforehand, and gate 13 (`REQUIRED_APPROVALS_SATISFIED`) is unconditionally one of them.

## Technology stack actually in use

Master spec section 2 says preserve an existing coherent stack, else default to a specific list. `engineering/` already had a coherent stack from Phases 0–4, which Phases 5–8 continued rather than replaced: TypeScript, Node.js, pnpm workspaces, Fastify (`apps/api`), SQLite via `better-sqlite3` (`persistence`), Zod (contracts' runtime schemas), generated JSON Schema, Vitest, Playwright, and a local content-addressed filesystem `ArtifactStore`. `apps/web` (the browser UI) uses Next.js/React rather than a bare Vite + React SPA, since it already existed as a separate pnpm workspace at the repo root (`docs/operations/local-development.md`) — its App Router and Server Components are used for the read side (project/revision/PR pages fetch directly), with Client Components only where interactivity is required (review actions, recalculate, merge).

## Package map

```
engineering/
├── packages/
│   ├── contracts/          Types, Zod schemas, JSON Schema for every domain entity
│   ├── shared/              Error codes, createLogicHubError
│   ├── git-adapter/         Restricted, argument-array-only Git operations
│   ├── kicad-adapter/       KiCad project parsing, extraction, ERC/DRC, rendering
│   ├── repository-engine/   Fingerprinting + semantic diff (semdiff) algorithms
│   ├── persistence/         SQLite repositories, migrations, snapshot hashing
│   ├── artifact-store/      Content-addressed artifact storage
│   ├── validation-engine/   Pure physical-rule calculations (unrelated to Phase 5-8 constraint evaluation -- see ADR-0004)
│   ├── review-engine/       Pure PR review-state folding + all 16 merge gates
│   └── domain/              Application orchestration: import, diff, review, merge, catalog
└── apps/
    └── api/                 Fastify HTTP API -- imports only from domain + contracts

apps/web/ (repo root, separate pnpm workspace)
                              Next.js UI: projects, revisions, diff, PR review
```

## Request flow, end to end

```
Browser (apps/web)
  │  fetch (client-side, NEXT_PUBLIC_LOGICHUB_API_URL)
  │  or direct read (Server Component, LOGICHUB_API_URL)
  ▼
apps/api (Fastify routes.ts)
  │  imports only from domain (+ contracts for types) -- ADR-0003
  ▼
domain services (ImportService, RevisionComparisonService,
                  ReviewService, MergeService, CatalogService, BranchService)
  │  orchestrate, perform I/O, persist results
  ├─→ git-adapter        (real git operations)
  ├─→ kicad-adapter       (parsing, extraction, ERC/DRC, rendering)
  ├─→ repository-engine   (fingerprint + semantic diff -- pure)
  ├─→ review-engine       (merge-gate policy -- pure)
  ├─→ persistence         (SQLite repositories)
  └─→ artifact-store      (content-addressed storage)
```

`apps/api/src/app-context.ts` is the single composition root: the only place that imports `persistence` and `artifact-store` directly to construct concrete repository/store instances and wire them into the `domain` services. Every route handler in `routes.ts` talks only to the services on that context.

## API surface

25 endpoints across projects, branches, revisions, change intents, validation, diff, pull requests, artifacts, and modules — see `apps/api/src/routes.ts`. Full detail in each workflow doc (`docs/workflows/*.md`); the pull-request lifecycle table is in `docs/workflows/engineering-pr.md`.

## Observability

`domain` services accept an optional `DomainEventSink` and emit structured events at the moments listed in `docs/architecture/domain-model.md`'s event table; `apps/api`'s composition root wires a default sink that writes one JSON line per event to stdout, swappable for a real log/metrics pipeline without touching any service. Not every event name master spec section 19 lists is emitted yet — see that section for the full minimum list and `docs/architecture/domain-model.md` for exactly which subset Phases 5–8 implemented and why.

## What is authoritative vs. derived

- **Authoritative**: the Git repository (file history), the SQLite rows for `Project` / `Revision` / `EngineeringObject` / `Constraint` / `Decision` / `Artifact` / `ValidationResult` / `Module` / `EngineeringPullRequest`, and content in `ArtifactStore` keyed by SHA-256.
- **Derived, recomputed on demand, never cached as truth**: the semantic diff between two revisions (`docs/workflows/revision-diff.md`), constraint evaluation outcomes, and merge-gate eligibility (`docs/validation/merge-gates.md`). The one exception is the `revision_manifest` fingerprint cache, which is itself just a hash-verified `Artifact` — a plain cache, not a second source of truth, and is discarded and rebuilt on any verification failure.
