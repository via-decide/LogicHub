# CODEX AGENT RULES — via-decide/decide.engine-tools

Stack: Vanilla JS, HTML, CSS, Supabase CDN. No build step.

## Prime directive
Read every file before changing it. Make surgical edits only.

## Deployment guard
This repository deploys as a static site. Do not add npm/build tools/bundlers.

## Safety
- Do not modify protected files listed by maintainers.
- Preserve script load order in HTML.
- Keep browser-only compatibility (no process.env/require).
- Use guarded access for optional window globals.

## Verification
Before commit, run syntax/JSON/script-order checks relevant to changed files.
