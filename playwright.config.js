import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 20000,
  retries: 0,
  use: { baseURL: 'http://127.0.0.1:8137', trace: 'off' },
  webServer: {
    command: 'node server/index.js',
    url: 'http://127.0.0.1:8137/api/health',
    reuseExistingServer: true,
    timeout: 20000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
});
