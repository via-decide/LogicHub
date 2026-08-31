// End-to-end contract for the generated physical-product workspace.
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BLOCKING = new Set(['serious', 'critical']);
async function audit(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return results.violations.filter((v) => BLOCKING.has(v.impact ?? '')).map((v) => v.id).join(', ');
}

test('uses physical-product objects and fails verification closed', async ({ page }) => {
  await page.goto('/workspace');
  await expect(page.getByRole('heading', { name: 'Nutrition Card Holder' })).toBeVisible();
  await expect(page.getByText('PRINTBYDD-NCH', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('R0.1', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('PHYSICAL PILOT PENDING').first()).toBeVisible();
  await page.getByRole('button', { name: 'VERIFICATION' }).click();
  await expect(page.getByText('GATE DATA UNAVAILABLE')).toBeVisible();
  await expect(page.getByText('NOT_RUN', { exact: true })).toHaveCount(2);
  await expect(page.getByText('PASS', { exact: true })).toHaveCount(0);
});

test('semantic comparison is typed and marks invalidated evidence', async ({ page }) => {
  await page.goto('/workspace#revisions');
  await expect(page.getByRole('heading', { name: /Baseline R0.1/ })).toBeVisible();
  await expect(page.getByText('GEOMETRY', { exact: true })).toBeVisible();
  await expect(page.getByText('REQUIRES REVALIDATION', { exact: true })).toHaveCount(2);
  await expect(page.getByText('WHAT BECAME UNTRUSTED?', { exact: false })).toBeVisible();
});

test('manufacturing release is evidence bounded', async ({ page }) => {
  await page.goto('/workspace#releases');
  await expect(page.getByRole('heading', { name: 'PRINTBYDD-NCH-R0.1' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Promote to Production/ })).toBeDisabled();
  await expect(page.getByText('Required verification gates are unsatisfied.')).toBeVisible();
});

for (const view of ['products', 'revisions', 'reviews', 'verification', 'releases']) {
  test(`${view} view is accessible and exposes current navigation`, async ({ page }) => {
    await page.goto(`/workspace#${view}`);
    await expect(page.locator(`[data-view="${view}"]`)).toHaveAttribute('aria-current', 'page');
    expect(await audit(page)).toBe('');
  });
}

for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
  test(`workspace has no viewport overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/workspace');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
