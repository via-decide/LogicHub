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
// engineering/apps/api's Fastify server (Phase 7), started via its
// test-only e2e-server entrypoint (see that file's header) so the
// engineering-pr-workflow spec can drive a real merge through the browser
// without kicad-cli available in this sandbox.
const ENGINEERING_API_URL = process.env.ENGINEERING_API_URL || 'http://127.0.0.1:3010';

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
      testMatch: ['**/workspace.spec.ts', '**/marketplace-verification.spec.ts'],
    },
    {
      name: 'engineering',
      use: { ...chromium, baseURL: APP_URL },
      testMatch: ['**/engineering-pr-workflow.spec.ts'],
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
      //
      // apps/web's next.config.ts sets output: 'standalone' (Docker/Vercel-style
      // deployment), and Next.js itself warns "next start does not work with
      // output: standalone configuration" -- confirmed: it serves the initial
      // HTML fine but 500s on every client-side JS chunk (static assets are
      // never copied into .next/standalone), so nothing ever hydrates and no
      // client-side interaction works. Use the real standalone entrypoint
      // instead, after copying static/public into it as Next's own docs
      // require (https://nextjs.org/docs -- Output File Tracing / standalone).
      command:
        'pnpm --dir apps/web build && ' +
        'cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static && ' +
        'cp -r apps/web/public apps/web/.next/standalone/apps/web/public && ' +
        'node apps/web/.next/standalone/apps/web/server.js',
      url: APP_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      // LOGICHUB_API_URL covers server-side fetches (Server Components).
      // Client Components' browser-side fetches (the review/merge action
      // buttons) need the NEXT_PUBLIC_ variant instead -- Next.js inlines
      // only NEXT_PUBLIC_-prefixed vars into the client bundle, and only at
      // build time, so it must be set before "build" runs here, not just
      // "start". PORT/HOSTNAME control the standalone server.js directly
      // (it doesn't take a -p flag like "next start" does).
      env: {
        LOGICHUB_API_URL: ENGINEERING_API_URL,
        NEXT_PUBLIC_LOGICHUB_API_URL: ENGINEERING_API_URL,
        PORT: '3001',
        HOSTNAME: '127.0.0.1',
      },
    },
    {
      command: 'node scripts/build-workspace.mjs && node scripts/dev-marketplace-server.mjs',
      url: MARKETPLACE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      // engineering/apps/api's Fastify server (Phase 7). Built once (tsc
      // --build, same as its own test suite) and started via the test-only
      // e2e-server entrypoint -- never main.js, which has no toolchain
      // simulation.
      command:
        'cd engineering && pnpm --filter @logichub-engineering/api... build && cd apps/api && node dist/e2e-server.js',
      // Playwright's webServer readiness probe only accepts a 2xx/3xx
      // response; the bare origin correctly 404s (no route registered at
      // "/"), which reads as "not ready" forever. /projects is a real,
      // always-200 route.
      url: `${ENGINEERING_API_URL}/projects`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { PORT: '3010', HOST: '127.0.0.1', LOGICHUB_DB_PATH: ':memory:', LOGICHUB_ARTIFACT_STORE: '/tmp/logichub-e2e-artifacts' },
    },
  ],
});
