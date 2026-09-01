import { defineConfig, devices } from '@playwright/test';

const APP_URL = process.env.APP_BASE_URL || 'http://127.0.0.1:3001';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/campaign-*.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: APP_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    colorScheme: 'light',
  },
  webServer: {
    command: 'pnpm --dir apps/web start -p 3001',
    url: APP_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
