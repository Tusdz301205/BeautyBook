import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const url = process.env.MOBILE_WEB_URL || 'http://localhost:8086';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const email = `qa.saved.${Date.now()}@example.invalid`;
const password = `BeautyQA${Date.now()}x`;
const results = { registerStatus: null, savedStatus: null, firstSession: false, secondSession: false, errors: [] };
await mkdir('report-output/live-web', { recursive: true });
try {
  const first = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await first.newPage();
  page.on('pageerror', (error) => results.errors.push(error.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'Tài khoản' }).click();
  await page.getByText('Tạo tài khoản', { exact: true }).click();
  await page.getByPlaceholder('Nguyễn Văn A').fill('Khách thử lưu dịch vụ');
  await page.getByPlaceholder('email@example.com').fill(email);
  await page.getByPlaceholder('Tối thiểu 8 ký tự').fill(password);
  await page.getByPlaceholder('Nhập lại mật khẩu').fill(password);
  const registered = page.waitForResponse((response) => response.url().endsWith('/auth/register') && response.request().method() === 'POST');
  await page.getByText('TẠO TÀI KHOẢN', { exact: true }).click();
  results.registerStatus = (await registered).status();
  if (results.registerStatus !== 201) throw new Error(`Registration HTTP ${results.registerStatus}`);
  await page.getByRole('tab', { name: 'Tìm kiếm' }).click();
  await expect(page.getByRole('button', { name: 'Lưu Triệt lông tay/chân' }).first()).toBeVisible({ timeout: 20000 });
  const saved = page.waitForResponse((response) => response.url().includes('/customer/saved-services/') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Lưu Triệt lông tay/chân' }).first().click();
  results.savedStatus = (await saved).status();
  if (results.savedStatus >= 400) throw new Error(`Save HTTP ${results.savedStatus}`);
  await page.getByRole('tab', { name: 'Tài khoản' }).click();
  await page.getByText('Mục yêu thích').last().click();
  await expect(page.getByText('Triệt lông tay/chân').last()).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('454.000 đ', { exact: true })).toBeVisible();
  results.firstSession = true;
  await page.screenshot({ path: 'report-output/live-web/favorites-390.png' });

  const second = await browser.newContext({ viewport: { width: 320, height: 844 } });
  const other = await second.newPage();
  other.on('pageerror', (error) => results.errors.push(error.message));
  await other.goto(url, { waitUntil: 'domcontentloaded' });
  await other.getByRole('tab', { name: 'Tài khoản' }).click();
  await other.getByText('Đăng nhập', { exact: true }).click();
  await other.getByPlaceholder('email@example.com').fill(email);
  await other.getByPlaceholder('Nhập mật khẩu').fill(password);
  await other.getByText('ĐĂNG NHẬP', { exact: true }).click();
  await expect(other.locator('body')).toContainText('Khách thử lưu dịch vụ', { timeout: 20000 });
  await other.getByText('Mục yêu thích').last().click();
  await expect(other.getByText('Triệt lông tay/chân').last()).toBeVisible({ timeout: 20000 });
  await expect(other.getByText('454.000 đ', { exact: true })).toBeVisible();
  const overflow = await other.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  if (overflow) throw new Error('Favorites page overflows horizontally at 320px');
  results.secondSession = true;
  await other.screenshot({ path: 'report-output/live-web/favorites-second-session-320.png' });
} catch (error) {
  results.errors.push(error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
if (results.errors.length || !results.firstSession || !results.secondSession) process.exitCode = 1;
