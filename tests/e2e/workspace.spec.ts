// LogicHub/tests/e2e/workspace.spec.ts
// End-to-end: claim an issue, submit telemetry that fails tolerance, watch
// the gate refuse it, retry with a corrected payload, watch it pass, and
// confirm the release panel still reports no funds moved. Plus axe over
// all three tabs.
//
// Runs against scripts/dev-marketplace-server.mjs (the "marketplace"
// Playwright project below) — the real api/marketplace/* handlers over
// plain Node http, backed by an in-memory fake db seeded with one open
// issue (ISSUE-E2E). Not a mock of the handlers; the same functions Vercel
// would invoke, just not Vercel's own routing — see that script's header
// for why (no live DATABASE_URL or confirmed Vercel CLI setup in this
// environment to verify a real `vercel dev` flow against).

import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Resets ISSUE-E2E to OPEN before every test. The server's fake db is
// shared across the whole run (one process, restarted per file at most) --
// without this, a test that claims/fails/passes the issue leaves it
// CLAIMED or MERGED for whichever test runs next, which would then find no
// open issue to claim at all. Real requests, not a mock — same handler-
// invocation path the other requests here use, just a route this test
// server exposes and no production deployment would.
test.beforeEach(async ({ request }) => {
  await request.post('/test/reset');
});

const BLOCKING = new Set(['serious', 'critical']);

async function audit(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations
    .filter((violation) => BLOCKING.has(violation.impact ?? ''))
    .map((violation) => {
      const where = violation.nodes.map((node) => node.target.join(' ')).join(', ');
      return `${violation.impact}: ${violation.id} — ${violation.help}\n    at ${where}`;
    })
    .join('\n');
}

test('claim, fail, retry, pass, and confirm no funds moved', async ({ page }) => {
  await page.goto('/workspace');

  // --- Open Repo: the seeded issue is real, not a fixture array --------
  await expect(page.locator('[data-claim="ISSUE-E2E"]')).toBeVisible();
  await page.click('[data-claim="ISSUE-E2E"]');

  // Claiming auto-switches to Pull Request (setActivePullRequest calls
  // selectTab) — confirms the tab is now selected via aria-selected, not
  // just visually.
  await expect(page.locator('#tab-pull-request')).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });
  await expect(page.locator('#activePrTag')).not.toHaveText('no pull request selected');

  // --- Submit telemetry that fails tolerance (target 25.00 ± 0.05) -----
  await page.fill('#dimA', '30.00');
  await page.fill('#wallThickness', '142.5');
  await page.click('#submitBtn');

  await expect(page.locator('#verdictTable')).toBeVisible({ timeout: 10_000 });
  const firstVerdict = page.locator('#verdictRows tr').first();
  await expect(firstVerdict.locator('.badge')).toContainText('failed');

  // The gate genuinely refuses: release stays disabled, no condition
  // silently reads as satisfied.
  await expect(page.locator('#releaseBtn')).toBeDisabled();
  const failedConditions = await page.locator('#releaseConditions .badge.fail').count();
  expect(failedConditions).toBeGreaterThan(0);

  // --- Retry: FAILED is terminal for this pull request (see run-ci.js /
  // reopenIssueAfterFailure) -- a corrected submission means claiming
  // again, which the reopened issue now allows. ------------------------
  await page.click('[role="tab"][data-view="open-repo"]');
  await expect(page.locator('[data-claim="ISSUE-E2E"]')).toBeVisible();
  await page.click('[data-claim="ISSUE-E2E"]');
  await expect(page.locator('#tab-pull-request')).toHaveAttribute('aria-selected', 'true');

  // --- Submit a corrected payload, inside tolerance --------------------
  await page.fill('#dimA', '25.00');
  await page.fill('#wallThickness', '142.5');
  await page.click('#submitBtn');

  await expect(page.locator('#verdictTable')).toBeVisible({ timeout: 10_000 });
  const passedVerdict = page.locator('#verdictRows tr').first();
  await expect(passedVerdict.locator('.badge')).toContainText('passed');

  // Every condition genuinely PASSED — release becomes reachable.
  await expect(page.locator('#releaseBtn')).toBeEnabled();
  const stillFailing = await page.locator('#releaseConditions .badge.fail, #releaseConditions .badge.pending').count();
  expect(stillFailing).toBe(0);

  // --- Release: no funds move, and the page says so, not a generic error
  await page.click('#releaseBtn');
  await expect(page.locator('#submitStatus')).toContainText('No charge has been made', { timeout: 10_000 });
});

test('a PENDING condition never renders as satisfied', async ({ page }) => {
  await page.goto('/workspace');
  await page.click('[data-claim="ISSUE-E2E"]');
  // Before any submission, "Telemetry submitted" is PENDING, not PASSED --
  // the exact bug class the plan called out (a mockup that marked a
  // pending rule green). It must render with the pending badge class, not
  // the pass one, and release must stay disabled.
  await expect(page.locator('#releaseConditions .condition').first().locator('.badge')).toHaveClass(/pending/);
  await expect(page.locator('#releaseConditions .badge.pass')).toHaveCount(0);
  await expect(page.locator('#releaseBtn')).toBeDisabled();
});

test('the standing payments notice is present and matches the real disabled-payments wording', async ({ page }) => {
  await page.goto('/workspace');
  await expect(page.locator('.notice')).toContainText('No payment is taken on this deployment');
});

// --- accessibility over all three tabs ------------------------------------

const TABS = ['open-repo', 'local-branch', 'pull-request'] as const;

for (const view of TABS) {
  test(`${view} tab has no serious accessibility violation`, async ({ page }) => {
    await page.goto('/workspace');
    await page.click(`[role="tab"][data-view="${view}"]`);
    await expect(page.locator(`#tab-${view}`)).toHaveAttribute('aria-selected', 'true');
    expect(await audit(page)).toBe('');
  });
}

test('tabs are keyboard-navigable via arrow keys, per WAI-ARIA tablist pattern', async ({ page }) => {
  await page.goto('/workspace');
  await page.locator('#tab-open-repo').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tab-local-branch')).toBeFocused();
  await expect(page.locator('#tab-local-branch')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tab-pull-request')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#tab-open-repo')).toBeFocused();
});

test('dimA and wallThickness have real programmatic labels', async ({ page }) => {
  await page.goto('/workspace');
  await expect(page.getByLabel('Micrometer reading — diameter')).toHaveId('dimA');
  await expect(page.getByLabel('Weight reading')).toHaveId('wallThickness');
});
