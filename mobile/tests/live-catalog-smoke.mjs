// Live smoke test of the customer discovery screens on the Expo web build.
// Needs the web app (MOBILE_WEB_URL, default http://localhost:8081) and the API (API_URL) running.
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const url = process.env.MOBILE_WEB_URL || 'http://localhost:8081';
const launch = () => chromium.launch({ headless: true }).catch(() => chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' }));
const browser = await launch();
await mkdir('report-output/live-web', { recursive: true });
const results = [];
// Category names that have a bundled illustration (src/components/categoryArt.ts).
const hasArt = (name) => /tóc|gội|hair|barber|râu|triệt lông|wax|ipl|sơn gel|gel polish|sơn móng|móng|nail|da\b|da |facial|skin|spa|massage|thư giãn|body/i.test(name);
try {
  for (const width of [320, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    const errors = [];
    const apiResponses = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.url().includes('/api/v1/')) apiResponses.push({ path: new URL(response.url()).pathname, status: response.status() });
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Khám phá theo nhu cầu')).toBeVisible({ timeout: 90000 });
    await expect(page.getByText(/Cơ sở (được đánh giá cao|đang nhận lịch)/)).toBeVisible();
    const categoryResponse = await page.request.get(process.env.API_URL || 'http://localhost:3000/api/v1/services/categories');
    if (!categoryResponse.ok()) throw new Error(`Category API HTTP ${categoryResponse.status()}`);
    const categories = await categoryResponse.json();
    for (const category of categories.filter((item) => hasArt(item.name))) {
      await expect(page.getByRole('img', { name: `Ảnh minh họa ${category.name}`, exact: true })).toBeAttached();
    }
    // Different needs must not share one picture: men's vs women's hair, gel polish vs nail care.
    const artSource = (node) => node.getAttribute('src') || getComputedStyle(node).backgroundImage;
    const pairs = [['Cắt tóc nam', 'Cắt tóc nữ'], ['Sơn gel', 'Chăm sóc móng']];
    for (const [a, b] of pairs) {
      if (!categories.some((item) => item.name === a) || !categories.some((item) => item.name === b)) continue;
      const first = await page.getByRole('img', { name: `Ảnh minh họa ${a}`, exact: true }).first().evaluate(artSource);
      const second = await page.getByRole('img', { name: `Ảnh minh họa ${b}`, exact: true }).first().evaluate(artSource);
      if (!first || !second || first === second) throw new Error(`Danh mục ${a} / ${b} dùng trùng hoặc thiếu ảnh`);
      for (const source of [first, second]) {
        const imageUrl = source.startsWith('url(') ? source.slice(4, -1).replace(/^['"]|['"]$/g, '') : source;
        const response = await page.request.get(new URL(imageUrl, url).toString());
        if (!response.ok()) throw new Error(`Ảnh danh mục HTTP ${response.status()}`);
      }
    }
    await page.screenshot({ path: `report-output/live-web/home-${width}.png` });
    await page.getByRole('search', { name: 'Tìm dịch vụ hoặc cơ sở' }).click();
    await expect(page.getByText(/\d+\+? dịch vụ phù hợp/)).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: /Bộ lọc/ })).toBeVisible();
    await page.screenshot({ path: `report-output/live-web/search-${width}.png` });
    const first = page.getByRole('button', { name: /Xem cơ sở$/ }).first();
    await expect(first).toBeVisible();
    await first.click();
    await expect(page.getByText('Chọn một hoặc nhiều dịch vụ để đặt lịch.')).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: `report-output/live-web/venue-${width}.png` });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    results.push({ width, overflow, errors, apiResponses: apiResponses.filter((item) => item.status >= 400) });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
if (results.some((item) => item.overflow || item.errors.length || item.apiResponses.length)) process.exitCode = 1;
