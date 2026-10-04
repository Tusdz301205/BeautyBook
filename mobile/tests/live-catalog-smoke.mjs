import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const url = process.env.MOBILE_WEB_URL || 'http://localhost:8086';
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
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Cơ sở đang có dịch vụ')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Theo nhu cầu của bạn')).toBeVisible();
    const categoryResponse = await page.request.get(process.env.API_URL || 'http://localhost:3000/api/v1/services/categories');
    if (!categoryResponse.ok()) throw new Error(`Category API HTTP ${categoryResponse.status()}`);
    const categories = await categoryResponse.json();
    for (const category of categories) {
      await expect(page.getByRole('img', { name: `Ảnh minh họa ${category.name}`, exact: true })).toBeVisible();
    }
    const menArt = page.getByRole('img', { name: 'Ảnh minh họa Cắt tóc nam' });
    const womenArt = page.getByRole('img', { name: 'Ảnh minh họa Cắt tóc nữ' });
    const gelArt = page.getByRole('img', { name: 'Ảnh minh họa Sơn gel' });
    const nailArt = page.getByRole('img', { name: 'Ảnh minh họa Chăm sóc móng' });
    await expect(menArt).toBeVisible();
    await expect(womenArt).toBeVisible();
    await expect(gelArt).toBeVisible();
    await expect(nailArt).toBeVisible();
    const artSource = (node) => node.getAttribute('src') || getComputedStyle(node).backgroundImage;
    const menSrc = await menArt.evaluate(artSource);
    const womenSrc = await womenArt.evaluate(artSource);
    const gelSrc = await gelArt.evaluate(artSource);
    const nailSrc = await nailArt.evaluate(artSource);
    if (!menSrc || !womenSrc || menSrc === womenSrc) throw new Error('Danh mục tóc nam/nữ dùng trùng hoặc thiếu ảnh');
    if (!gelSrc || !nailSrc || gelSrc === nailSrc) throw new Error('Danh mục Sơn gel thiếu ảnh riêng');
    for (const source of [menSrc, womenSrc, gelSrc, nailSrc]) {
      const imageUrl = source.startsWith('url(') ? source.slice(4, -1).replace(/^['"]|['"]$/g, '') : source;
      const response = await page.request.get(new URL(imageUrl, url).toString());
      if (!response.ok()) throw new Error(`Ảnh danh mục HTTP ${response.status()}`);
    }
    await page.screenshot({ path: `report-output/live-web/home-${width}.png` });
    await page.getByRole('button', { name: 'Tìm dịch vụ hoặc cơ sở' }).click();
    await expect(page.getByText(/\d+ dịch vụ trong kết quả/)).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: `report-output/live-web/search-${width}.png` });
    const first = page.getByRole('button', { name: /^Xem .* tại / }).first();
    await expect(first).toBeVisible();
    await first.click();
    await expect(page.getByText('Bấm chọn dịch vụ để đặt lịch')).toBeVisible({ timeout: 20000 });
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
