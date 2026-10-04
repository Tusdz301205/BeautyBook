import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { businessMediaById, branchMediaById } from '../../src/config/entityMedia.generated.js';

// Read-only visual smoke test. Every API request is intercepted; mutations are blocked.
const origin = process.env.BB_WEB_URL || 'http://127.0.0.1:5173';
const output = '../../report-output/ux-improvement';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const failures = [];
const checks = [];

const business = {
  id: 'qa-business', name: 'Doanh nghiệp chăm sóc sắc đẹp và thư giãn Phương Nam', status: 'ACTIVE',
  owner: { fullName: 'Nguyễn Thị Minh Anh Phương', email: 'owner@example.invalid' },
  activeBranchCount: 1, branchCount: 1, serviceCount: 2, bookingCount: 3,
  createdAt: '2026-01-01T00:00:00Z',
};
const branch = {
  id: 'qa-branch', businessId: business.id, business, name: 'Chi nhánh Nguyễn Thị Minh Khai',
  branch_name: 'Chi nhánh Nguyễn Thị Minh Khai', status: 'ACTIVE', publicName: 'Chi nhánh Nguyễn Thị Minh Khai',
  location: '123 Nguyễn Thị Minh Khai, Quận 1, TP. Hồ Chí Minh',
  serviceCount: 2, bookingCount: 3, rating: 4.8,
};
const mappedBusiness = { ...business, id: '35393357-e246-45d1-a4c1-11baf58861ee', name: 'Lan Anh Beauty Salon' };
const mappedBranch = { ...branch, id: 'de5bd83e-d413-45e4-862a-603acdeb7e91', businessId: mappedBusiness.id, business: mappedBusiness, name: 'Lan Anh Beauty Salon - Quận Long Biên', publicName: 'Lan Anh Beauty Salon - Quận Long Biên' };
const roles = [
  { key: 'admin', path: '/admin/salons', heading: 'Doanh nghiệp & chi nhánh', user: { id: 'qa-admin', fullName: 'Quản trị viên BeautyBook', email: 'admin@example.invalid', sessionType: 'admin', workspace: 'PLATFORM', roles: ['PLATFORM_ADMIN'], scopes: [{ code: 'PLATFORM_ADMIN' }], permissions: ['branch:read:platform', 'business:review:platform', 'report:overview:platform'] } },
  { key: 'owner', path: '/salon/appointments', heading: 'Lịch hẹn toàn doanh nghiệp', user: { id: 'qa-owner', fullName: 'Nguyễn Thị Minh Anh Phương', email: 'owner@example.invalid', sessionType: 'salon', workspace: 'SALON', roles: ['BUSINESS_OWNER'], scopes: [{ code: 'BUSINESS_OWNER', businessId: business.id }], permissions: ['booking:read:tenant', 'booking:create:tenant', 'booking:update:tenant', 'change_request:approve:tenant', 'report:overview:tenant', 'report:revenue:tenant', 'payment:read:tenant', 'review:moderate:tenant', 'branch:read:tenant'] } },
  { key: 'receptionist', path: '/salon/appointments', heading: 'Lịch hẹn tại quầy', user: { id: 'qa-receptionist', fullName: 'Bùi Hồ Thị Thanh Tuyền', email: 'receptionist@example.invalid', sessionType: 'salon', workspace: 'SALON', roles: ['RECEPTIONIST'], scopes: [{ code: 'RECEPTIONIST', businessId: business.id, branchId: branch.id }], permissions: ['booking:read:branch', 'booking:create:branch', 'booking:update:branch', 'change_request:approve:branch', 'branch:read:branch'] } },
  { key: 'staff', path: '/salon/appointments', heading: 'Lịch của tôi', user: { id: 'qa-staff-user', fullName: 'Đỗ Thị Ngọc Bích Phương Anh', email: 'staff@example.invalid', sessionType: 'salon', workspace: 'SALON', roles: ['STAFF'], scopes: [{ code: 'STAFF', businessId: business.id, branchId: branch.id }], permissions: ['booking:read:branch', 'booking:update:branch', 'booking:complete:branch', 'branch:read:branch'] } },
];

const respond = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

