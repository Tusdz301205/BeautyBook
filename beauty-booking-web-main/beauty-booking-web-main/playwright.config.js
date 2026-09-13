import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const apiDirectory = path.resolve(currentDirectory, '../../beauty-booking-api-main');
const baseURL = process.env.PW_BASE_URL || 'http://localhost:5173';
const apiBaseURL = process.env.PW_API_BASE_URL || 'http://127.0.0.1:3000/api/v1';

const browserProjects = [
  {
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      channel: 'chrome',
    },
  },
  {
    name: 'tablet',
    grep: /@responsive/,
    use: {
      browserName: 'chromium',
      channel: 'chrome',
      viewport: { width: 1024, height: 768 },
      hasTouch: true,
    },
  },
  {
    name: 'mobile',
    grep: /@responsive/,
    use: {
      ...devices['Pixel 7'],
      channel: 'chrome',
    },
  },
];

if (process.env.PW_FIREFOX === '1') {
  browserProjects.push({
    name: 'firefox',
    grep: /@smoke|@critical/,
    use: { ...devices['Desktop Firefox'] },
  });
}

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['line'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  metadata: { apiBaseURL },
  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  projects: browserProjects,
  webServer: process.env.PW_NO_WEB_SERVER === '1'
    ? undefined
    : [
        {
          command: 'npm run start:dev',
          cwd: apiDirectory,
          url: `${apiBaseURL}/health`,
          reuseExistingServer: true,
          timeout: 120_000,
        },
        {
          command: 'npm run dev -- --host 127.0.0.1 --port 5173',
          cwd: currentDirectory,
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      ],
});
