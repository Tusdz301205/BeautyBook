import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Visual smoke test only. Every API response is intercepted; no booking is created.
const origin = process.env.BB_WEB_URL || 'http://127.0.0.1:5173';
const output = '../../report-output/mobile-web-redesign';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const failures = [];
const screens = [];
const progressMetrics = [];
const service = { id: 'qa-service', name: 'Chăm sóc da chuyên sâu và thư giãn', durationMinutes: 60, price: 450000, priceDisplay: '450.000₫', variants: [] };
const staff = { id: 'qa-staff', fullName: 'Đỗ Thị Ngọc Bích Phương Anh', professionalTitle: 'Chuyên viên chăm sóc da chuyên sâu', specialties: ['Chăm sóc da', 'Tư vấn liệu trình phù hợp'], rating: 4.9, ratingCount: 128 };
const branch = { id: 'qa-branch', name: 'Chi nhánh BeautyBook kiểm thử', branch_name: 'Chi nhánh BeautyBook kiểm thử', addressLine: '123 Đường Hoa', district: { name: 'Quận 1', province: { name: 'TP. Hồ Chí Minh' } }, business: { name: 'BeautyBook kiểm thử' }, images: [], workingHours: [], recentReviews: [], stats: {}, services: [service], staff: [staff] };
const appointmentDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
const booking = { id: 'qa-booking', bookingCode: 'QA-001', status: 'CONFIRMED', branchId: branch.id, branch, appointmentDate, appointmentStartTime: '10:00', appointmentEndTime: '11:00', finalAmount: 450000, bookingServices: [{ id: 'qa-item', serviceId: service.id, service, serviceNameSnapshot: service.name, durationMinutes: 60, priceAtBooking: 450000, status: 'SCHEDULED', staff: { user: { fullName: staff.fullName } } }], statusHistory: [] };
const respond = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

