import { expect, test } from '@playwright/test';

const ROUTE = '/campaigns/omnidirectional-roller-wheel-small-robot-duty';

test('omni-wheel campaign traces source signal through deterministic evidence state', async ({ page }) => {
  await page.goto(ROUTE);
  await expect(page.getByRole('heading', { name: /Fabricated Omni Roller Wheel/i })).toBeVisible();
  await expect(page.getByText('SIMULATED FIXTURE DATA').first()).toBeVisible();
  await expect(page.getByText(/1000312451\.mp4/)).toBeVisible();
  await expect(page.getByTestId('decision-panel')).toContainText('CONDITIONALLY SUPPORTED');
  await expect(page.getByText('LATERAL DRAG')).toBeVisible();
  await expect(page.getByText('ENDURANCE').first()).toBeVisible();
});

test('omni-wheel acceptance transition is deterministic across roller revision', async ({ page }) => {
  await page.goto(ROUTE);
  await page.getByTestId('acceptance-baseline').click();
  await expect(page.getByTestId('decision-panel')).toContainText('SUPPORTED');
  await page.getByTestId('apply-revision-change').click();
  await expect(page.getByTestId('decision-panel')).toContainText('CONDITIONALLY SUPPORTED');
  await expect(page.getByTestId('revision-diff')).toContainText('Evidence stale');
  await expect(page.getByTestId('revision-diff')).toContainText('EV-TRACTION-RAW');
});
