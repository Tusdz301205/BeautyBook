import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseURL = process.env.QA_BASE_URL || 'http://localhost:5174';
const outputDir = path.resolve('report-output/beautybook-qa');
const serviceId = '98e1f9e5-71da-41a5-839c-3992f7d4d14b';
const staffId = 'f29819a6-84b6-4947-a554-86284dd1fe93';
const branchId = 'd2309d1a-0970-4d4e-aa39-e72ae9297fe9';
const viewports = [375, 768, 1024, 1440];
const routes = [
  '/',
  '/explore',
  `/explore/services/${serviceId}`,
  `/explore/staff/${staffId}`,
  `/explore/branches/${branchId}`,
  '/for-business',
  '/login',
  '/register',
];

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const results = [];

for (const width of viewports) {
  const page = await browser.newPage({ viewport: { width, height: width <= 768 ? 900 : 900 } });
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  for (const route of routes) {
    await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);
    const metrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyTextLength: document.body.innerText.trim().length,
      brokenVisibleImages: Array.from(document.images)
        .filter((image) => {
          const rect = image.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= window.innerHeight;
        })
        .filter((image) => image.complete && image.naturalWidth === 0)
        .map((image) => image.currentSrc || image.src),
    }));
    results.push({
      width,
      route,
      finalUrl: page.url(),
      title: await page.title(),
      noHorizontalOverflow: metrics.scrollWidth <= metrics.clientWidth + 1,
      ...metrics,
      consoleErrors: [...consoleErrors],
    });
    consoleErrors.length = 0;
  }

  await page.goto(`${baseURL}/explore/services/${serviceId}`, { waitUntil: 'networkidle' });
  const serviceStaff = await page.evaluate(() => {
    const section = document.querySelector('.bb-detail-section--staff');
    const bookingDock = document.querySelector('.bb-detail-booking-dock');
    const bookingCta = bookingDock?.querySelector('a[href*="/book"]');
    const heading = section?.querySelector('h2');
    const cards = Array.from(section?.querySelectorAll('.bb-detail-staff-card') || []);
    const names = cards.map((card) => {
      const element = card.querySelector('.bb-detail-staff-card__copy strong');
      const style = element ? getComputedStyle(element) : null;
      return {
        text: element?.textContent?.trim() || '',
        whiteSpace: style?.whiteSpace || '',
        textOverflow: style?.textOverflow || '',
        overflow: style?.overflow || '',
        clientWidth: element?.clientWidth || 0,
        scrollWidth: element?.scrollWidth || 0,
      };
    });
    const cardWidths = cards.map((card) => Math.round(card.getBoundingClientRect().width));
    const headingStyle = heading ? getComputedStyle(heading) : null;
    const bookingLabels = Array.from(document.querySelectorAll('a,button'))
      .map((element) => element.textContent?.replace(/\s+/g, ' ').trim() || '')
      .filter((text) => /đặt lịch/i.test(text));
    return {
      heading: heading?.textContent?.trim() || '',
      headingFontSize: headingStyle?.fontSize || '',
      staffCount: cards.length,
      names,
      cardWidths,
      bookingLabels,
      bookingHref: bookingCta?.getAttribute('href') || '',
      bookingOverlapsStaffSection: bookingDock && section
        ? (() => {
            const dockRect = bookingDock.getBoundingClientRect();
            const sectionRect = section.getBoundingClientRect();
            return dockRect.left < sectionRect.right
              && dockRect.right > sectionRect.left
              && dockRect.top < sectionRect.bottom
              && dockRect.bottom > sectionRect.top;
          })()
        : false,
    };
  });
  results.push({ width, route: 'service-staff-layout', ...serviceStaff });

  await page.goto(`${baseURL}/explore/staff/${staffId}`, { waitUntil: 'networkidle' });
  const staffDetail = await page.evaluate(() => {
    const bookingDock = document.querySelector('.bb-detail-booking-dock');
    const firstSection = document.querySelector('.bb-detail-section');
    const bookingCta = bookingDock?.querySelector('a[href*="/book"]');
    const dockRect = bookingDock?.getBoundingClientRect();
    const sectionRect = firstSection?.getBoundingClientRect();
    return {
      fullNameVisible: document.body.innerText.includes('Trần Diệu Ly Trung'),
      headings: Array.from(document.querySelectorAll('h1,h2')).map((item) => item.textContent?.trim()).filter(Boolean),
      bookingLabels: Array.from(document.querySelectorAll('a,button'))
      .map((element) => element.textContent?.replace(/\s+/g, ' ').trim() || '')
      .filter((text) => /đặt lịch/i.test(text)),
      bookingHref: bookingCta?.getAttribute('href') || '',
      bookingDockRect: dockRect ? { left: dockRect.left, right: dockRect.right, top: dockRect.top, bottom: dockRect.bottom } : null,
      firstSectionRect: sectionRect ? { left: sectionRect.left, right: sectionRect.right, top: sectionRect.top, bottom: sectionRect.bottom } : null,
      bookingDockPosition: bookingDock ? getComputedStyle(bookingDock).position : '',
      bookingOverlapsFirstSection: bookingDock && firstSection
        ? (() => {
            const dockRect = bookingDock.getBoundingClientRect();
            const sectionRect = firstSection.getBoundingClientRect();
            return dockRect.left < sectionRect.right
              && dockRect.right > sectionRect.left
              && dockRect.top < sectionRect.bottom
              && dockRect.bottom > sectionRect.top;
          })()
        : false,
    };
  });
  results.push({ width, route: 'staff-detail-layout', ...staffDetail });

  if (width === 375 || width === 1440) {
    await page.goto(`${baseURL}/explore/services/${serviceId}`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(outputDir, `service-detail-${width}.png`), fullPage: true });
    await page.goto(`${baseURL}/explore/staff/${staffId}`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(outputDir, `staff-detail-${width}.png`), fullPage: true });
  }

  await page.close();
}

await browser.close();
await fs.writeFile(path.join(outputDir, 'layout-results.json'), `${JSON.stringify(results, null, 2)}\n`);

const failures = results.filter((entry) =>
  entry.noHorizontalOverflow === false
  || (Array.isArray(entry.brokenVisibleImages) && entry.brokenVisibleImages.length > 0)
  || (entry.route === 'service-staff-layout' && (entry.staffCount !== 3 || !entry.names.some((item) => item.text === 'Trần Diệu Ly Trung') || entry.bookingLabels.length === 0 || !entry.bookingHref.startsWith('/book?') || entry.bookingOverlapsStaffSection))
  || (entry.route === 'staff-detail-layout' && (!entry.fullNameVisible || entry.bookingLabels.length === 0 || !entry.bookingHref.startsWith('/book?') || entry.bookingOverlapsFirstSection))
);

console.log(JSON.stringify({ checked: results.length, failures, outputDir }, null, 2));
process.exitCode = failures.length ? 1 : 0;
