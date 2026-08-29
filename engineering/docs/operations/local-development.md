# Local Development

## Layout

LogicHub spans two separate package managers/workspaces (ADR-0001):

- `engineering/` — its own pnpm workspace (`engineering/pnpm-workspace.yaml`: `apps/*`, `packages/*`). This is where every LogicHub package lives: `contracts`, `git-adapter`, `kicad-adapter`, `repository-engine`, `domain`, `review-engine`, `persistence`, `artifact-store`, and `apps/api`.
- `apps/web/` (repo root) — a separate pnpm workspace (its own `pnpm-workspace.yaml`), the Next.js 16 UI. It is not a member of `engineering/`'s workspace and is built/run independently.
- Repo root — an npm-managed static site plus the root Playwright config that drives the browser e2e suite across both of the above.

There is no LogicHub CLI (`pnpm logichub ...`) — the equivalent workflows described in the master spec (import, diff, PR create, merge) are exposed as HTTP endpoints on `apps/api` and driven through `apps/web`'s UI, not a command-line tool.

## Install

```sh
cd engineering && pnpm install
cd ../apps/web && pnpm install
```

## Build

```sh
cd engineering && pnpm build      # tsc --build across every workspace package + apps/api
cd apps/web && pnpm build         # next build --webpack (output: 'standalone')
```

## Typecheck / lint

```sh
cd engineering && pnpm typecheck  # same tsc --build project graph as build
cd engineering && pnpm lint       # pnpm -r lint (per-package tsc --build)
cd apps/web && pnpm lint          # eslint
```

## Run the API locally

```sh
cd engineering/apps/api
pnpm build
LOGICHUB_DB_PATH=./dev.db LOGICHUB_ARTIFACT_STORE=./dev-artifacts node dist/main.js
```

`main.js` uses a real `KicadAdapter` — ERC/DRC honestly report `status: 'skipped'` unless `kicad-cli`/`pcbnew` is actually on `PATH` (see `docs/workflows/kicad-import.md`). For a fixed toolchain-available server useful for manual UI testing without KiCad installed, use the test-only `dist/e2e-server.js` entrypoint instead (never used in production — see its file header).

## Run the web app locally

```sh
cd apps/web
NEXT_PUBLIC_LOGICHUB_API_URL=http://127.0.0.1:3000 LOGICHUB_API_URL=http://127.0.0.1:3000 pnpm dev
```

`LOGICHUB_API_URL` covers server-side fetches (Server Components); `NEXT_PUBLIC_LOGICHUB_API_URL` is required separately for client-side fetches (the review/merge action buttons) because Next.js only inlines `NEXT_PUBLIC_`-prefixed vars into the browser bundle, and only at build time.

## Full stack via Playwright's webServer

For a one-command working stack (API + web, both built and wired together correctly, including the standalone-server static-asset copy step), see `docs/operations/testing.md` — `playwright.config.ts`'s `webServer` array is the authoritative, tested way to bring both up together.
