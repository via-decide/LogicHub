# CODEX AGENT RULES — via-decide/decide.engine-tools

Repository stack: Vanilla JS + HTML + CSS (no build step).

## Prime directive
- Read every file before changing it.
- Surgical edits only.
- Do not modify protected files/functions listed in user instructions.

## Required safety rules
- Keep script ordering intact.
- Do not mix module/non-module patterns incorrectly.
- Avoid duplicate const declarations.
- Do not add orphan object literals.
- Keep IIFE wrappers valid.
- Never hardcode Supabase anon keys.

## Pre-commit checks expected by operator
1. `grep -n "const canonicalRoute" router.js`
2. `grep -n "const navLinks\|const sections" router.js`
3. `node --check router.js 2>&1`
4. `python3 -c "import json; json.load(open('tools-manifest.json'))"`
5. `grep -n "bar.href" shared/vd-nav-fix.js`
6. `grep -n "example.supabase.co\|replace-with-anon-key" tools/eco-engine-test/index.html`
7. `grep -n "!important" tools/games/*/index.html | grep -i "transform\|opacity"`
8. For modified HTML files, confirm `<script>` tags are balanced.

## Output contract
After each task, provide:
- change table (`File | Change | Lines affected | Verified`)
- skipped files and reason
- failed checks list
