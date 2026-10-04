import path from 'node:path';
import { chromium } from 'playwright';

const outputRoot = path.resolve('..', '..', 'docs', 'generated-images', 'beautybook');
const browser = await chromium.launch({ channel: 'msedge', headless: true });

try {
  for (const viewport of [
    { name: 'desktop', width: 1728, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    const messages = [];
    page.on('pageerror', (error) => messages.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') messages.push(`console: ${message.text()}`);
    });

    await page.goto('http://localhost:5174/explore', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.bb-home-salon-card', { timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(600);

    const report = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.bb-home-salon-card')];
      const cardImages = cards.map((card) => card.querySelector('.bb-home-media img')).filter(Boolean);
      const placeholders = cards.filter((card) => card.querySelector('.bb-home-media__placeholder'));
      const brokenImages = cardImages.filter((image) => image.complete && image.naturalWidth === 0);
      const fallbackImages = cardImages.filter((image) => image.currentSrc.includes('/images/beautybook/'));
      const sources = cardImages.map((image) => image.currentSrc);
      const uniqueSources = new Set(sources);

      return {
        cardCount: cards.length,
        cardImageCount: cardImages.length,
        placeholderCount: placeholders.length,
        brokenImageCount: brokenImages.length,
        beautyBookFallbackCount: fallbackImages.length,
        fallbackSources: [...new Set(fallbackImages.map((image) => image.currentSrc))],
        uniqueImageSourceCount: uniqueSources.size,
        duplicateImageSourceCount: sources.length - uniqueSources.size,
        missingAltCount: cardImages.filter((image) => !image.alt.trim()).length,
        placeholderCopyVisible: document.body.innerText.includes('HÌNH ẢNH SẼ ĐƯỢC CẬP NHẬT'),
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });

    if (report.cardImageCount !== report.cardCount) throw new Error(`Thiếu ảnh dịch vụ: ${report.cardImageCount}/${report.cardCount}`);
    if (report.placeholderCount > 0) throw new Error(`Còn ${report.placeholderCount} placeholder dịch vụ.`);
    if (report.brokenImageCount > 0) throw new Error(`Có ${report.brokenImageCount} ảnh dịch vụ bị hỏng.`);
    if (report.duplicateImageSourceCount > 0) throw new Error(`Có ${report.duplicateImageSourceCount} ảnh bị dùng lại giữa các dịch vụ.`);
    if (report.missingAltCount > 0) throw new Error(`Có ${report.missingAltCount} ảnh dịch vụ thiếu alt.`);

    await page.screenshot({ path: path.join(outputRoot, `qa-explore-${viewport.name}.png`), fullPage: true });
    console.log(JSON.stringify({ viewport: viewport.name, ...report, consoleMessages: messages }));
    await page.close();
  }
} finally {
  await browser.close();
}
