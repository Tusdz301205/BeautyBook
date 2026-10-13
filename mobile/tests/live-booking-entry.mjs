// Live check: search → venue → select a service → booking screen loads staff and real slots.
// Needs the web app (MOBILE_WEB_URL, default http://localhost:8081) and the API running. No booking is submitted.
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const launch = () => chromium.launch({ headless: true }).catch(() => chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' }));
const browser = await launch();
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
    await page.goto(process.env.MOBILE_WEB_URL || 'http://localhost:8081', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Khám phá theo nhu cầu')).toBeVisible({ timeout: 90000 });
    await page.getByRole('search', { name: 'Tìm dịch vụ hoặc cơ sở' }).click();
    await expect(page.getByText(/\d+\+? dịch vụ phù hợp/)).toBeVisible({ timeout: 20000 });
    const result = page.getByRole('button', { name: /Xem cơ sở$/ }).first();
    const firstServiceName = (await result.getAttribute('aria-label')).split(' tại ')[0];
    await result.click();
    await expect(page.getByText('Chọn một hoặc nhiều dịch vụ để đặt lịch.')).toBeVisible({ timeout: 20000 });
    // The tapped search result arrives preselected; continue straight to booking.
    await page.getByRole('button', { name: 'Tiếp tục đặt lịch' }).click();
    await expect(page.getByRole('heading', { name: 'Chuyên viên' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('heading', { name: 'Giờ', exact: true })).toBeVisible();
    await expect(page.locator('body')).toContainText(firstServiceName);
    // Today can be fully booked or closed: look one week ahead on a weekday.
    await page.getByRole('button', { name: 'Tuần sau' }).click();
    await page.getByRole('button', { name: /^T4, ngày/ }).click();
    await expect(page.getByRole('radio', { name: /còn trống$/ }).first()).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: `report-output/live-web/booking-${width}.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    results.push({ width, overflow, errors, apiErrors: apiResponses.filter((item) => item.status >= 400), slotCalls: apiResponses.filter((item) => item.path.endsWith('/bookings/available-slots')) });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
if (results.some((item) => item.overflow || item.errors.length || item.apiErrors.length || !item.slotCalls.some((call) => call.status === 200))) process.exitCode = 1;