try {
  for (const width of [320, 360, 390, 430, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: { 320: 800, 360: 800, 390: 844, 430: 932, 768: 1024, 1440: 900 }[width] }, deviceScaleFactor: 1 });
    let slotMode = 'normal';
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/api/v1/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      if (path === '/api/v1/auth/refresh') return respond(route, { accessToken: 'qa-only', user: { id: 'qa-customer', fullName: 'Khách hàng kiểm thử', email: 'qa@example.invalid', sessionType: 'customer', workspace: 'CUSTOMER', roles: ['CUSTOMER'], scopes: [{ code: 'CUSTOMER' }] } });
      if (path === '/api/v1/branches/qa-branch') return respond(route, branch);
      if (path === '/api/v1/services/qa-service') return respond(route, { ...service, branchId: branch.id, branch, category: { name: 'Chăm sóc da' }, images: [], description: 'Dịch vụ chăm sóc da trong dữ liệu kiểm thử.', staffServices: [{ staff }] });
      if (path === '/api/v1/staff/public/qa-staff') return respond(route, { ...staff, branch, staffServices: [{ service }] });
      if (path === '/api/v1/bookings/qa-booking') return respond(route, booking);
      if (path === '/api/v1/platform-settings/public') return respond(route, { allowRescheduleRequests: true });
      if (path === '/api/v1/branches') return respond(route, [{ id: 'qa-branch', branch_name: 'Chi nhánh BeautyBook kiểm thử', address: '123 Đường Hoa', district: 'Quận 1' }]);
      if (path === '/api/v1/services') return respond(route, [service]);
      if (path === '/api/v1/combos/public') return respond(route, []);
      if (path === '/api/v1/staff/public') return respond(route, [staff]);
      if (path === '/api/v1/bookings/available-slots') {
        const date = url.searchParams.get('date');
        return respond(route, { slots: slotMode === 'empty' ? [] : [{ start: `${date}T10:00:00+07:00`, end: `${date}T11:00:00+07:00` }] });
      }
      if (path === '/api/v1/bookings/self-booking-policy') return respond(route, { selfBookingAllowed: true, acknowledgmentRequired: false });
      if (path === '/api/v1/bookings/preview-price') return respond(route, { subtotal: 450000, finalAmount: 450000, promotionDiscount: 0 });
      if (route.request().method() !== 'GET') return route.abort('blockedbyclient');
      return respond(route, []);
    });
    await page.goto(`${origin}/book`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Chọn chi nhánh và dịch vụ' }).waitFor();
    await page.getByRole('button', { name: /Chi nhánh BeautyBook kiểm thử/ }).click();
    await page.getByRole('button', { name: /Chăm sóc da chuyên sâu và thư giãn/ }).click();
    await page.getByRole('button', { name: 'Chọn chuyên viên', exact: true }).last().click();
    await page.getByRole('heading', { name: 'Chọn chuyên viên' }).waitFor();
    await page.getByRole('button', { name: /Đỗ Thị Ngọc Bích Phương Anh/ }).click();
    progressMetrics.push(await page.evaluate(() => ({ width: innerWidth, scrollY, progressTop: document.querySelector('.bb-booking-progress')?.getBoundingClientRect().top, circleTop: document.querySelector('.bb-booking-progress__number')?.getBoundingClientRect().top })));
    await page.screenshot({ path: `${output}/booking-staff-${width}.png` });
    const fullNameVisible = await page.getByText(staff.fullName, { exact: true }).isVisible();
    if (!fullNameVisible) failures.push(`${width}: staff name not visible`);
    const checkOverflow = async (routeName) => {
      const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }));
      if (dimensions.scroll > dimensions.viewport + 1) failures.push(`${width} ${routeName}: horizontal overflow ${dimensions.scroll} > ${dimensions.viewport}`);
    };
    await checkOverflow('staff');
    await page.getByRole('button', { name: 'Chọn thời gian' }).last().click();
    await page.getByRole('heading', { name: 'Chọn ngày và khung giờ' }).waitFor();
    await page.locator('.bb-booking-days button').first().click();
    await page.getByRole('button', { name: '10:00' }).click();
    await checkOverflow('time');
    await page.getByRole('button', { name: 'Nhập thông tin' }).last().click();
    await page.getByRole('heading', { name: 'Thông tin liên hệ' }).waitFor();
    await page.getByLabel('Số điện thoại').fill('0912345678');
    await page.getByRole('checkbox', { name: /Tôi đồng ý/ }).check();
    await page.getByRole('button', { name: 'Xem lại lịch hẹn' }).last().click();
    await page.getByRole('heading', { name: 'Kiểm tra và xác nhận' }).waitFor();
    try { await expect(page.getByText('Chi nhánh BeautyBook kiểm thử', { exact: true }).last()).toBeVisible({ timeout: 5000 }); }
    catch { failures.push(`${width}: review missing selected branch`); }
    try { await expect(page.getByText(staff.fullName, { exact: true }).last()).toBeVisible({ timeout: 5000 }); }
    catch { failures.push(`${width}: review missing selected staff`); }
    await page.screenshot({ path: `${output}/booking-confirm-${width}.png` });
    await checkOverflow('confirm');
    const confirmEnabled = await page.getByRole('button', { name: 'Xác nhận đặt lịch' }).last().isEnabled();
    if (!confirmEnabled) failures.push(`${width}: confirmation not enabled with fixture`);
    // Never click the final confirm; this checks only the reachable UI and preview.
    if (width === 390) {
      await page.getByRole('button', { name: 'Quay lại chỉnh sửa' }).click();
      await page.getByLabel('Số điện thoại').fill('123');
      await page.getByRole('checkbox', { name: /Tôi đồng ý/ }).uncheck();
      await page.getByRole('button', { name: 'Xem lại lịch hẹn' }).last().click();
      if (!await page.getByText('Dùng 10 chữ số bắt đầu bằng 0, hoặc mã quốc gia +84.').isVisible()) failures.push('390 info: missing phone validation');
      if (!await page.getByText('Bạn cần đồng ý xử lý dữ liệu để gửi yêu cầu đặt lịch.').isVisible()) failures.push('390 info: missing consent validation');
      if (await page.getByLabel('Họ và tên').inputValue() !== 'Khách hàng kiểm thử') failures.push('390 info: name was lost after validation');
      await page.getByLabel('Số điện thoại').fill('0912345678');
      await page.getByRole('checkbox', { name: /Tôi đồng ý/ }).check();
      slotMode = 'empty';
      await page.getByRole('button', { name: 'Quay lại', exact: true }).last().click();
      await page.getByText('Ngày này chưa còn giờ phù hợp').waitFor();
      await page.getByRole('button', { name: 'Đổi chuyên viên' }).click();
      await page.getByRole('heading', { name: 'Chọn chuyên viên' }).waitFor();
      slotMode = 'normal';
    }
    const routes = [['home', '/'], ['explore', '/explore'], ['service-detail', '/explore/services/qa-service'], ['branch-detail', '/explore/branches/qa-branch'], ['staff-detail', '/explore/staff/qa-staff'], ['appointments', '/customer/appointments']];
    if ([390, 1440].includes(width)) routes.push(['appointment-detail', '/customer/appointments/qa-booking'], ['saved-services', '/customer/benefits'], ['vouchers', '/customer/vouchers'], ['reviews', '/customer/reviews'], ['notifications', '/customer/notifications'], ['profile', '/customer/profile'], ['privacy', '/customer/privacy'], ['security', '/customer/security'], ['business', '/for-business']);
    for (const [routeName, path] of routes) {
      await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded' });
      await page.locator('h1').first().waitFor();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${output}/${routeName}-${width}.png` });
      await checkOverflow(routeName);
      const brokenImages = await page.locator('img').evaluateAll((images) => images.filter((item) => item.complete && item.naturalWidth === 0).map((item) => item.currentSrc));
      if (brokenImages.length) failures.push(`${width} ${routeName}: broken images ${brokenImages.join(', ')}`);
      if (routeName === 'service-detail') {
        const bookingLink = page.locator('a[href*="/book?branchId=qa-branch&serviceId=qa-service"]').first();
        if (!await bookingLink.count()) failures.push(`${width} service-detail: missing booking deep link`);
        else {
          await bookingLink.click();
          await page.getByRole('heading', { name: 'Chọn chi nhánh và dịch vụ' }).waitFor();
          try { await expect(page.getByRole('button', { name: /Chăm sóc da chuyên sâu và thư giãn/ })).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 }); }
          catch { failures.push(`${width} service-detail: deep link did not select service`); }
        }
      }
      if (routeName === 'staff-detail' && width === 390) {
        const staffLink = page.locator('a[href*="/book?branchId=qa-branch&staffId=qa-staff"]').first();
        if (!await staffLink.count()) failures.push('390 staff-detail: missing booking deep link');
        else {
          await staffLink.click();
          await page.getByRole('heading', { name: 'Chọn chi nhánh và dịch vụ' }).waitFor();
          await page.getByRole('button', { name: /Chăm sóc da chuyên sâu và thư giãn/ }).click();
          await page.getByRole('button', { name: 'Chọn chuyên viên' }).last().click();
          try { await expect(page.getByRole('button', { name: /Đỗ Thị Ngọc Bích Phương Anh/ })).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 }); }
          catch { failures.push('390 staff-detail: deep link did not select staff'); }
        }
      }
      if (routeName === 'appointment-detail' && width === 390) {
        const changeButton = page.getByRole('button', { name: 'Yêu cầu đổi lịch' });
        if (!await changeButton.count()) failures.push('390 appointment-detail: missing reschedule action');
        else {
          await changeButton.click();
          await page.getByRole('dialog').waitFor();
          if (!await page.getByText('Giờ trống sẽ hiển thị sau khi bạn chọn ngày.').isVisible()) failures.push('390 reschedule: date prompt missing');
          await page.getByRole('dialog').locator('button[aria-pressed]').nth(1).click();
          await page.getByRole('dialog').getByRole('button', { name: '10:00' }).click();
          await page.getByLabel('Lý do đổi lịch').fill('Cần chuyển sang ngày khác');
          if (!await page.getByRole('dialog').getByRole('button', { name: 'Gửi yêu cầu' }).isEnabled()) failures.push('390 reschedule: submit not enabled after valid input');
          await page.screenshot({ path: `${output}/reschedule-390.png` });
          await page.keyboard.press('Escape');
        }
      }
      if (routeName === 'home' && width < 768) {
        const menu = page.getByRole('button', { name: 'Mở menu' });
        await menu.click();
        await page.keyboard.press('Shift+Tab');
        const lastLinkFocused = await page.locator('#public-mobile-menu a').last().evaluate((item) => item === document.activeElement);
        if (!lastLinkFocused) failures.push(`${width} home: menu focus does not wrap`);
        await page.keyboard.press('Escape');
        if (!await menu.evaluate((item) => item === document.activeElement)) failures.push(`${width} home: focus not returned to menu trigger`);
      }
    }
    if (errors.length) failures.push(`${width}: ${errors.join('; ')}`);
    screens.push(width);
    await page.close();
    const loginPage = await browser.newPage({ viewport: { width, height: { 320: 800, 360: 800, 390: 844, 430: 932, 768: 1024, 1440: 900 }[width] } });
    await loginPage.route('**/api/v1/auth/refresh', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
    await loginPage.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
    await loginPage.locator('h1').first().waitFor();
    await loginPage.waitForTimeout(500);
    await loginPage.screenshot({ path: `${output}/login-${width}.png` });
    const loginOverflow = await loginPage.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    if (loginOverflow) failures.push(`${width} login: horizontal overflow`);
    await loginPage.goto(`${origin}/register`, { waitUntil: 'domcontentloaded' });
    await loginPage.locator('h1').first().waitFor();
    await loginPage.waitForTimeout(300);
    await loginPage.screenshot({ path: `${output}/register-${width}.png` });
    if (await loginPage.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) failures.push(`${width} register: horizontal overflow`);
    await loginPage.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify({ screens, progressMetrics, failures }, null, 2));
if (failures.length) process.exitCode = 1;
