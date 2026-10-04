import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const repoRoot = path.resolve(root, '..', '..');
const planPath = path.join(repoRoot, 'docs', 'generated-images', 'beautybook', 'entity-plan.json');
const screenshotDir = path.join(repoRoot, 'docs', 'generated-images', 'beautybook');
const baseUrl = process.env.QA_BASE_URL || 'http://localhost:5174';
const apiBaseUrl = process.env.QA_API_BASE_URL || 'http://localhost:3000/api/v1';
const plan = JSON.parse(await fs.readFile(planPath, 'utf8'));
const sampleService = plan.services?.[0];
const sampleBranch = plan.branches?.[0];

if (!sampleService?.entityId || !sampleBranch?.entityId) {
  throw new Error('Entity plan thiếu service hoặc branch để chạy public QA.');
}

const staffResponse = await fetch(`${apiBaseUrl}/staff/public?branchId=${encodeURIComponent(sampleBranch.entityId)}`);
if (!staffResponse.ok) {
  throw new Error(`Không lấy được chuyên viên mẫu cho public QA: HTTP ${staffResponse.status}.`);
}
const staffRows = await staffResponse.json();
const sampleStaff = Array.isArray(staffRows) ? staffRows[0] : staffRows;
if (!sampleStaff?.id) {
  throw new Error('Không có chuyên viên công khai để kiểm tra trang chi tiết chuyên viên.');
}

const routes = [
  { key: 'home', path: '/', indexable: true, requireImage: true, forbidPlaceholder: true },
  { key: 'explore', path: '/explore', indexable: true, requireImage: true, forbidPlaceholder: true },
  { key: 'service', path: `/explore/services/${sampleService.entityId}`, indexable: true, requireImage: true, forbidPlaceholder: true },
  { key: 'branch', path: `/explore/branches/${sampleBranch.entityId}`, indexable: true, requireImage: true, forbidPlaceholder: true },
  { key: 'staff', path: `/explore/staff/${sampleStaff.id}`, indexable: true, requireImage: false, forbidPlaceholder: true },
  { key: 'business', path: '/for-business', indexable: true, requireImage: true, forbidPlaceholder: true },
  { key: 'login', path: '/login', indexable: false, requireImage: true, forbidPlaceholder: true },
  { key: 'register', path: '/register', indexable: false, requireImage: true, forbidPlaceholder: true },
  { key: 'register-business', path: '/register/business', indexable: false, requireImage: true, forbidPlaceholder: true },
  { key: 'recovery', path: '/forgot-password', indexable: false, requireImage: true, forbidPlaceholder: true },
  { key: 'reset-password', path: '/reset-password', indexable: false, requireImage: true, forbidPlaceholder: true },
  { key: 'verify-email', path: '/verify-email', indexable: false, requireImage: true, forbidPlaceholder: true },
  { key: 'invitation', path: '/accept-invitation', indexable: false, requireImage: true, forbidPlaceholder: true },
];

const viewports = [
  { key: 'desktop', width: 1440, height: 1000 },
  { key: 'mobile', width: 390, height: 844 },
];

await fs.mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
const failures = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();

    for (const route of routes) {
      await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (route.key === 'explore') await page.waitForSelector('.bb-home-salon-card', { timeout: 15000 });
      if (route.key === 'service' || route.key === 'branch' || route.key === 'staff') await page.waitForSelector('.bb-detail-hero', { timeout: 15000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(600);
      await page.locator('body').waitFor({ state: 'visible' });

      const report = await page.evaluate(() => {
        const images = [...document.images];
        const visibleText = document.body.innerText;
        const meta = (selector) => document.head.querySelector(selector)?.getAttribute('content') || '';
        const canonical = document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
        return {
          title: document.title,
          h1: [...document.querySelectorAll('h1')].map((node) => node.textContent?.trim()).filter(Boolean),
          imageCount: images.length,
          loadedImageCount: images.filter((img) => img.complete && img.naturalWidth > 0).length,
          brokenImageCount: images.filter((img) => img.complete && img.naturalWidth === 0).length,
          placeholderCount: document.querySelectorAll('.bb-home-media__placeholder').length,
          placeholderDetails: [...document.querySelectorAll('.bb-home-media__placeholder')].map((node) => ({
            ariaLabel: node.getAttribute('aria-label') || '',
            text: node.textContent?.trim() || '',
            parentClass: node.parentElement?.className || '',
            sectionClass: node.closest('section')?.className || '',
          })),
          placeholderCopyVisible: visibleText.includes('Hình ảnh sẽ được cập nhật'),
          illustrationBadgeCount: document.querySelectorAll('.bb-home-media__illustration').length,
          eagerImageCount: images.filter((img) => img.loading === 'eager').length,
          lazyImageCount: images.filter((img) => img.loading === 'lazy').length,
          missingAltCount: images.filter((img) => !img.hasAttribute('alt')).length,
          robots: meta('meta[name="robots"]'),
          description: meta('meta[name="description"]'),
          canonical,
          ogTitle: meta('meta[property="og:title"]'),
          ogImage: meta('meta[property="og:image"]'),
          twitterImage: meta('meta[name="twitter:image"]'),
          structuredDataCount: document.head.querySelectorAll('script[type="application/ld+json"]').length,
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        };
      });

      const screenshot = path.join(screenshotDir, `qa-${route.key}-${viewport.key}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      const result = { viewport: viewport.key, route: route.path, screenshot, ...report };
      results.push(result);

      const addFailure = (message) => failures.push(`${viewport.key} ${route.path}: ${message}`);
      if (route.requireImage && report.imageCount === 0) addFailure('không có ảnh.');
      if (report.brokenImageCount > 0) addFailure(`có ${report.brokenImageCount} ảnh hỏng.`);
      if (report.missingAltCount > 0) addFailure(`có ${report.missingAltCount} ảnh thiếu thuộc tính alt.`);
      if (route.forbidPlaceholder && (report.placeholderCount > 0 || report.placeholderCopyVisible)) addFailure(`còn ${report.placeholderCount} placeholder ảnh.`);
      if (report.horizontalOverflow) addFailure('có tràn ngang.');
      if (report.h1.length !== 1) addFailure(`cần đúng 1 H1, hiện có ${report.h1.length}.`);
      if (!report.title || !report.description || !report.robots || !report.ogTitle || !report.ogImage || !report.twitterImage) addFailure('thiếu metadata SEO cơ bản.');
      if (route.indexable && !report.robots.startsWith('index')) addFailure('robots không indexable.');
      if (!route.indexable && !report.robots.startsWith('noindex')) addFailure('robots chưa noindex.');
    }

    await context.close();
  }
} finally {
  await browser.close();
}

const reportPath = path.join(screenshotDir, 'qa-public-pages.json');
await fs.writeFile(reportPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  baseUrl,
  checkedPages: results.length,
  routes: routes.length,
  viewports: viewports.length,
  reportPath,
  results,
  failures,
}, null, 2));

if (failures.length) {
  throw new Error(`Public QA còn ${failures.length} lỗi. Xem ${reportPath}.`);
}
