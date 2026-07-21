# Agent Control — via-decide/logichub

This repo hosts two independent products. Read `.codex/instructions.md` before editing anything
outside `engineering/`; read `engineering/docs/architecture/` before editing anything inside it.

## 1. LogicHub (root) — the app builder
Visual node-canvas app scaffolding tool. Canonical UI is the single-file `index.html`, with
supporting pages under `pages/`, `admin/`, `src/studio/`. See `CURRENT_LOGICHUB_ARCHITECTURE.md`
for the current state — it's mid-migration to route runtime calls through `window.LogicHubSDK` /
DAXINI Gateway instead of calling Gemini/Firebase directly. No bundler at the root; build/dev use
`scripts/build-static.mjs` / `scripts/serve-static.mjs`. `apps/*` and `packages/*` are independent
Node/TS services (own `package.json`/`tsconfig.json` each — there is no root pnpm/turbo/nx
workspace tying them together).

## 2. LogicHub Engineering Platform — `engineering/`
A separate, self-contained product: a Git-backed KiCad hardware-collaboration platform (engineering
PRs, ERC/DRC, visual diffs, constraint engine). Fully isolated under `engineering/` with its own
`pnpm-workspace.yaml`. Does not import from or get imported by the root app builder in v0.1. Spec:
`engineering/docs/architecture/00-master-task-spec.md`. Current phase status:
`engineering/docs/decisions/adr-0001-engineering-platform-integration.md`.

## General rules
- Read a file fully before editing it. The root app has large single-file surfaces
  (`index.html`, `onboarding.html`) — prefer surgical edits over rewrites there.
- Don't introduce a bundler/framework at the repo root without asking first.
- Don't add dependencies to `engineering/*` packages beyond what their own `package.json`
  declares as intent — flag it instead.
- If a rule here conflicts with what you find in the code, the code wins — say so and ask rather
  than guessing.
