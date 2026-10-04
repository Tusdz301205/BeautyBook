import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

async function prepareUnauthenticatedPage(page) {
  await page.route('**/api/v1/auth/refresh', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'Phiên đăng nhập không hợp lệ' }),
  }));
}

async function enterValidRegistration(page) {
  await page.locator('#register-fullName').fill('Demo Account');
  await page.locator('#register-email').fill('demo-account@example.test');
  await page.locator('#register-password').fill('BeautyBook123');
  await page.locator('#register-confirmPassword').fill('BeautyBook123');
  await page.locator('label[for="register-terms"]').click();
}

test('@smoke registration account selection updates copy and API role without clearing inputs', async ({ page }) => {
  await prepareUnauthenticatedPage(page);
  let requestBody;
  await page.route('**/api/v1/auth/register', async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Email đã được sử dụng' }),
    });
  });

  await page.goto('/register');
  await expect(page.getByRole('radio', { name: /Khách hàng/ })).toBeChecked();
  await enterValidRegistration(page);
  await page.locator('input[name="accountType"][value="BUSINESS_OWNER"]').check();
  await expect(page.getByRole('heading', { name: 'Tạo tài khoản chủ doanh nghiệp' })).toBeVisible();
  await expect(page.locator('#register-fullName')).toHaveValue('Demo Account');
  await expect(page.locator('#register-email')).toHaveValue('demo-account@example.test');
  await page.locator('input[name="accountType"][value="CUSTOMER"]').check();
  await expect(page.getByRole('heading', { name: 'Tạo tài khoản khách hàng' })).toBeVisible();
  await page.locator('input[name="accountType"][value="BUSINESS_OWNER"]').check();

  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect.poll(() => requestBody?.accountType).toBe('BUSINESS_OWNER');
  await expect(page.locator('.bb-auth-alert')).toContainText('Email này đã có tài khoản');
});

test('@smoke business registration route opens owner choice but can select customer', async ({ page }) => {
  await prepareUnauthenticatedPage(page);
  let requestBody;
  await page.route('**/api/v1/auth/register', async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Email đã được sử dụng' }),
    });
  });

  await page.goto('/register/business');
  await expect(page.getByRole('radio', { name: /Chủ doanh nghiệp/ })).toBeChecked();
  await enterValidRegistration(page);
  await page.locator('input[name="accountType"][value="CUSTOMER"]').check();
  await expect(page.getByRole('heading', { name: 'Tạo tài khoản khách hàng' })).toBeVisible();
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect.poll(() => requestBody?.accountType).toBe('CUSTOMER');
  await expect(page.locator('.bb-auth-alert')).toContainText('Email này đã có tài khoản');
});

test('@smoke invalid account fields are blocked and duplicate phone is shown inline', async ({ page }) => {
  await prepareUnauthenticatedPage(page);
  let requests = 0;
  await page.route('**/api/v1/auth/register', async (route) => {
    requests += 1;
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Số điện thoại đã được sử dụng' }),
    });
  });

  await page.goto('/register');
  await page.locator('#register-fullName').fill('A');
  await page.locator('#register-email').fill('email-sai');
  await page.locator('#register-phone').fill('123');
  await page.locator('#register-password').fill('weak');
  await page.locator('#register-confirmPassword').fill('khong-khop');
  await page.locator('label[for="register-terms"]').click();
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(page.locator('#register-fullName-error')).toContainText('ít nhất 2 ký tự');
  await expect(page.locator('#register-email-error')).toContainText('email hợp lệ');
  await expect(page.locator('#register-phone-error')).toContainText('10 chữ số');
  await expect(page.locator('#register-password-error')).toContainText('8 ký tự');
  await expect(page.locator('#register-confirmPassword-error')).toContainText('chưa khớp');
  expect(requests).toBe(0);

  await page.locator('#register-fullName').fill('Tài khoản thử');
  await page.locator('#register-email').fill('owner@example.test');
  await page.locator('#register-phone').fill('0912 345 678');
  await page.locator('#register-password').fill('BeautyBook123');
  await page.locator('#register-confirmPassword').fill('BeautyBook123');
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect.poll(() => requests).toBe(1);
  await expect(page.locator('#register-phone-error')).toContainText('đã được sử dụng');
});

test('@responsive both account choices stay side by side without horizontal overflow', async ({ page }) => {
  await prepareUnauthenticatedPage(page);
  const output = resolve('../../report-output/business-owner-registration'); mkdirSync(output, { recursive: true });
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/register');
    const customerLabel = page.locator('input[value="CUSTOMER"]').locator('xpath=..');
    const businessLabel = page.locator('input[value="BUSINESS_OWNER"]').locator('xpath=..');
    const [customerBox, businessBox] = await Promise.all([customerLabel.boundingBox(), businessLabel.boundingBox()]);
    expect(customerBox).not.toBeNull();
    expect(businessBox).not.toBeNull();
    expect(Math.abs(customerBox.y - businessBox.y)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: resolve(output, `register-choices-${width}.png`), fullPage: true, animations: 'disabled' });
  }
});
