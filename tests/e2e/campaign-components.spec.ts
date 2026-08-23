import { test, expect } from '@playwright/test';

const route = '/campaigns/electric-tractor-duty-replacement';

test('campaign evidence components expose state and provenance', async ({ page }) => {
  await page.goto(route);
  await expect(page.getByText('Canonical claim')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Claim dependency graph' })).toBeVisible();
  await expect(page.getByText('Aporaksha-Lab test program')).toBeVisible();
  await expect(page.getByTestId('decision-panel')).toBeVisible();
  await expect(page.getByTestId('revision-diff')).toBeVisible();
  await expect(page.getByRole('img', { name: /Synchronized simulated time-series/ })).toBeVisible();
  await expect(page.getByText('Failures are first-class evidence')).toBeVisible();
  await expect(page.getByText('Content-addressed evidence and validity')).toBeVisible();
});

test('filters do not rewrite source state', async ({ page }) => {
  await page.goto(route);
  await page.getByLabel('Filter tests by status').selectOption('FAIL');
  await expect(page.getByRole('button', { name: /PTO-01/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /DRAWBAR-01/ })).toHaveCount(0);
  await page.getByLabel('Filter tests by status').selectOption('ALL');
  await expect(page.getByRole('button', { name: /DRAWBAR-01/ })).toBeVisible();
});
