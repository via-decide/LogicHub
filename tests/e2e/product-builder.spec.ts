// LogicHub/tests/e2e/product-builder.spec.ts
// The product builder, exercised in a real browser.
//
// The engine runs client-side, which is the whole point of the page — a design
// is never sent anywhere. That also means nothing on the server can tell us the
// propagation still works after a bundle change. Until now the only check was
// opening the page and looking at it.

import { test, expect, type Page } from '@playwright/test';

/** Collects anything the page logs as an error, so a silent break is loud here. */
function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  page.on('pageerror', (error) => problems.push(String(error)));
  return problems;
}

async function fresh(page: Page) {
  const problems = watchConsole(page);
  await page.goto('/product');
  // The graph persists to local storage, so a previous test's nodes would
  // otherwise still be here.
  await page.getByRole('button', { name: 'Reset' }).click();
  return problems;
}

/**
 * Add a node and open it.
 *
 * Adding does not select — the panel stays on "Select a node to edit it" — so
 * the node has to be tapped on the canvas the way a person would.
 */
async function addAndOpen(page: Page, type: string) {
  const canvas = page.locator('svg[role="img"]');
  const before = await canvas.locator('> g').count();

  await page.getByRole('button', { name: `+ ${type}` }).click();
  await expect(canvas.locator('> g')).toHaveCount(before + 1);

  await canvas.locator('> g').nth(before).click();
  await expect(page.getByText('Select a node to edit it.')).toHaveCount(0);
}

test('the page loads and says where the design lives', async ({ page }) => {
  const problems = await fresh(page);

  await expect(page.getByRole('heading', { name: 'Product Builder' })).toBeVisible();
  await expect(page.getByText('not sent anywhere')).toBeVisible();
  expect(problems).toEqual([]);
});

test('adding a node puts it on the canvas', async ({ page }) => {
  await fresh(page);

  await expect(page.locator('svg[role="img"]')).toHaveAttribute('aria-label', /0 nodes/);
  await page.getByRole('button', { name: '+ battery' }).click();
  await expect(page.locator('svg[role="img"]')).toHaveAttribute('aria-label', /1 node,/);
});

test('a battery resolves a voltage without being told one', async ({ page }) => {
  await fresh(page);
  await addAndOpen(page, 'battery');

  // Nothing supplied a voltage; the plugin derived it from chemistry and cells.
  const derived = page.locator('dl').first();
  await expect(derived).toContainText('nominalVoltageV');
  await expect(derived).not.toContainText('Nothing resolved yet.');
});

test('editing a parameter recalculates the derived value', async ({ page }) => {
  const problems = await fresh(page);
  await addAndOpen(page, 'battery');

  const voltage = page.locator('dl').first()
    .locator('div', { has: page.getByText('nominalVoltageV', { exact: true }) })
    .locator('dd');
  // Three lipo cells.
  await expect(voltage).toHaveText('11.1');

  await page.getByLabel('cellCount', { exact: true }).fill('6');

  // Six of them, derived rather than typed in.
  await expect(voltage).toHaveText('22.2');
  expect(problems).toEqual([]);
});

test('a motor with no supply never reaches CAN MAKE', async ({ page }) => {
  await fresh(page);

  // A motor alone has no supply. The matcher should not call this makeable.
  await page.getByRole('button', { name: '+ motor' }).click();

  const verdicts = page.getByText('CAN MAKE');
  await expect(verdicts).toHaveCount(0);
});

test('every candidate product carries a verdict, never a blank', async ({ page }) => {
  await fresh(page);

  for (const type of ['battery', 'controller', 'motor']) {
    await page.getByRole('button', { name: `+ ${type}` }).click();
  }
  await expect(page.locator('svg[role="img"]')).toHaveAttribute('aria-label', /3 nodes/);

  const section = page.getByRole('heading', { name: 'What this could become' })
    .locator('xpath=..');
  const entries = section.locator('li');
  await expect(entries).not.toHaveCount(0);

  // An unmatched template must read as one of the three verdicts. A candidate
  // with no verdict beside it looks like a possibility that was simply not
  // assessed, which is the ambiguity the verdict scale exists to remove.
  for (const text of await entries.allTextContents()) {
    expect(text).toMatch(/CAN MAKE|ALMOST POSSIBLE|NOT RECOMMENDED/);
  }
});

test('kit matches never claim a component is sourced or purchasable', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: '+ battery' }).click();
  await page.getByRole('button', { name: '+ motor' }).click();

  const kits = page.getByRole('heading', { name: 'Matching kits' }).locator('xpath=..');
  const entries = kits.locator('li');

  if (await entries.count() > 0) {
    // Every kit line carries the disclaimer. A match percentage next to a kit
    // name reads like something you could buy, and nothing here can be bought.
    for (const text of await entries.allTextContents()) {
      expect(text).toContain('no component sourced');
      expect(text).toContain('not purchasable');
    }
  }
});

test('the page never claims a design has been validated', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: '+ battery' }).click();

  const body = await page.locator('body').innerText();

  expect(body).toContain('Nothing here has been built, measured, sourced, or certified');
  // The only occurrences of these words are denials of them.
  for (const claim of [/\bis certified\b/i, /\bproduction[- ]ready\b/i, /\bchild[- ]safe\b/i]) {
    expect(body).not.toMatch(claim);
  }
});

test('a violated constraint is reported rather than swallowed', async ({ page }) => {
  const problems = await fresh(page);
  await addAndOpen(page, 'battery');

  await expect(page.getByRole('heading', { name: 'Issues (0 error, 0 warning)' })).toBeVisible();

  // 2200 mAh at 25C is 55 A, well past the 20 A ceiling explore mode publishes.
  // High-current packs are exactly what beginner bounds exist to refuse.
  await page.getByLabel('dischargeRating', { exact: true }).fill('25');

  await expect(page.getByRole('heading', { name: /Issues \([1-9]/ })).toBeVisible();
  // A constraint violation is a result, not a crash.
  expect(problems).toEqual([]);
});

test('the graph survives a reload, because it is stored on the device', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: '+ battery' }).click();
  await page.getByRole('button', { name: '+ motor' }).click();

  await page.reload();

  await expect(page.locator('svg[role="img"]')).toHaveAttribute('aria-label', /2 nodes/);
});

test('reset clears the canvas', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: '+ battery' }).click();
  await expect(page.locator('svg[role="img"]')).toHaveAttribute('aria-label', /1 node,/);

  await page.getByRole('button', { name: 'Reset' }).click();

  await expect(page.locator('svg[role="img"]')).toHaveAttribute('aria-label', /0 nodes/);
  await expect(page.getByText('Add a node to begin')).toBeVisible();
});
