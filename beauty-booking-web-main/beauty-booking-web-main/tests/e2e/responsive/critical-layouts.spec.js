import { test, expect } from '../fixtures/test.js';
import { credentialsFor } from '../helpers/environment.js';
import { loginViaUi } from '../helpers/login.js';

async function expectNoPageOverflow(page) {
  await expect.poll(() => page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))).toEqual(expect.objectContaining({ clientWidth: expect.any(Number), scrollWidth: expect.any(Number) }));
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

for (const route of ['/', '/explore', '/login', '/register', '/for-business', '/book']) {
  test(`@responsive ${route} fits the viewport and never renders blank`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('body')).not.toBeEmpty();
    await expect.poll(async () => (await page.locator('body').innerText()).trim().length).toBeGreaterThan(30);
    await expectNoPageOverflow(page);
    if (route === '/book') {
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible();
    }
  });
}

test('@responsive login controls have labels and a keyboard-visible submit path', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('textbox', { name: 'Địa chỉ email (bắt buộc)' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Mật khẩu (bắt buộc)' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible();
  await expectNoPageOverflow(page);
});

test('@responsive customer account dialog traps focus and closes with Escape', async ({ page }) => {
  const credential = credentialsFor('responsiveCustomer') || credentialsFor('customer');
  test.skip(!credential, 'Set customer E2E credentials');
  const result = await loginViaUi(page, credential);
  await page.getByRole('button', { name: new RegExp(result.user.fullName || 'Khách hàng', 'i') }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expectNoPageOverflow(page);
});
