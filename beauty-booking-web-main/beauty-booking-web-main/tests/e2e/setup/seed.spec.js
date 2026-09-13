import { test, expect } from '../fixtures/test.js';

test('seed opens BeautyBook', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('body')).not.toBeEmpty();
});
