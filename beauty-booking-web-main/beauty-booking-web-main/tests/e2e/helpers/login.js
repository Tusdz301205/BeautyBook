import { expect } from '@playwright/test';

export async function loginViaUi(page, credential) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Địa chỉ email (bắt buộc)' }).fill(credential.email);
  await page.getByRole('textbox', { name: 'Mật khẩu (bắt buộc)' }).fill(credential.password);

  const responsePromise = page.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().includes('/auth/login'));
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  const response = await responsePromise;
  expect(response.ok(), `Login failed with HTTP ${response.status()}`).toBeTruthy();
  const result = await response.json();
  await expect(page).not.toHaveURL(/\/login(?:[?#]|$)/);
  return result;
}

export function expectedHome(role) {
  if (role === 'customer') return /\/customer\/appointments(?:[/?#]|$)/;
  if (role === 'platformAdmin') return /\/admin(?:[/?#]|$)/;
  return /\/salon(?:[/?#]|$)/;
}
