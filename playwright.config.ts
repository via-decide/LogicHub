// LogicHub/playwright.config.ts
// There was no Playwright configuration at all.
//
// Four specs sat in tests/e2e/ and `npx playwright test` ran them with whatever
// defaults it invented, including no baseURL — so `page.goto('/')` had nowhere to
// go. The specs existed without ever having run.
//
// Two servers are involved, because the site is two things: the static marketing
// and policy pages at the repository root, and the Next.js product builder in
// apps/web. Each project points at its own.

import { defineConfig, devices } from '@playwright/test';

const SITE_URL = process.env.SITE_BASE_URL || 'http://127.0.0.1:5173';
const APP_URL = process.env.APP_BASE_URL || 'http://127.0.0.1:3001';
const MARKETPLACE_URL = process.env.MARKETPLACE_BASE_URL || 'http://127.0.0.1:5174';
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH
  || (process.env.PLAYWRIGHT_BROWSERS_PATH ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium` : undefined);
const chromium = { ...devices['Desktop Chrome'], ...(CHROMIUM_PATH ? { launchOptions: { executablePath: CHROMIUM_PATH } } : {}) };

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: { trace: 'on-first-retry', screenshot: 'only-on-failure', colorScheme: 'light' },
  projects: [
    { name: 'site', use: { ...chromium, baseURL: SITE_URL }, testMatch: ['**/root-identity.spec.ts','**/metadata.spec.ts','**/service-worker-migration.spec.ts','**/builder-preservation.spec.ts','**/site-accessibility.spec.ts'] },
    { name: 'product', use: { ...chromium, baseURL: APP_URL }, testMatch: ['**/product-builder.spec.ts','**/product-accessibility.spec.ts','**/campaign-evidence.spec.ts','**/campaign-components.spec.ts','**/campaign-accessibility.spec.ts','**/omni-wheel-campaign.spec.ts'] },
    { name: 'marketplace', use: { ...chromium, baseURL: MARKETPLACE_URL }, testMatch: ['**/workspace.spec.ts'] },
  ],
  webServer: [
    { command: 'node scripts/serve-static.mjs', url: SITE_URL, reuseExistingServer: !process.env.CI, timeout: 30_000 },
    { command: 'pnpm --dir apps/web build && pnpm --dir apps/web start -p 3001', url: APP_URL, reuseExistingServer: !process.env.CI, timeout: 240_000 },
    { command: 'node scripts/build-workspace.mjs && node scripts/dev-marketplace-server.mjs', url: MARKETPLACE_URL, reuseExistingServer: !process.env.CI, timeout: 30_000 },
  ],
});
