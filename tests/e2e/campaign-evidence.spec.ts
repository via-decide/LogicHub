import { test, expect } from '@playwright/test';

const route = '/campaigns/electric-tractor-duty-replacement';

test('campaign traceability: claim → dependency → test → evidence → revision impact → decision', async ({ page }) => {
  await page.goto(route);
  await expect(page.getByRole('heading', { name: 'Electric Tractor — Defined Agricultural Duty Replacement' })).toBeVisible();
  await expect(page.getByText('SIMULATED FIXTURE DATA').first()).toBeVisible();

  await page.getByRole('button', { name: /Battery, / }).click();
  await expect(page.getByTestId('dependency-detail')).toContainText('Battery');

  await page.getByRole('button', { name: /THERMAL-01.*Thermal soak/i }).click();
  await expect(page.getByRole('dialog').first()).toContainText('OBSERVATION');
  await expect(page.getByRole('dialog').first()).toContainText('CALCULATION');
  await expect(page.getByRole('dialog').first()).toContainText('INTERPRETATION');
  await expect(page.getByRole('dialog').first()).toContainText('CLAIM IMPACT');

  await page.getByRole('button', { name: /EV-THERM-R07/ }).click();
  await expect(page.getByRole('dialog').last()).toContainText('sha256:');
  await expect(page.getByRole('dialog').last()).toContainText('THERMAL-R02');
  await page.getByRole('dialog').last().getByRole('button', { name: 'Close' }).click();
  await page.getByRole('dialog').first().getByRole('button', { name: 'Close test detail' }).click();

  await page.getByTestId('acceptance-baseline').click();
  await expect(page.getByTestId('decision-panel')).toContainText('SUPPORTED');

  await page.getByTestId('apply-revision-change').click();
  await expect(page.getByTestId('decision-panel')).toContainText('CONDITIONALLY SUPPORTED');
  await expect(page.getByTestId('decision-panel')).toContainText('REVIEW REQUIRED');
  await expect(page.getByTestId('revision-diff')).toContainText('EV-THERM-R07');
  await expect(page.getByTestId('revision-diff')).toContainText('CONT-01');
});

test('critical campaign fields stay usable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(route);
  await expect(page.getByText('KUP-CLAIM-TRACTOR-001')).toBeVisible();
  await expect(page.getByTestId('decision-panel')).toBeVisible();
  await expect(page.getByText('TRACTOR-R07').first()).toBeVisible();
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1);
});
