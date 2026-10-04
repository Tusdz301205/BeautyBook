import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
await mkdir('report-output/live-web', { recursive: true });
const results = [];
try {
  for (const width of [320, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    const errors = [];
    const apiResponses = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.url().includes('/api/v1/')) apiResponses.push({ path: new URL(response.url()).pathname, status: response.status() });
    });
    await page.goto(process.env.MOBILE_WEB_URL || 'http://localhost:8086', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Cơ sở đang có dịch vụ')).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: 'Tìm dịch vụ hoặc cơ sở' }).click();
    await expect(page.getByText(/\d+ dịch vụ trong kết quả/)).toBeVisible({ timeout: 20000 });
    const firstServiceName = (await page.getByRole('button', { name: /^Xem .* tại / }).first().getAttribute('aria-label')).replace(/^Xem /, '').split(' tại ')[0];
    await page.getByRole('button', { name: /^Xem .* tại / }).first().click();
    await expect(page.getByText('Bấm chọn dịch vụ để đặt lịch')).toBeVisible({ timeout: 20000 });
    await page.getByText('Đặt Lịch', { exact: true }).click();
    await expect(page.getByText('Chọn chuyên viên')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Chọn giờ')).toBeVisible();
    await expect(page.locator('body')).toContainText(firstServiceName);
    await page.getByText('30', { exact: true }).first().click();
    await expect(page.getByText('Còn trống').first()).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: `report-output/live-web/booking-${width}.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    results.push({ width, overflow, errors, apiErrors: apiResponses.filter((item) => item.status >= 400), slotCalls: apiResponses.filter((item) => item.path.endsWith('/bookings/available-slots')), visibleText: (await page.locator('body').innerText()).slice(0, 600) });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
if (results.some((item) => item.overflow || item.errors.length || item.apiErrors.length)) process.exitCode = 1;
