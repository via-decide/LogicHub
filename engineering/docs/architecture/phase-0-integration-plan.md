# LogicHub Engineering Platform — Phase 0 Audit & Monorepo Integration Plan

Status: DRAFT — produced by Claude (chat), pending your sign-off before Claude Code begins Phase 1.
Repo audited: `via-decide/logichub` @ `0c169af` (main, shallow clone)

---

## 1. Audit findings

**The repo is not empty, and it is not a coherent single-stack monorepo.** It's a live product
(visual node-to-APK / app-scaffolding builder — draggable node canvas, Gemini-powered code
synthesis, ZIP export, optional APK build, Vercel + GitHub Pages deployment, Firebase auth,
Razorpay billing) plus a loose collection of independent Node/TS services under `apps/` and
`packages/` that are being wired into it as a DAXINI client (see `CURRENT_LOGICHUB_ARCHITECTURE.md`,
last merge: `implement-logichub.app-as-daxini-client-2026-07-20`).

Relevant for placement decisions:

- No `pnpm-workspace.yaml`, `turbo.json`, `lerna.json`, or `nx.json` — root `package.json` has no
  `workspaces` field. `apps/*` and `packages/*` are **independent** folders, each with its own
  `package.json`/`tsconfig.json` (e.g. `apps/api` uses plain TS + `tsx`/`tsc`, Express, no shared
  build orchestration). There is no root-level TS/pnpm tooling to inherit.
- Existing `packages/` names: `db`, `event-core`, `event-ingestion`, `events`, `infra`,
  `time-engine`. Existing `apps/`: `web`, `api`, `ai-service`, `sovereign-api`, `zayvora-brain`.
  None collide with what the Engineering Repository Contract needs, but bare names like
  `contracts`/`domain`/`shared` would be a latent collision risk later.
- Root `docs/` already holds unrelated content (`constraint-library-spec.md`,
  `copy-deck-option-a.md`, `zayvora-personality-bible.md`, `deployment.md`).

**Flag — agent control files are mismatched, fix before Claude Code runs here:**
`AGENTS.md` points to `.codex/instructions.md`, but that file's `REPO IDENTITY` header says
`via-decide/decide.engine-tools` and its entire contents (protected files like
`skillhex-mission-control`, `hex-wars`, `snake-game`, Supabase wallet economy, GitHub Pages path
rules for `/decide.engine-tools/`) describe a **different repository**. `.codex/session.md` also
references an unrelated "ALCHEMIST MODE" session. Any agent (Claude Code included) that reads
`AGENTS.md` first will load rules for the wrong project. This should be corrected — even just
replacing it with a short, accurate LogicHub-specific instructions file — before running the
Engineering Repository Contract task, so Claude Code doesn't inherit stale/foreign constraints
(or silently ignore them, which is its own risk).

## 2. Decision: isolate under a top-level `engineering/` directory

You chose to add this as a new package inside the existing monorepo rather than a new repo or a
full pivot. Given finding (1) — there's no shared workspace tooling to plug into, and the app
builder's `apps/`/`packages/` are mid-migration to DAXINI — the lowest-risk integration is a
**self-contained subtree**, not scattering hw-prefixed folders through the existing `apps/`/`packages/`:

```
engineering/                        ← new, isolated from the app-builder product
├── apps/
│   ├── api/                        (Fastify + TS)
│   └── web/                        (React + Vite)
├── packages/
│   ├── contracts/
│   ├── domain/
│   ├── persistence/
│   ├── git-adapter/
│   ├── kicad-adapter/
│   ├── engineering-graph/
│   ├── diff-engine/
│   ├── validation-engine/
│   ├── artifact-store/
│   ├── review-engine/
│   └── shared/
├── fixtures/kicad/smart-plant-pot/{base,proposed}/
├── scripts/
├── tests/{unit,integration,contract,e2e}/
├── docs/{architecture,contracts,workflows,decisions,validation,operations}/
├── docker/
├── pnpm-workspace.yaml             ← scoped to engineering/* only
├── package.json
└── README.md
```

Rationale:
- Zero collision risk with existing `apps/`/`packages/` names or the DAXINI-client migration
  in progress.
- Root build/dev (`npm run build`/`dev`, the static-site pipeline) is untouched — nothing in
  `engineering/` is on that path.
- `engineering/` gets its own `pnpm-workspace.yaml`, matching the master spec's default stack
  (pnpm, Fastify, Vite, SQLite, Zod, Vitest, Playwright, Docker Compose) exactly as written,
  without imposing pnpm on the rest of the repo, which currently doesn't use it.
- One PR / one git history, satisfying "new package inside this monorepo" — but the two products
  never import from each other in v0.1, so a future split into its own repo (if this becomes its
  own business line) is a clean directory move, not a rewrite.
- Docs land at `engineering/docs/**`, so nothing collides with the existing root `docs/`.

If you'd rather the hw platform live flatter (e.g. `apps/hw-api`, `packages/hw-contracts`
interleaved with the existing ones), that's a one-line change to this plan — flag it before
Phase 1 starts, since Claude Code will scaffold ~40+ files against whichever layout is frozen here.

## 3. What's still open before Phase 1 (contracts) starts

1. Fix or replace `AGENTS.md` / `.codex/instructions.md` / `.codex/session.md` so they describe
   this repo, or explicitly scope them to exclude `engineering/`.
2. Confirm the `engineering/` top-level name (or supply an alternative).
3. Confirm KiCad major version to pin (master spec requires pinning one; not specified in the
   task doc or repo).
4. Everything else in the original master task doc (Sections 4–25) applies unchanged, scoped to
   `engineering/`.

## 4. Why this stops at Phase 0

This plan is what's reasonably producible from a chat session: read-only repo audit, structural
decision, risk flags. The remaining phases (contracts + Zod/JSON Schema + persistence + the git
adapter + the KiCad adapter running real ERC/DRC + the diff/constraint engines + the PR/review
engine + the web app + the end-to-end Playwright run + an actual merge producing a real immutable
revision) require a persistent checkout with push access, a real KiCad toolchain, and multi-hour
autonomous execution — exactly what the master doc means by "Primary implementation target:
Claude Code." Point Claude Code at `via-decide/logichub` with the original master task doc plus
this Phase 0 plan as its starting context, and it can proceed straight into Phase 1 without
re-doing this audit.
