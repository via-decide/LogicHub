// LogicHub/tests/e2e/site-accessibility.spec.ts
// Axe over every generated policy page.
//
// The pages come from one layout in scripts/build-policy-pages.mjs, so a fault
// found on one is a fault on all of them — and a fix to the layout fixes all of
// them at once. The page list is written out here rather than discovered, so
// adding a page and forgetting to check it shows up as a page nobody tested.

import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = [
  { path: '/privacy', title: 'Privacy Policy' },
  { path: '/terms', title: 'Terms of Service' },
  { path: '/refund-policy', title: 'Cancellation and Refund Policy' },
  { path: '/shipping-policy', title: 'Shipping and Delivery Policy' },
  { path: '/cookies', title: 'Cookie Policy' },
  { path: '/contact', title: 'Contact' },
  { path: '/waitlist', title: 'Storage Cartridge' },
];

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

for (const { path, title } of PAGES) {
  test(`${path} has no serious accessibility violation`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    expect(await audit(page)).toBe('');
  });

  test(`${path} states its own address and a social card`, async ({ page }) => {
    await page.goto(path);

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://logichub.app${path}`,
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      'https://logichub.app/og-image.png',
    );
  });

  test(`${path} gives one contact address for every query`, async ({ page }) => {
    await page.goto(path);
    await expect(
      page.locator('a[href="mailto:dharam@viadecide.com"]').first(),
    ).toBeVisible();
  });
}

test('the sitemap lists every policy page', async ({ request }) => {
  const response = await request.get('/sitemap.xml');
  expect(response.ok()).toBe(true);

  const xml = await response.text();
  for (const { path } of PAGES) {
    expect(xml).toContain(`<loc>https://logichub.app${path}</loc>`);
  }
});

test('robots.txt points at a sitemap that exists', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Sitemap: https://logichub.app/sitemap.xml');

  // The pairing that was broken: the file was advertised and absent.
  expect((await request.get('/sitemap.xml')).ok()).toBe(true);
});

test('the social card is a real image, not a placeholder with the right name', async ({ request }) => {
  const response = await request.get('/og-image.png');
  expect(response.ok()).toBe(true);

  const body = await response.body();
  // PNG signature, then width and height from the IHDR chunk.
  expect(body.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(body.readUInt32BE(16)).toBe(1200);
  expect(body.readUInt32BE(20)).toBe(630);
});

test('the PWA icons are real images too', async ({ request }) => {
  for (const [path, size] of [['/icons/icon-192.png', 192], ['/icons/icon-512.png', 512]] as const) {
    const body = await (await request.get(path)).body();
    expect(body.subarray(0, 8).toString('hex'), path).toBe('89504e470d0a1a0a');
    expect(body.readUInt32BE(16), path).toBe(size);
  }
});

test('no policy page carries a tracker, as the cookie policy says', async ({ page }) => {
  for (const { path } of PAGES) {
    await page.goto(path);
    const scripts = await page.locator('script[src]').evaluateAll(
      (nodes) => nodes.map((node) => (node as HTMLScriptElement).src),
    );
    for (const src of scripts) {
      expect(src, `${path} loads ${src}`).not.toMatch(
        /googletagmanager|google-analytics|facebook|hotjar|clarity\.ms|segment|mixpanel|plausible/i,
      );
    }
  }
});
