import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const url = process.env.MOBILE_WEB_URL || 'http://localhost:8086';
const runId = Date.now();
const password = `BeautyQA${runId}x`;
const result = { firstSavedStatus: null, firstFavoriteVisible: false, secondFavoriteEmpty: false, secondBookingsEmpty: false, errors: [] };
await mkdir('report-output/live-web', { recursive: true });

async function register(page, label, email) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'Tài khoản' }).click();
  await page.getByText('Tạo tài khoản', { exact: true }).click();
  await page.getByPlaceholder('Nguyễn Văn A').fill(label);
  await page.getByPlaceholder('email@example.com').fill(email);
  await page.getByPlaceholder('Tối thiểu 8 ký tự').fill(password);
  await page.getByPlaceholder('Nhập lại mật khẩu').fill(password);
  const response = page.waitForResponse((item) => item.url().endsWith('/auth/register') && item.request().method() === 'POST');
  await page.getByText('TẠO TÀI KHOẢN', { exact: true }).click();
  if ((await response).status() !== 201) throw new Error(`Registration failed for ${label}`);
  await expect(page.locator('body')).toContainText(label, { timeout: 20000 });
}

try {
  const firstContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const first = await firstContext.newPage();
  first.on('pageerror', (error) => result.errors.push(`A: ${error.message}`));
  await register(first, 'Khách QA A', `qa.isolation.a.${runId}@example.invalid`);
  await first.getByRole('tab', { name: 'Tìm kiếm' }).click();
  const saveButton = first.getByRole('button', { name: 'Lưu Triệt lông tay/chân' }).first();
  await expect(saveButton).toBeVisible({ timeout: 20000 });
  const saved = first.waitForResponse((item) => item.url().includes('/customer/saved-services/') && item.request().method() === 'POST');
  await saveButton.click();
  result.firstSavedStatus = (await saved).status();
  if (result.firstSavedStatus >= 400) throw new Error(`Save failed: HTTP ${result.firstSavedStatus}`);
  await first.getByRole('tab', { name: 'Tài khoản' }).click();
  await first.getByText('Mục yêu thích').last().click();
  await expect(first.getByText('Triệt lông tay/chân').last()).toBeVisible({ timeout: 20000 });
  result.firstFavoriteVisible = true;

  const secondContext = await browser.newContext({ viewport: { width: 320, height: 844 } });
  const second = await secondContext.newPage();
  second.on('pageerror', (error) => result.errors.push(`B: ${error.message}`));
  await register(second, 'Khách QA B', `qa.isolation.b.${runId}@example.invalid`);
  await second.getByText('Mục yêu thích').last().click();
  await expect(second.getByText('Không có mục yêu thích')).toBeVisible({ timeout: 20000 });
  await expect(second.locator('body')).not.toContainText('Triệt lông tay/chân');
  result.secondFavoriteEmpty = true;
  await second.screenshot({ path: 'report-output/live-web/isolated-account-favorites-320.png' });
  await second.goto(url, { waitUntil: 'domcontentloaded' });
  await second.getByRole('tab', { name: 'Lịch hẹn' }).click();
  await expect(second.getByText('Không có lịch hẹn sắp tới')).toBeVisible({ timeout: 20000 });
  result.secondBookingsEmpty = true;
  await second.screenshot({ path: 'report-output/live-web/isolated-account-bookings-320.png' });

  await expect(first.getByText('Triệt lông tay/chân').last()).toBeVisible();
} catch (error) {
  result.errors.push(error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}
console.log(JSON.stringify(result, null, 2));
if (result.errors.length || !result.firstFavoriteVisible || !result.secondFavoriteEmpty || !result.secondBookingsEmpty) process.exitCode = 1;
