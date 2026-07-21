# CODEX AGENT RULES — via-decide/logichub
# Codex/Claude Code reads this before every task in this repo.

════════════════════════════════════════════
REPO IDENTITY
════════════════════════════════════════════

This is via-decide/logichub — NOT decide.engine-tools. If you are looking for
skillhex-mission-control, hex-wars, snake-game, or the Supabase wallet economy rules, you are in
the wrong repo; those belonged to a different project and any earlier copy of this file
referencing them was a mistake, now corrected.

Two independent products live here — see `AGENTS.md` §1/§2 for which one you're touching.

════════════════════════════════════════════
ROOT APP (LogicHub app builder)
════════════════════════════════════════════

Stack: mostly vanilla JS/HTML/CSS, no bundler, no build step for the canonical `index.html`.
Independent Node/TS services live under `apps/*` and `packages/*`, each with its own
package.json — there is no shared workspace tool, so don't assume a root `pnpm install` wires
them together.

Rules:
- Never introduce `process.env` or Node built-ins into browser-loaded HTML/JS files.
- Auth/runtime calls are migrating to `window.LogicHubSDK` → DAXINI Gateway; don't add new direct
  Gemini/Firebase calls from UI code — check `CURRENT_LOGICHUB_ARCHITECTURE.md` first.
- Before committing: verify modified `.js`/`.html` files have no syntax errors
  (`node --check <file>` for plain scripts) and that any modified JSON is valid.

════════════════════════════════════════════
ENGINEERING PLATFORM — engineering/
════════════════════════════════════════════

Separate rules live at `engineering/docs/architecture/00-master-task-spec.md` (the frozen
contract) and `engineering/docs/decisions/`. That spec is authoritative for anything under
`engineering/`; this file only governs the root app.

════════════════════════════════════════════
WHEN IN DOUBT
════════════════════════════════════════════

Ask before acting on anything ambiguous, destructive, or outside the stated scope of the task.
