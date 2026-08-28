# @logichub-engineering/domain

Application orchestration layer (ADR-0003): the only package that composes persistence, git-adapter,
kicad-adapter, and repository-engine into workflows with side effects.

- `ImportService` — the KiCad import pipeline (`docs/workflows/kicad-import.md`): resolve a git
  ref, extract engineering objects + BOM, build the whole-repo fingerprint, generate render/ERC/DRC
  evidence when the toolchain is available, and persist one immutable revision.
- `RevisionComparisonService` — loads (or rebuilds, with a hash-verified cache) two revisions'
  fingerprints, calls `repository-engine.computeSemDiff`, and evaluates blocking constraints
  against the resulting deltas.
- `evaluateConstraints` / `hasBlockingConstraintViolation` — the constraint-evaluation approach
  documented in `docs/decisions/adr-0004-constraint-evaluation.md`. Feeds merge gate #10.
- `VisualDiffService` — side-by-side rendered-SVG schematic/PCB comparison, honestly reporting
  `skipped` when kicad-cli is unavailable rather than fabricating a render.

Review-engine's merge-gate evaluation and apps/api both build on top of this package; neither
imports repository-engine, kicad-adapter, or git-adapter directly (ADR-0003 boundary rule: only
`domain` imports across engine packages).
