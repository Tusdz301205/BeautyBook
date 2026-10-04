import path from 'node:path';
import { chromium } from 'playwright';

const outputRoot = path.resolve('..', '..', 'docs', 'generated-images', 'beautybook');
const categories = [
  { id: 'hair', name: 'Tóc', slug: 'hair' },
  { id: 'nails', name: 'Móng', slug: 'nails' },
  { id: 'skin', name: 'Chăm sóc da', slug: 'skincare' },
  { id: 'spa', name: 'Spa & Massage', slug: 'spa' },
];

const browser = await chromium.launch({ channel: 'msedge', headless: true });

try {
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 1200 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    const messages = [];
    page.on('pageerror', (error) => messages.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) messages.push(`${message.type()}: ${message.text()}`);
    });

    await page.route('http://localhost:3000/api/v1/**', async (route) => {
      const body = route.request().url().includes('/services/categories') ? categories : [];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });

    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      const horizontalScrollers = [...document.querySelectorAll('*')]
        .filter((element) => element.scrollWidth > element.clientWidth + 1);
      for (const element of horizontalScrollers) {
        element.scrollIntoView({ block: 'center' });
        for (let x = 0; x < element.scrollWidth; x += 300) {
          element.scrollLeft = x;
          await new Promise((resolve) => setTimeout(resolve, 40));
        }
        element.scrollLeft = 0;
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(400);
    const report = await page.evaluate(() => ({
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || '',
      openGraphImage: document.querySelector('meta[property="og:image"]')?.content || '',
      twitterImage: document.querySelector('meta[name="twitter:image"]')?.content || '',
      brokenImages: [...document.images].filter((image) => !image.complete || !image.naturalWidth).length,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      hero: (() => {
        const image = document.querySelector('.bb-home-hero__visual img');
        if (!image) return null;
        const rect = image.getBoundingClientRect();
        return { currentSrc: image.currentSrc, loading: image.loading, fetchPriority: image.getAttribute('fetchpriority'), width: Math.round(rect.width), height: Math.round(rect.height) };
      })(),
      categories: [...document.querySelectorAll('.bb-home-category img')].map((image) => {
        const rect = image.getBoundingClientRect();
        return { alt: image.alt, currentSrc: image.currentSrc, loading: image.loading, width: Math.round(rect.width), height: Math.round(rect.height) };
      }),
    }));

    await page.screenshot({ path: path.join(outputRoot, `qa-categories-${viewport.name}.png`), fullPage: true });
    console.log(JSON.stringify({ viewport: viewport.name, ...report, consoleMessages: messages }));
    await page.close();
  }
} finally {
  await browser.close();
}
