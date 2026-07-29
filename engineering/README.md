# LogicHub Engineering Platform

Git-backed collaboration platform for KiCad hardware projects: engineering pull requests,
schematic/PCB visual diffs, BOM deltas, typed constraints, ERC/DRC validation, and merge gates.

This is a separate product from the root LogicHub app builder — see `../AGENTS.md`. Nothing here
imports from or is imported by the root app in v0.1.

Status: Phase 0 (scaffold only — no implementation yet). Start here:
- `docs/architecture/00-master-task-spec.md` — the frozen contract (authoritative scope)
- `docs/decisions/adr-0001-engineering-platform-integration.md` — why this lives where it does
- `docs/architecture/phase-0-integration-plan.md` — repo audit + placement rationale

Package/app layout follows the master spec §3. Each package/app directory has its own README
stating its responsibility; none contain implementation yet — that's Phase 1 onward.
