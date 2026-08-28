# tests/e2e (this directory)

The actual browser-based Phase 8 spec lives at the repository root:
`tests/e2e/engineering-pr-workflow.spec.ts`, run via the root `playwright.config.ts`'s
`engineering` project (`npx playwright test --project=engineering`).

It could not live inside this directory: `apps/web` (the browser UI) sits at the
repository root, outside this `engineering/` pnpm workspace (see
`docs/decisions/adr-0001-engineering-platform-integration.md`), and the root
`playwright.config.ts` already owns the webServer orchestration for that app. The
spec seeds a project and imports both smart-plant-pot revisions via direct API calls
(covered end-to-end by `packages/domain/__tests__/fixture-import-and-diff.test.ts`,
`packages/domain/__tests__/merge-service.test.ts`, and
`apps/api/__tests__/api.test.ts`, none of which need a browser), then drives the
actual rendered UI through the primary user path: opening a real pull request,
reading its diff/constraint/validation evidence across tabs, approving it,
recalculating eligibility, merging it, and following through to the newly created
merged revision to confirm real (non-empty) snapshot hashes were recorded.

`apps/api`'s test-only `src/e2e-server.ts` entrypoint (started by that same
Playwright config) simulates a toolchain-equipped environment for ERC/DRC only --
this sandbox has no kicad-cli -- so the merge half of the path is reachable; every
other engine call (parsing, extraction, fingerprinting, diffing, constraint
evaluation, merge-gate policy) is completely real. See that file's header comment
for the full rationale.
