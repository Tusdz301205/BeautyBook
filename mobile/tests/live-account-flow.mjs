import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const url = process.env.MOBILE_WEB_URL || 'http://localhost:8086';
const email = `qa.preview.${Date.now()}@example.invalid`;
const password = `BeautyQA${Date.now()}x`;
const name = 'Khách kiểm thử BeautyBook';
const results = { guest: false, registered: false, secondSession: false, errors: [] };
await mkdir('report-output/live-web', { recursive: true });
try {
  const first = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await first.newPage();
  page.on('pageerror', (error) => results.errors.push(error.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'Tài khoản' }).click();
  await expect(page.getByText('Chăm sóc mình, theo cách của mình.')).toBeVisible({ timeout: 20000 });
  results.guest = true;
  await page.screenshot({ path: 'report-output/live-web/account-guest-390.png' });
  await page.getByText('Tạo tài khoản', { exact: true }).click();
  await expect(page.getByPlaceholder('Nguyễn Văn A')).toBeVisible();
  await page.getByPlaceholder('Nguyễn Văn A').fill(name);
  await page.getByPlaceholder('email@example.com').fill(email);
  await page.getByPlaceholder('Tối thiểu 8 ký tự').fill(password);
  await page.getByPlaceholder('Nhập lại mật khẩu').fill(password);
  const registered = page.waitForResponse((response) => response.url().endsWith('/auth/register') && response.request().method() === 'POST', { timeout: 20000 });
  await page.getByText('TẠO TÀI KHOẢN', { exact: true }).click();
  const response = await registered;
  if (!response.ok()) throw new Error(`Registration returned HTTP ${response.status()}`);
  await expect(page.locator('body')).toContainText(name, { timeout: 20000 });
  results.registered = true;
  await page.screenshot({ path: 'report-output/live-web/account-logged-in-390.png' });

  const second = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const otherPage = await second.newPage();
  otherPage.on('pageerror', (error) => results.errors.push(error.message));
  await otherPage.goto(url, { waitUntil: 'domcontentloaded' });
  await otherPage.getByRole('tab', { name: 'Tài khoản' }).click();
  await otherPage.getByText('Đăng nhập', { exact: true }).click();
  await otherPage.getByPlaceholder('email@example.com').fill(email);
  await otherPage.getByPlaceholder('Nhập mật khẩu').fill(password);
  const login = otherPage.waitForResponse((item) => item.url().endsWith('/auth/login') && item.request().method() === 'POST', { timeout: 20000 });
  await otherPage.getByText('ĐĂNG NHẬP', { exact: true }).click();
  const loginResponse = await login;
  if (!loginResponse.ok()) throw new Error(`Second-session login returned HTTP ${loginResponse.status()}`);
  await expect(otherPage.locator('body')).toContainText(name, { timeout: 20000 });
  results.secondSession = true;
  await otherPage.screenshot({ path: 'report-output/live-web/account-second-session-390.png' });
  await first.close();
  await second.close();
} catch (error) {
  results.errors.push(error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
if (!results.guest || !results.registered || !results.secondSession || results.errors.length) process.exitCode = 1;
