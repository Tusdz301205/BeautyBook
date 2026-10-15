// Real page/DOM checks with intercepted API traffic. No production data writes.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const base = 'http://127.0.0.1:5176';
const output = path.resolve('../../report-output/service-simplification-20261014');
const service = {
  id: 'catalog', name: 'Chăm sóc tóc', price: 250000, durationMinutes: 45, status: 'ACTIVE',
  businessId: 'business', branchCoverage: { active: 1, total: 1 },
  branchAvailability: [{ branchId: 'branch', branchName: 'BeautyBook chi nhánh', branchServiceId: 'offering', status: 'ACTIVE', price: 250000, durationMinutes: 45, staffCount: 2 }],
};
const branch = {
  id: 'branch', name: 'BeautyBook chi nhánh', publicName: 'BeautyBook chi nhánh', businessId: 'business',
  status: 'ACTIVE', operationalStatus: 'ACTIVE', reviewStatus: 'DRAFT', serviceMode: 'MOBILE',
  serviceAreas: ['Quận 1'], serviceRadiusKm: 23, travelFee: 79000, excludedServiceAreas: ['Khu cũ'],
  onboardingProgress: { currentStep: 3, completedSteps: [1, 2], draftData: { wizardVersion: 2 } },
};
const session = { accessToken: 'mock-owner', user: { id: 'owner', fullName: 'QA Chủ cơ sở', businessId: 'business', sessionType: 'salon', roles: ['BUSINESS_OWNER'], scopes: [{ code: 'BUSINESS_OWNER', businessId: 'business' }] } };
session.user.permissions = ['business_service:update:tenant', 'business_service:create:tenant', 'business_service:archive:tenant', 'branch_service_offering:pricing:tenant', 'branch_service_offering:status:tenant', 'branch:read:tenant', 'branch:update:tenant', 'branch:create:tenant', 'user:read:self', 'notification:read:self'];

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const evidence = [];
  try {
    for (const width of (process.env.QA_WIDTHS || '320,375,414,768,1440').split(',').map(Number)) {
      const context = await browser.newContext({ viewport: { width, height: 960 }, serviceWorkers: 'block' });
      await context.routeWebSocket('**', socket => socket.close());
      const page = await context.newPage(), errors = [], writes = [];
      let failCreate = false, failRead = false;
      let config = {
        variants: [{ id: 'active', name: 'Tóc ngắn', priceDisplay: '200.000đ', durationMinutes: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 0, status: 'ACTIVE' }, { id: 'paused', name: 'Tóc dài', priceDisplay: '350.000đ', durationMinutes: 60, bufferBeforeMinutes: 5, bufferAfterMinutes: 0, status: 'INACTIVE' }],
        dependencies: [{ id: 'dep', requiredService: { name: 'Gội đầu' }, dependencyType: 'REQUIRED' }],
        priceRules: [{ id: 'rule', name: 'Cuối tuần', adjustmentType: 'FIXED_AMOUNT', adjustmentValue: 50000, active: true, conditions: { daysOfWeek: [0, 6] }, variant: null }],
      };
      page.on('pageerror', e => errors.push(e.message));
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin === base && !url.pathname.startsWith('/api') && !url.pathname.startsWith('/socket.io')) return route.continue();
        if (!url.pathname.startsWith('/api/v1/')) return route.fulfill({ status: 404, body: '' });
        const fulfill = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'access-control-allow-headers': '*' }, body: JSON.stringify(body) });
        const p = url.pathname.slice('/api/v1'.length);
        if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && p !== '/auth/refresh') writes.push({ method: request.method(), path: p, body: request.postDataJSON() });
        if (p === '/auth/refresh') return fulfill(session);
        if (p === '/business/onboarding/mine') return fulfill({ id: 'business', name: 'BeautyBook', status: 'APPROVED' });
        if (p === '/notifications/unread-count') return fulfill({ count: 0 });
        if (p === '/branches/accessible') return fulfill([branch]);
        if (p === '/branches/locations/districts') return fulfill([]);
        if (p === '/branches/accessible/branch') return fulfill(branch);
        if (p === '/branches/branch/onboarding') return fulfill({ branch });
        if (p === '/services/workspace/manage') return fulfill([service]);
        if (p === '/services/canonical') return fulfill([]);
        if (p === '/services/offering/options/manage') return failRead ? fulfill({ message: 'Read unavailable' }, 500) : fulfill(config);
        if (p === '/services/offering/variants') {
          if (failCreate) return fulfill({ message: 'Không thể lưu, hãy thử lại.' }, 503);
          const data = request.postDataJSON();
          config.variants.push({ ...data, id: 'new', priceDisplay: `${data.price}đ`, status: 'ACTIVE' });
          return fulfill(config.variants.at(-1));
        }
        if (p.startsWith('/services/variants/')) { const item = config.variants.find(v => p.endsWith(v.id)); Object.assign(item, request.postDataJSON()); return fulfill(item); }
        if (p === '/services/price-rules/rule') { Object.assign(config.priceRules[0], request.postDataJSON()); return fulfill(config.priceRules[0]); }
        if (p === '/services/offering/dependencies/dep') { config.dependencies = []; return fulfill({ deleted: true }); }
        if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) errors.push(`Unexpected mocked write ${request.method()} ${p}`);
        return fulfill([]);
      });
      await page.goto(`${base}/salon/services`);
      await page.getByRole('button', { name: 'Chi tiết', exact: true }).waitFor({ timeout: 15000 }).catch(async error => { await page.screenshot({ path: path.join(output, 'failed-load.png'), fullPage: true }); console.error('Page:', page.url(), await page.locator('body').innerText(), errors); throw error; });
      await page.getByRole('button', { name: 'Chi tiết', exact: true }).click();
      const drawer = page.getByRole('dialog', { name: 'Chăm sóc tóc', exact: true });
      await expect(drawer.getByRole('button', { name: 'Thêm lựa chọn', exact: true })).toBeVisible();
      await expect(drawer.getByRole('button', { name: 'Kích hoạt', exact: true })).toBeVisible();
      await expect(drawer.getByText('Buffer trước', { exact: true })).toHaveCount(0);
      await expect(drawer.getByText('Giá tối đa', { exact: true })).toHaveCount(0);
      await expect(drawer.locator('input:visible')).toHaveCount(0);
      await drawer.getByRole('button', { name: 'Thêm lựa chọn', exact: true }).click();
      await expect(drawer.locator('input:visible')).toHaveCount(3);
      await page.screenshot({ path: path.join(output, `simple-form-${width}.png`) });
      await drawer.getByRole('textbox', { name: /Tên lựa chọn/ }).fill('  Tóc ngang vai  ');
      await drawer.getByRole('spinbutton', { name: /Thời lượng/ }).fill('0');
      await drawer.getByRole('button', { name: 'Lưu lựa chọn', exact: true }).click();
      await expect(drawer.getByText('Nhập số phút nguyên lớn hơn 0.')).toBeVisible();
      expect(writes).toHaveLength(0);
      await drawer.getByRole('spinbutton', { name: /Thời lượng/ }).fill('45');
      if (width === 375) { failCreate = true; await drawer.getByRole('button', { name: 'Lưu lựa chọn', exact: true }).click(); await expect(page.getByText('Chưa thể xử lý yêu cầu. Vui lòng thử lại sau.')).toBeVisible(); await expect(drawer.getByRole('textbox', { name: /Tên lựa chọn/ })).toHaveValue('  Tóc ngang vai  '); failCreate = false; }
      await drawer.getByRole('button', { name: 'Lưu lựa chọn', exact: true }).evaluate(button => { button.click(); button.click(); });
      await expect(drawer.getByRole('button', { name: 'Thêm lựa chọn', exact: true })).toBeVisible();
      const creates = writes.filter(w => w.path === '/services/offering/variants');
      expect(creates).toHaveLength(width === 375 ? 2 : 1);
      expect(creates.at(-1).body).toMatchObject({ name: 'Tóc ngang vai', priceType: 'FIXED', price: 250000, durationMinutes: 45, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 });
      expect(creates.at(-1).body.code).toMatch(/^OPT-/);
      if (width === 375) expect(creates[0].body.code).toBe(creates[1].body.code);
      await drawer.getByRole('button', { name: 'Kích hoạt', exact: true }).click();
      await expect(drawer.getByRole('button', { name: 'Kích hoạt', exact: true })).toHaveCount(0);
      expect(writes.find(w => w.path === '/services/variants/paused').body).toEqual({ status: 'ACTIVE' });
      await drawer.locator('summary').filter({ hasText: 'Quy định đã thiết lập' }).click();
      await expect(drawer.getByText('Gội đầu', { exact: true })).toBeVisible();
      await drawer.getByRole('button', { name: 'Tắt quy tắc', exact: true }).click();
      const confirm = page.getByRole('dialog', { name: 'Tắt điều chỉnh giá?' });
      await confirm.getByRole('button', { name: 'Hủy', exact: true }).click();
      expect(writes.some(w => w.path === '/services/price-rules/rule')).toBe(false);
      await drawer.getByRole('button', { name: 'Tắt quy tắc', exact: true }).click();
      await confirm.getByRole('button', { name: 'Xác nhận', exact: true }).click();
      await expect(drawer.getByRole('button', { name: 'Bật lại', exact: true })).toBeVisible();
      expect(writes.find(w => w.path === '/services/price-rules/rule').body).toEqual({ active: false });
      await drawer.getByRole('button', { name: 'Gỡ quy định', exact: true }).click();
      await page.getByRole('dialog', { name: 'Gỡ quy định đi kèm?' }).getByRole('button', { name: 'Xác nhận', exact: true }).click();
      await expect(drawer.getByText('Gội đầu', { exact: true })).toHaveCount(0);
      if (width === 375) {
        failRead = true;
        await drawer.getByRole('button', { name: 'Bật lại', exact: true }).click();
        await page.getByRole('dialog', { name: 'Bật lại điều chỉnh giá?' }).getByRole('button', { name: 'Xác nhận', exact: true }).click();
        await expect(drawer.getByText('Không thể tải cài đặt dịch vụ. Vui lòng thử lại.')).toBeVisible(); failRead = false;
        await drawer.getByRole('button', { name: /Thử lại/ }).click();
        await expect(drawer.getByRole('button', { name: 'Thêm lựa chọn', exact: true })).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await drawer.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      await page.screenshot({ path: path.join(output, `service-options-${width}.png`), fullPage: true });
      await page.goto(`${base}/salon/branches/branch/setup`);
      await expect(page.getByRole('textbox', { name: /Khu vực nhận dịch vụ tại nhà/ })).toBeVisible();
      for (const name of ['Bán kính (km)', 'Phí di chuyển', 'Khu vực không hỗ trợ']) await expect(page.getByText(name, { exact: true })).toHaveCount(0);
      await page.getByRole('textbox', { name: /Khu vực nhận dịch vụ tại nhà/ }).fill('Quận 1\nQuận 3, Quận 5');
      await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
      await expect.poll(() => writes.filter(w => w.path === '/branches/branch/onboarding').length).toBe(1);
      const patch = writes.find(w => w.path === '/branches/branch/onboarding').body;
      expect(patch.branch.serviceAreas).toEqual(['Quận 1', 'Quận 3', 'Quận 5']);
      for (const key of ['serviceRadiusKm', 'travelFee', 'excludedServiceAreas']) expect(key in patch.branch).toBe(false);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: path.join(output, `home-service-${width}.png`), fullPage: true });
      if (width === 375) {
        config = { variants: [], dependencies: [], priceRules: [] };
        await page.goto(`${base}/salon/services`);
        await page.getByRole('button', { name: 'Chi tiết', exact: true }).click();
        await expect(drawer.getByText('Đang dùng giá và thời lượng của dịch vụ.')).toBeVisible();
        await expect(drawer.locator('summary')).toHaveCount(0);
        await drawer.getByRole('button', { name: 'Thêm lựa chọn', exact: true }).click();
        await drawer.getByRole('textbox', { name: /Tên lựa chọn/ }).fill('Dịch vụ có chuẩn bị');
        await drawer.locator('summary').filter({ hasText: 'Thời gian chuẩn bị và nghỉ' }).click();
        await drawer.getByRole('spinbutton', { name: /Chuẩn bị trước/ }).fill('-1');
        const count = writes.filter(w => w.path === '/services/offering/variants').length;
        await drawer.getByRole('button', { name: 'Lưu lựa chọn', exact: true }).click();
        await expect(drawer.getByText('Nhập số phút nguyên từ 0 trở lên.')).toBeVisible();
        expect(writes.filter(w => w.path === '/services/offering/variants')).toHaveLength(count);
        await drawer.getByRole('spinbutton', { name: /Chuẩn bị trước/ }).fill('5');
        await drawer.getByRole('spinbutton', { name: /Nghỉ sau dịch vụ/ }).fill('10');
        await drawer.getByRole('button', { name: 'Lưu lựa chọn', exact: true }).click();
        await expect(drawer.getByText('Dịch vụ có chuẩn bị', { exact: true })).toBeVisible();
        expect(writes.filter(w => w.path === '/services/offering/variants').at(-1).body).toMatchObject({ bufferBeforeMinutes: 5, bufferAfterMinutes: 10 });
      }
      expect(errors).toEqual([]);
      evidence.push({ width, status: 'PASS', writes: writes.length, realBackendContact: false });
      await context.close();
    }
    fs.writeFileSync(path.join(output, 'browser.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