try {
  for (const role of roles) {
    for (const width of [375, 768, 1024, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: width === 375 ? 812 : 900 }, deviceScaleFactor: 1 });
      const errors = [];
      let dashboardMode = 'empty';
      let directoryMode = 'sample';
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/api/v1/**', (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/api/v1/auth/refresh') return respond(route, { accessToken: 'qa-only', user: role.user });
        if (route.request().method() !== 'GET') return route.abort('blockedbyclient');
        if (path === '/api/v1/business/onboarding/mine') return respond(route, { ...business, status: 'ACTIVE' });
        if (path === '/api/v1/admin/business-directory') return respond(route, { data: [directoryMode === 'mapped' ? mappedBusiness : business], pagination: { page: 1, total: 1, totalPages: 1 } });
        if (path === '/api/v1/admin/branch-directory') return respond(route, { data: [directoryMode === 'mapped' ? mappedBranch : branch], pagination: { page: 1, total: 1, totalPages: 1 } });
        if (path === '/api/v1/branches/accessible' || path === '/api/v1/branches/manage') return respond(route, [branch]);
        if (path === '/api/v1/bookings/scheduler') return respond(route, { staff: [{ id: 'qa-staff', userId: 'qa-staff-user', fullName: 'Đỗ Thị Ngọc Bích Phương Anh' }], bookings: [] });
        if (path === '/api/v1/bookings/salon-queue' || path === '/api/v1/bookings/change-requests/pending') return respond(route, []);
        if (path === '/api/v1/reports/overview') return respond(route, { totalBranches: 1, totalUsers: 10, totalBookings: 3, totalRevenue: 450000 });
        if (path === '/api/v1/reports/owner-dashboard' && dashboardMode === 'failed') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'temporarily unavailable' }) });
        if (path === '/api/v1/reports/owner-dashboard') return respond(route, { kpis: dashboardMode === 'active'
          ? { netRevenue: { current: 450000, changePercent: null }, bookings: { current: 1, changePercent: null }, completedBookings: { current: 1, changePercent: null } }
          : {}, charts: dashboardMode === 'active'
          ? { revenueSeries: [{ date: '2026-09-28', grossRevenue: 450000, netRevenue: 450000, refundAmount: 0, discountAmount: 0 }], bookingStatus: [{ status: 'COMPLETED', count: 1 }], branchComparison: [], topServices: [], staffPerformance: [] }
          : { revenueSeries: [], bookingStatus: [], branchComparison: [], topServices: [], staffPerformance: [] } });
        return respond(route, []);
      });

      try {
        await page.goto(`${origin}${role.path}`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: role.heading, exact: true }).first().waitFor({ timeout: 8000 });
        await page.waitForTimeout(300);
        if (role.key === 'admin') {
          await page.getByText(business.name, { exact: true }).filter({ visible: true }).first().waitFor({ timeout: 8000 });
        } else {
          await page.getByText(branch.publicName, { exact: false }).first().waitFor();
        }
        const dimensions = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth }));
        if (dimensions.page > dimensions.viewport + 1) failures.push(`${role.key} ${width}: ngang ${dimensions.page} > ${dimensions.viewport}`);
        if (errors.length) failures.push(`${role.key} ${width}: ${errors.join('; ')}`);
        const brokenImages = await page.locator('img').evaluateAll((images) => images.filter((image) => image.complete && image.naturalWidth === 0).map((image) => image.currentSrc));
        if (brokenImages.length) failures.push(`${role.key} ${width}: ảnh lỗi ${brokenImages.join(', ')}`);
        if (width === 375) {
          await page.getByRole('button', { name: 'Mở menu' }).click();
          const sidebar = page.locator('aside[aria-label="Điều hướng chính"]');
          await page.waitForTimeout(250);
          if (await sidebar.evaluate((element) => element.getBoundingClientRect().right <= 0)) failures.push(`${role.key}: mobile menu không hiện`);
          await page.getByRole('button', { name: 'Đóng menu' }).last().click();
          await page.waitForTimeout(250);
        }
        await page.screenshot({ path: `${output}/${role.key}-${width}.png`, fullPage: true });
        checks.push(`${role.key}-${width}`);
        if (role.key === 'admin' && [375, 1440].includes(width)) {
          await page.getByRole('tab', { name: 'Chi nhánh' }).click();
          await page.getByText(branch.publicName, { exact: true }).filter({ visible: true }).first().waitFor({ timeout: 8000 });
          await page.screenshot({ path: `${output}/admin-branches-${width}.png`, fullPage: true });
          if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) failures.push(`admin branches ${width}: tràn ngang`);
          checks.push(`admin-branches-${width}`);
        }
        if (role.key === 'admin' && width === 375 && businessMediaById[mappedBusiness.id] && branchMediaById[mappedBranch.id]) {
          directoryMode = 'mapped';
          await page.reload({ waitUntil: 'domcontentloaded' });
          const businessImage = page.locator('article img').first();
          await businessImage.waitFor({ timeout: 8000 });
          await businessImage.scrollIntoViewIfNeeded();
          const businessWidth = await businessImage.evaluate((image) => image.decode().then(() => image.naturalWidth).catch(() => 0));
          if (!businessWidth) failures.push('admin business media: ảnh theo ID không tải');
          const businessSrc = await businessImage.getAttribute('src');
          await page.screenshot({ path: `${output}/admin-media-business-375.png`, fullPage: true });
          await page.getByRole('tab', { name: 'Chi nhánh' }).click();
          const branchImage = page.locator('article img').first();
          await branchImage.waitFor({ timeout: 8000 });
          await branchImage.scrollIntoViewIfNeeded();
          const branchWidth = await branchImage.evaluate((image) => image.decode().then(() => image.naturalWidth).catch(() => 0));
          if (!branchWidth) failures.push('admin branch media: ảnh theo ID không tải');
          if (businessSrc === await branchImage.getAttribute('src')) failures.push('admin directory media: doanh nghiệp và chi nhánh dùng trùng ảnh');
          await page.screenshot({ path: `${output}/admin-media-branch-375.png`, fullPage: true });
          checks.push('admin-media-business-375', 'admin-media-branch-375');
        }
        if (role.key === 'receptionist' && width === 375) {
          await page.getByRole('button', { name: 'Việc cần xử lý' }).click();
          await page.getByRole('heading', { name: 'Trung tâm hành động' }).waitFor();
          await page.screenshot({ path: `${output}/receptionist-actions-375.png`, fullPage: true });
          checks.push('receptionist-actions-375');
        }
        if (width === 375 && ['admin', 'receptionist'].includes(role.key)) {
          await page.evaluate(() => { document.documentElement.style.fontSize = '24px'; });
          await page.waitForTimeout(150);
          await page.screenshot({ path: `${output}/${role.key}-text-150-375.png`, fullPage: true });
          if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) failures.push(`${role.key} 375: tràn ngang khi tăng cỡ chữ 150%`);
          checks.push(`${role.key}-text-150-375`);
        }
        if (['admin', 'owner'].includes(role.key) && [375, 1440].includes(width)) {
          await page.goto(`${origin}/${role.key === 'admin' ? 'admin' : 'salon'}`, { waitUntil: 'domcontentloaded' });
          await page.getByRole('heading', { name: role.key === 'admin' ? 'Xin chào, Quản trị viên BeautyBook' : 'Tổng quan doanh nghiệp' }).waitFor({ timeout: 8000 });
          await page.waitForTimeout(300);
          if (role.key === 'owner') {
            await page.getByText('Chưa có hoạt động để vẽ biểu đồ', { exact: true }).waitFor({ timeout: 8000 });
            if (await page.getByRole('heading', { name: 'Doanh thu theo thời gian' }).count()) failures.push(`owner overview ${width}: còn biểu đồ rỗng lặp lại`);
          }
          if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) failures.push(`${role.key} overview ${width}: tràn ngang`);
          if (errors.length) failures.push(`${role.key} overview ${width}: ${errors.join('; ')}`);
          await page.screenshot({ path: `${output}/${role.key}-overview-${width}.png`, fullPage: true });
          if (width === 375) await page.screenshot({ path: `${output}/${role.key}-overview-viewport-375.png` });
          checks.push(`${role.key}-overview-${width}`);
          if (role.key === 'owner' && width === 1440) {
            dashboardMode = 'active';
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.getByRole('heading', { name: 'Doanh thu theo thời gian' }).waitFor({ timeout: 8000 });
            if (await page.getByText('Chưa có hoạt động để vẽ biểu đồ', { exact: true }).count()) failures.push('owner overview with data: empty state persists');
            if (await page.getByText('Chưa có dữ liệu trong kỳ', { exact: true }).count()) failures.push('owner overview with data: empty chart cards persist');
            await page.screenshot({ path: `${output}/owner-overview-data-1440.png`, fullPage: true });
            checks.push('owner-overview-data-1440');
            dashboardMode = 'failed';
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.getByText('Chưa tải được dữ liệu phân tích', { exact: true }).waitFor({ timeout: 8000 });
            const notice = page.getByText('Một phần dữ liệu chưa tải được: phân tích', { exact: false });
            if (!await notice.count()) failures.push('owner overview failed report: thiếu nhãn lỗi dễ hiểu');
            if (await page.getByText('Một phần dữ liệu chưa tải được: dashboard', { exact: false }).count()) failures.push('owner overview failed report: lộ tên dữ liệu nội bộ');
            await page.screenshot({ path: `${output}/owner-overview-error-1440.png`, fullPage: true });
            checks.push('owner-overview-error-1440');
          }
        }
      } catch (error) {
        failures.push(`${role.key} ${width}: ${error.message}`);
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ checks, failures }, null, 2));
if (failures.length) process.exitCode = 1;
