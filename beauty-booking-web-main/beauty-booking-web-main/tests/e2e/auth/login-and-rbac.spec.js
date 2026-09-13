import { test, expect } from '../fixtures/test.js';
import { credentialsFor } from '../helpers/environment.js';
import { expectedHome, loginViaUi } from '../helpers/login.js';

const roles = [
  'customer',
  'staff',
  'receptionist',
  'branchManager',
  'businessOwner',
  'platformAdmin',
];

test('@rbac wrong password is rejected without opening a protected route', async ({ page }) => {
  const credential = credentialsFor('customer');
  test.skip(!credential, 'Set PW_CUSTOMER_EMAIL and PW_CUSTOMER_PASSWORD');

  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Địa chỉ email (bắt buộc)' }).fill(credential.email);
  await page.getByRole('textbox', { name: 'Mật khẩu (bắt buộc)' }).fill(`${credential.password}-wrong`);
  const responsePromise = page.waitForResponse((response) => response.url().includes('/auth/login'));
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  const response = await responsePromise;

  expect(response.status()).toBe(401);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

for (const role of roles) {
  test(`@rbac ${role} logs into its own workspace`, async ({ page }) => {
    const credential = credentialsFor(role);
    test.skip(!credential, `Missing environment credentials for ${role}`);

    await loginViaUi(page, credential);
    await expect(page).toHaveURL(expectedHome(role));
    await expect(page.locator('main')).toBeVisible();
  });
}

test('@rbac refresh cookie restores a customer session after reload', async ({ page }) => {
  const credential = credentialsFor('customer');
  test.skip(!credential, 'Set customer E2E credentials');

  await loginViaUi(page, credential);
  const protectedURL = page.url();
  const refreshPromise = page.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().includes('/auth/refresh'));
  await page.reload();
  const refreshResponse = await refreshPromise;

  expect(refreshResponse.status()).toBe(200);
  await expect(page).toHaveURL(protectedURL);
  await expect(page.getByRole('navigation', { name: 'Điều hướng khách hàng' })).toBeVisible();
});

test('@rbac customer cannot open salon or platform routes directly', async ({ page }) => {
  const credential = credentialsFor('customer');
  test.skip(!credential, 'Set customer E2E credentials');
  await loginViaUi(page, credential);

  await page.goto('/salon/appointments');
  await expect(page).toHaveURL(/\/customer\/appointments/);
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/customer\/appointments/);
});

test('@rbac branch-scoped salon account cannot open platform or customer routes', async ({ page }) => {
  const credential = credentialsFor('receptionist') || credentialsFor('branchManager') || credentialsFor('staff');
  test.skip(!credential, 'Set one branch-scoped salon credential');
  await loginViaUi(page, credential);

  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/salon(?:[/?#]|$)/);
  await page.goto('/customer/appointments');
  await expect(page).toHaveURL(/\/salon(?:[/?#]|$)/);
});

test('@rbac platform admin is not forced into a business workspace', async ({ page }) => {
  const credential = credentialsFor('platformAdmin');
  test.skip(!credential, 'Set platform admin E2E credentials');
  await loginViaUi(page, credential);

  await page.goto('/salon/appointments');
  await expect(page).toHaveURL(/\/admin(?:[/?#]|$)/);
  await expect(page.locator('body')).not.toContainText('Hãy chọn doanh nghiệp cần làm việc');
});

test('@rbac customer and admin remain isolated in independent browser contexts', async ({ browser }) => {
  const customer = credentialsFor('customer');
  const admin = credentialsFor('platformAdmin');
  test.skip(!customer || !admin, 'Set customer and platform admin credentials');

  const customerContext = await browser.newContext();
  const adminContext = await browser.newContext();
  try {
    const customerPage = await customerContext.newPage();
    const adminPage = await adminContext.newPage();
    await Promise.all([loginViaUi(customerPage, customer), loginViaUi(adminPage, admin)]);
    await expect(customerPage).toHaveURL(expectedHome('customer'));
    await expect(adminPage).toHaveURL(expectedHome('platformAdmin'));

    await customerPage.reload();
    await adminPage.reload();
    await expect(customerPage).toHaveURL(/\/customer\//);
    await expect(adminPage).toHaveURL(/\/admin/);
  } finally {
    await Promise.all([customerContext.close(), adminContext.close()]);
  }
});

test('@rbac logout revokes the current customer route', async ({ page }) => {
  const credential = credentialsFor('customer');
  test.skip(!credential, 'Set customer E2E credentials');
  const result = await loginViaUi(page, credential);

  await page.getByRole('button', { name: new RegExp(result.user.fullName || 'Khách hàng', 'i') }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto('/customer/appointments');
  await expect(page).toHaveURL(/\/login$/);
});

for (const role of ['inactive', 'noScope']) {
  test(`@rbac ${role} account cannot establish a protected session`, async ({ page }) => {
    const credential = credentialsFor(role);
    test.skip(!credential, `Missing optional ${role} E2E credential`);
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Địa chỉ email (bắt buộc)' }).fill(credential.email);
    await page.getByRole('textbox', { name: 'Mật khẩu (bắt buộc)' }).fill(credential.password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
}
