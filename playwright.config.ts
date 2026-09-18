import { defineConfig, devices } from '@playwright/test';

/**
 * Real Chromium, against the production build served at the same base path
 * Pages would use, so the tests exercise what would actually ship.
 */
const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}/brand-decision-desk/`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: process.env['CI'] ? 2 : undefined,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 45_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: BASE,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
