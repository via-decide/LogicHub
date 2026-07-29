# ADR-0001: Integrate the Engineering Platform as an isolated `engineering/` subtree

Date: 2026-07-22
Status: Accepted

## Context
The LogicHub v0.1 Engineering Repository Contract (KiCad hardware-collaboration platform) was
specified against `via-decide/logichub`. That repo is not empty — it's the live LogicHub app
builder (vanilla-JS canonical UI, Vercel/GitHub Pages deployment, Firebase auth, Razorpay billing)
plus a set of independent Node/TS services under `apps/*` and `packages/*` with no shared
workspace tooling (no pnpm-workspace.yaml/turbo/nx at root). The repo owner chose "new package
inside this monorepo" over a new repo or replacing the existing product.

## Decision
Add the Engineering Platform as a single self-contained subtree at `engineering/`, with its own
`pnpm-workspace.yaml`, `apps/`, `packages/`, `fixtures/`, `tests/`, `docs/`, `docker/` — mirroring
the master spec's proposed structure exactly, just rooted one level deeper.

## Consequences
- No naming collisions with existing `apps/*`/`packages/*` (`db`, `events`, `infra`, etc.).
- Root build/dev pipeline (`scripts/build-static.mjs`, static hosting) is untouched.
- The two products can be developed, tested, and released independently.
- If the Engineering Platform later becomes its own product/repo, extraction is a directory move,
  not a rewrite.
- Docs live under `engineering/docs/**`, not colliding with the existing root `docs/`.

## Alternatives considered
- Interleave `hw-*`-prefixed packages into the existing `apps/`/`packages/` — rejected: no
  workspace tool ties those together anyway, so there's no integration benefit, only naming risk.
- New repo — rejected per repo owner's explicit choice.
- Replace/pivot the existing repo — rejected per repo owner's explicit choice.
