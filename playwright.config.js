// @ts-check
const { defineConfig, devices } = require('@playwright/test');

// Optional: point at an already-installed Chromium (handy offline). In CI the normal `npx playwright install` browsers are used.
const executablePath = process.env.CHROMIUM_PATH || undefined;
const launchOptions = executablePath ? { executablePath } : {};

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,          // one retry in CI only; flaky tests should be fixed, not hidden
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'retain-on-failure',
    launchOptions
  },
  webServer: {
    command: 'npm run serve',
    url: 'http://localhost:8080/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions } },
    { name: 'mobile', use: { ...devices['Pixel 5'], launchOptions }, testMatch: /(site|a11y)\.spec\.js/ }
  ]
});
