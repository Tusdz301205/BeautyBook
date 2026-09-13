import { test as base, expect } from '@playwright/test';

const ignoredConsolePatterns = [
  /Download the React DevTools/i,
  /Failed to load resource: the server responded with a status of \d{3}/i,
  // CI/sandbox runs block third-party font/CDN requests. First-party failures are
  // still detected by the response and pageerror listeners below.
  /Failed to load resource: net::ERR_NETWORK_ACCESS_DENIED/i,
];

export const test = base.extend({
  runtimeIssues: [async ({ page }, use, testInfo) => {
    const issues = [];

    page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      if (ignoredConsolePatterns.some((pattern) => pattern.test(message.text()))) return;
      issues.push(`console: ${message.text()}`);
    });
    page.on('response', (response) => {
      const request = response.request();
      if (response.status() >= 500) {
        issues.push(`http ${response.status()}: ${request.method()} ${response.url()}`);
      }
      if (response.status() === 404
        && ['document', 'stylesheet', 'script', 'font', 'image'].includes(request.resourceType())
        && !/favicon\.ico(?:[?#]|$)/i.test(response.url())) {
        issues.push(`asset 404: ${response.url()}`);
      }
    });

    await use(issues);

    if (issues.length) {
      await testInfo.attach('runtime-issues.json', {
        body: Buffer.from(JSON.stringify(issues, null, 2)),
        contentType: 'application/json',
      });
    }
    expect(issues, 'Unexpected browser/runtime failures').toEqual([]);
  }, { auto: true }],
});

export { expect };
