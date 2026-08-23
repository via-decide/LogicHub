import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const route = '/campaigns/electric-tractor-duty-replacement';

test('campaign evidence console has no serious or critical axe violations', async ({ page }) => {
  await page.goto(route);
  const result = await new AxeBuilder({ page }).analyze();
  const blocking = result.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious');
  expect(blocking).toEqual([]);
});
