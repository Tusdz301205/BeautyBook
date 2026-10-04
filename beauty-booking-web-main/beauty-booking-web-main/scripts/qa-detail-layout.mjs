import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.QA_BASE_URL || 'http://localhost:5174';
const outputDir = path.resolve('report-output', 'beautybook-qa');
const routes = [
  ['service', '/explore/services/98e1f9e5-71da-41a5-839c-3992f7d4d14b', 3],
  ['service-no-staff', '/explore/services/2bd7e82f-0074-4301-bb40-d3c25c4bbc4b', 0],
  ['service-one-staff', '/explore/services/8b1f65af-2702-4eb9-ab3e-fae94e2d9ade', 1],
  ['staff', '/explore/staff/f29819a6-84b6-4947-a554-86284dd1fe93'],
];
const widths = [375, 768, 1024, 1440];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
await fs.mkdir(outputDir, { recursive: true });

try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    for (const [name, route, expectedStaff] of routes) {
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
      await page.locator('.bb-detail-hero').waitFor();
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      const result = await page.evaluate(() => {
        const headings = [...document.querySelectorAll('.bb-detail-section__heading h2')];
        const names = [...document.querySelectorAll('.bb-detail-staff-card__copy strong')];
        const images = [...document.images];
        return {
          title: document.querySelector('h1')?.textContent?.trim(),
          sectionHeadings: headings.map((node) => ({ text: node.textContent.trim(), lines: Math.round(node.getBoundingClientRect().height / parseFloat(getComputedStyle(node).lineHeight)) })),
          staffNames: names.map((node) => ({ text: node.textContent.trim(), wraps: getComputedStyle(node).whiteSpace !== 'nowrap', clipped: node.scrollWidth > node.clientWidth + 1 })),
          bookingLinks: [...document.querySelectorAll('a[href^="/book?"]')].map((node) => node.getAttribute('href')),
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          brokenImages: images.filter((image) => image.complete && image.naturalWidth === 0).length,
        };
      });
      const screenshot = path.join(outputDir, `${name}-detail-${width}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      results.push({ width, route, screenshot, expectedStaff, ...result });
    }
    await page.close();
  }
} finally {
  await browser.close();
}

await fs.writeFile(path.join(outputDir, 'detail-layout-results.json'), `${JSON.stringify(results, null, 2)}\n`);
const failures = results.filter((result) => result.overflow || result.brokenImages || result.staffNames.some((name) => !name.wraps || name.clipped) || (result.expectedStaff !== undefined && result.staffNames.length !== result.expectedStaff) || !result.bookingLinks.length || result.sectionHeadings.some((heading) => heading.lines > 2));
console.log(JSON.stringify({ pages: results.length, failures: failures.map(({ width, route, sectionHeadings }) => ({ width, route, sectionHeadings })) }));
if (failures.length) process.exitCode = 1;
