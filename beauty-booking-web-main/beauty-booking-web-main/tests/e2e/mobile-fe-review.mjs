import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = process.env.BB_WEB_URL || 'http://127.0.0.1:5173';
const output = '../../report-output/mobile-fe-review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const failures = [];
const results = [];
const service = { id: 'qa-service', name: 'Chăm sóc da chuyên sâu và thư giãn', displayName: 'Chăm sóc da chuyên sâu và thư giãn', branchId: 'qa-branch', branchName: 'Chi nhánh BeautyBook kiểm thử', businessName: 'BeautyBook kiểm thử', categoryName: 'Chăm sóc da', durationMinutes: 60, price: 450000, availableStaffCount: 1, variants: [] };
const staff = { id: 'qa-staff', fullName: 'Đỗ Thị Ngọc Bích Phương Anh', professionalTitle: 'Chuyên viên chăm sóc da chuyên sâu', specialties: ['Chăm sóc da', 'Tư vấn liệu trình phù hợp'], rating: 4.9, ratingCount: 128 };
const branch = { id: 'qa-branch', name: 'Chi nhánh BeautyBook kiểm thử', addressLine: '123 Đường Hoa', district: { name: 'Quận 1', province: { name: 'TP. Hồ Chí Minh' } }, business: { name: 'BeautyBook kiểm thử' }, images: [], workingHours: [], recentReviews: [], stats: {}, services: [service], staff: [staff] };
const respond = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

try {
  for (const width of [360, 390, 430, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: width >= 1440 ? 900 : 844 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/api/v1/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/v1/auth/refresh') return respond(route, {}, 401);
      if (path === '/api/v1/services/search') return respond(route, { data: [service], hasMore: false });
      if (path === '/api/v1/services/qa-service') return respond(route, { ...service, branch, category: { name: 'Chăm sóc da' }, images: [], description: 'Dịch vụ chăm sóc da trong dữ liệu kiểm thử.', staffServices: [{ staff }] });
      if (path === '/api/v1/branches/qa-branch') return respond(route, branch);
      if (path === '/api/v1/staff/public/qa-staff') return respond(route, { ...staff, branch, staffServices: [{ service }] });
      if (route.request().method() !== 'GET') return route.abort('blockedbyclient');
      return respond(route, []);
    });
    const inspect = async (name) => {
      await page.locator('h1').first().waitFor();
      await page.waitForTimeout(350);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (overflow > 1) failures.push(`${width} ${name}: tràn ngang ${overflow}px`);
      const broken = await page.locator('img').evaluateAll((images) => images.filter((image) => image.complete && !image.naturalWidth).map((image) => image.currentSrc));
      if (broken.length) failures.push(`${width} ${name}: ảnh lỗi ${broken.join(', ')}`);
      await page.screenshot({ path: `${output}/${name}-${width}.png`, fullPage: true });
      results.push({ width, name, overflow, brokenImages: broken.length });
    };

    await page.goto(`${origin}/explore?serviceQuery=da&area=Quan+1`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: 'Xem chi tiết' }).first().waitFor();
    await inspect('explore-filtered');
    await page.getByRole('link', { name: 'Xem chi tiết' }).first().click();
    await page.getByRole('heading', { name: service.name, exact: true }).first().waitFor();
    await inspect('service-detail');
    await page.getByRole('link', { name: 'Quay lại khám phá' }).click();
    if (!page.url().includes('serviceQuery=da') || !page.url().includes('area=Quan+1')) failures.push(`${width}: mất bộ lọc khi quay lại`);

    await page.goto(`${origin}/explore/branches/qa-branch`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: branch.name, exact: true }).waitFor();
    await inspect('branch-detail');
    const nestedButton = await page.locator('.bb-detail-directory--services a button').count();
    if (nestedButton) failures.push(`${width}: nút lưu vẫn nằm trong liên kết`);
    const saveButton = page.getByRole('button', { name: `Lưu ${service.name}` });
    if (!await saveButton.isVisible()) failures.push(`${width}: thiếu nút lưu dịch vụ`);
    if (width === 390) {
      await saveButton.click();
      await page.waitForURL('**/login');
      if (!page.url().includes('/login')) failures.push('390: nút lưu không dẫn đến đăng nhập');
    }
    if (errors.length) failures.push(`${width}: ${errors.join('; ')}`);
    await page.close();
  }
} finally {
  await browser.close();
}
await writeFile(`${output}/results.json`, JSON.stringify({ fixtureOnly: true, results, failures }, null, 2));
console.log(JSON.stringify({ results: results.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
