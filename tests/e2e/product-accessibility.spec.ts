// LogicHub/tests/e2e/product-accessibility.spec.ts
// Axe over the product builder, in each state it can be in.
//
// Fails on serious and critical only. Minor and moderate findings are reported
// in the failure message when something else fails, but they do not fail the
// build on their own — a check nobody can keep green stops being read.

import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BLOCKING = new Set(['serious', 'critical']);

async function audit(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  return results.violations.filter((violation) => BLOCKING.has(violation.impact ?? ''));
}

function describe(violations: Awaited<ReturnType<typeof audit>>) {
  return violations
    .map((violation) => {
      const where = violation.nodes.map((node) => node.target.join(' ')).join(', ');
      return `${violation.impact}: ${violation.id} — ${violation.help}\n    at ${where}`;
    })
    .join('\n');
}

test('an empty builder has no serious accessibility violation', async ({ page }) => {
  await page.goto('/product');
  await page.getByRole('button', { name: 'Reset' }).click();

  const violations = await audit(page);
  expect(describe(violations)).toBe('');
});

/** Adding does not select, so the node is tapped the way a person would. */
async function openFirstNode(page: Page, type: string) {
  await page.getByRole('button', { name: `+ ${type}` }).click();
  await page.locator('svg[role="img"] > g').first().click();
  await expect(page.getByText('Select a node to edit it.')).toHaveCount(0);
}

test('the node panel is accessible once a node is selected', async ({ page }) => {
  await page.goto('/product');
  await page.getByRole('button', { name: 'Reset' }).click();
  await openFirstNode(page, 'battery');

  const violations = await audit(page);
  expect(describe(violations)).toBe('');
});

test('the issues list is accessible when constraints are violated', async ({ page }) => {
  await page.goto('/product');
  await page.getByRole('button', { name: 'Reset' }).click();
  await openFirstNode(page, 'battery');

  await page.getByLabel('dischargeRating', { exact: true }).fill('25');
  await expect(page.getByRole('heading', { name: /Issues \([1-9]/ })).toBeVisible();

  const violations = await audit(page);
  expect(describe(violations)).toBe('');
});

test('every control can be reached and named', async ({ page }) => {
  await page.goto('/product');
  await page.getByRole('button', { name: 'Reset' }).click();
  await openFirstNode(page, 'battery');

  // A select with no label is announced as nothing at all, which is how both of
  // these shipped before this spec existed.
  await expect(page.getByLabel('User mode')).toBeVisible();
  await expect(page.getByLabel('Connection type')).toBeVisible();

  // The canvas is a graphic; without a name a screen reader reads past it and
  // the page appears to contain no diagram.
  await expect(page.locator('svg[role="img"]')).toHaveAttribute('aria-label', /node/);
});

test('the page has exactly one first-level heading', async ({ page }) => {
  await page.goto('/product');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});
