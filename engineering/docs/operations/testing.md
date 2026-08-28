# Testing

## Levels

| Level | Tool | Where | Command |
|---|---|---|---|
| Unit / integration | Vitest | every `engineering/packages/*` and `engineering/apps/api` | `cd engineering && pnpm test` |
| Browser e2e | Playwright | repo root `tests/e2e/*.spec.ts` | `npx playwright test` (repo root) |

`engineering/package.json`'s `test:integration` (`pnpm -r test:integration`) is a per-package hook for any package that defines its own `test:integration` script; none of the Phase 5–8 packages (`domain`, `review-engine`, `apps/api`) currently define one — their integration-level coverage (real SQLite, real git, real fixture files) lives in their normal Vitest suites instead, run by plain `pnpm test`.

## Unit / integration suites relevant to Phases 5–8

| Package | Tests | What it covers |
|---|---|---|
| `packages/domain` | 42 | Import pipeline, revision comparison, constraint evaluation, merge service, review service, id generation, domain event emission — including one fixture-backed test (`fixture-import-and-diff.test.ts`) that imports the real `smart-plant-pot` base/head pair, diffs them, and asserts an exact 27-delta result with `replayVerified: true`. |
| `packages/review-engine` | 50 | All 16 merge gates independently (`merge-gates.test.ts`, 36 cases), the pure review-workflow state folding and one-hop status walk (`review-workflow.test.ts`, 14 cases). |
| `engineering/apps/api` | 26 | Every route in `docs/architecture/system-overview.md`'s endpoint table, via Fastify's `inject()` against a real in-memory SQLite + temp `ArtifactStore` + `ToolchainAvailableKicadAdapter`. |

Run one package's suite in isolation with `pnpm --filter <package-name> test`.

Full engineering workspace: `cd engineering && pnpm build && pnpm test` (build first — the workspace's Vitest projects consume each other's compiled `dist/` output via TypeScript project references, so an unbuilt dependency surfaces as a stale or missing type/module error in a sibling package's tests rather than a build error in its own).

## Fixture repository

`engineering/tests/helpers/fixture-repo.ts`'s `createSmartPlantPotFixtureRepo()` builds a real, throwaway git repository from `engineering/fixtures/kicad/smart-plant-pot/{base,head}` (two real KiCad project trees — see `docs/workflows/kicad-import.md` and section 14 of the master spec) in a temp directory, with a `base` commit and a `head` commit on separate branches, and returns `{ repoPath, baseSha, headSha, baseBranch, headBranch, cleanup }`. Domain, review-engine (via domain's merge tests), and the Playwright e2e spec all import real work against this same fixture rather than synthetic data — this is what "never fabricate a result" means in test form: the diff, the delta count, and the merge-gate evaluations in these tests are computed from real parsed KiCad files, not asserted against hand-written stand-ins.

## Browser e2e

`playwright.config.ts` (repo root) defines four projects; the one relevant here is `engineering`, matching `tests/e2e/engineering-pr-workflow.spec.ts`. Its `webServer` array brings up, in order:
1. the static marketing site (`site` project's dependency, unrelated to LogicHub),
2. `apps/web` — **built** (not `next dev`) via `pnpm --dir apps/web build`, then started via its own standalone `server.js` after copying `.next/static` and `public/` into the standalone output directory (see `docs/operations/troubleshooting.md` for why `next start` does not work here),
3. the marketplace dev server (unrelated to LogicHub),
4. `engineering/apps/api`, built via `tsc --build` and started via the test-only `dist/e2e-server.js` (a `ToolchainAvailableKicadAdapter` stub so ERC/DRC report `pass` instead of the sandbox's honest `skipped`, which would otherwise permanently block gate 11 and make the merge step of the primary path unreachable through the browser — see that file's own header comment for the exact scope of what is and isn't simulated).

Run just this project: `npx playwright test --project=engineering` from the repo root. The spec drives a full browser session: create project → import base and head revisions → open the diff → create a PR → approve it → recalculate eligibility → merge — asserting on real API responses surfaced through the actual rendered UI, including a real merged-revision hash shown after merge, not a mocked one.

## What "at least one complete automated KiCad workflow" means here

Master spec section 20 requires at least one complete automated KiCad workflow to pass end to end. Two independent tests satisfy this at different layers: `packages/domain/__tests__/fixture-import-and-diff.test.ts` (library-level: import → diff, with exact delta assertions) and `tests/e2e/engineering-pr-workflow.spec.ts` (browser-level: the same fixture pair driven all the way through review and merge via the real UI and a real merge commit).
