import { test, expect } from '@playwright/test';

// UI race regression only: all API traffic is simulated; no booking is written.
async function setup(page, mode) {
  const branches = ['A', 'B'].map(id => ({ id, name: `Cơ sở QA ${id}` }));
  const service = id => ({ id: `service-${id}`, name: `Dịch vụ QA ${id}`, price: 100000, durationMinutes: 30 });
  const errors = [], held = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/v1/**', async route => {
    const r = route.request(), u = new URL(r.url()), p = u.pathname;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method()) && p !== '/api/v1/auth/refresh') {
      errors.push(`Unplanned write ${r.method()} ${p}`); return route.abort();
    }
    let body = {};
    if (p === '/api/v1/auth/refresh') body = { accessToken: 'mock-race-only', user: {
      id: 'mock-race-customer', fullName: 'Khách QA', email: 'race@example.test', sessionType: 'customer',
      roles: ['CUSTOMER'], scopes: [{ code: 'CUSTOMER' }], permissions: [], isEmailVerified: true } };
    if (p === '/api/v1/branches') body = branches;
    if (p === '/api/v1/services') {
      const branch = u.searchParams.get('branchId');
      body = [service(branch)];
      if (mode === 'branch' && branch === 'A') {
        await new Promise(resolve => held.push({ route, resolve, body })); return;
      }
    }
    if (p === '/api/v1/combos/public') body = [];
    if (p === '/api/v1/staff/public') body = [1, 2].map(id => ({ id: `staff-${id}`, fullName: `Chuyên viên QA ${id}` }));
    if (p === '/api/v1/bookings/available-slots') {
      const date = u.searchParams.get('date');
      body = { slots: [{ start: `${date}T01:00:00.000Z`, end: `${date}T01:30:00.000Z` }], timezone: 'Asia/Ho_Chi_Minh' };
      if (!held.length) { await new Promise(resolve => held.push({ route, resolve, body, date })); return; }
      body.slots = [{ start: `${date}T03:00:00.000Z`, end: `${date}T03:30:00.000Z` }];
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  return { held, errors, release: async (status = 200) => {
    const item = held[0];
    await item.route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status === 200 ? item.body : { message: 'QA stale request failed' }) });
    item.resolve();
  } };
}

for (const width of [375, 1440]) {
  test(`@responsive branch catalog late response never replaces current selection ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const h = await setup(page, 'branch');
    await page.goto('/book');
    await page.getByRole('button', { name: /^Cơ sở QA A / }).click();
    await expect.poll(() => h.held.length).toBe(1);
    await page.getByRole('button', { name: /^Cơ sở QA B / }).click();
    await expect(page.getByRole('button', { name: /Dịch vụ QA B/ })).toBeVisible();
    await h.release();
    await expect(page.getByRole('button', { name: /Dịch vụ QA A/ })).toHaveCount(0);
    await page.getByRole('button', { name: /Dịch vụ QA B/ }).click();
    await expect(page.getByRole('button', { name: 'Chọn chuyên viên', exact: true }).first()).toBeEnabled();
    expect(h.errors).toEqual([]);
    await page.screenshot({ path: info.outputPath(`branch-race-${width}.png`) });
  });
  for (const staleStatus of [200, 500]) {
    test(`@responsive date slots ignore old ${staleStatus} response ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      const h = await setup(page, 'date');
      await page.goto('/book?branchId=B&serviceId=service-B');
      await page.getByRole('button', { name: 'Chọn chuyên viên', exact: true }).first().click();
      await page.getByRole('button', { name: /Chuyên viên QA 1/ }).click();
      await page.getByRole('button', { name: 'Chọn thời gian', exact: true }).first().click();
      const dates = page.getByRole('button', { name: /tháng \d+/ });
      await dates.nth(2).click();
      await expect.poll(() => h.held.length).toBe(1);
      await dates.nth(3).click();
      await expect(page.getByRole('button', { name: '10:00', exact: true })).toBeVisible();
      await page.getByRole('button', { name: '10:00', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Nhập thông tin', exact: true }).first()).toBeEnabled();
      await h.release(staleStatus);
      await expect(page.getByRole('button', { name: '08:00', exact: true })).toHaveCount(0);
      await expect(page.getByText('QA stale request failed', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Nhập thông tin', exact: true }).first()).toBeEnabled();
      expect(h.errors).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`date-race-${staleStatus}-${width}.png`) });
    });
  }
}
