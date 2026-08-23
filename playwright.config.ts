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
// scripts/dev-marketplace-server.mjs, not Vercel's own routing -- see that
// script's header for why (no live DATABASE_URL / confirmed `vercel dev`
// setup to verify against in this environment). Real api/marketplace/*
// handlers, fake in-memory db.
const MARKETPLACE_URL = process.env.MARKETPLACE_BASE_URL || 'http://127.0.0.1:5174';

/**
 * Where this environment keeps Chromium.
 *
 * Browser downloads are disabled here and the installed build does not match the
 * revision this Playwright version would fetch, so the binary is named outright.
 * PLAYWRIGHT_CHROMIUM_PATH overrides it; anywhere neither is set, Playwright
 * resolves its own browser as usual.
 */
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH
  || (process.env.PLAYWRIGHT_BROWSERS_PATH
    ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium`
    : undefined);

const chromium = {
  ...devices['Desktop Chrome'],
  ...(CHROMIUM_PATH ? { launchOptions: { executablePath: CHROMIUM_PATH } } : {}),
};

export default defineConfig({
  testDir: './tests/e2e',
  // The unit tests are node:test files under tests/; only e2e specs belong here.
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Axe is run against the light theme. A dark-theme pass would need its own
    // contrast baseline, and claiming both were checked when one was is the kind
    // of statement this project does not make.
    colorScheme: 'light',
  },

  projects: [
    {
      name: 'site',
      use: { ...chromium, baseURL: SITE_URL },
      testMatch: [
        '**/root-identity.spec.ts',
        '**/metadata.spec.ts',
        '**/service-worker-migration.spec.ts',
        '**/builder-preservation.spec.ts',
        '**/site-accessibility.spec.ts',
      ],
    },
    {
      name: 'product',
      use: { ...chromium, baseURL: APP_URL },
      testMatch: [
        '**/product-builder.spec.ts',
        '**/product-accessibility.spec.ts',
        '**/campaign-evidence.spec.ts',
        '**/campaign-components.spec.ts',
        '**/campaign-accessibility.spec.ts',
      ],
    },
    {
      name: 'marketplace',
      use: { ...chromium, baseURL: MARKETPLACE_URL },
      testMatch: ['**/workspace.spec.ts'],
    },
  ],

  webServer: [
    {
      command: 'node scripts/serve-static.mjs',
      url: SITE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      // Built rather than dev-served: a production build is what ships, and dev
      // mode hides the errors that only appear after compilation.
      command: 'pnpm --dir apps/web build && pnpm --dir apps/web start -p 3001',
      url: APP_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
    {
      command: 'node scripts/build-workspace.mjs && node scripts/dev-marketplace-server.mjs',
      url: MARKETPLACE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
