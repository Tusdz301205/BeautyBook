// Run directly with Node against the root-owned QA server. All backend traffic
// is intercepted, including auth bootstrap; no real API or socket is contacted.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve('../../report-output/bugreport-remediation', `notification-ui-${Date.now()}`);
fs.mkdirSync(output, { recursive: true });
const session = id => ({ accessToken: `mock-${id}`, user: {
  id, fullName: `QA ${id}`, sessionType: 'salon', roles: ['STAFF'],
  scopes: [{ code: 'STAFF', businessId: 'tenant', branchId: 'branch' }],
  permissions: ['notification:read:self', 'booking:read:branch', 'user:read:self'],
} });
const row = id => ({ id, title: `Notification ${id}`, message: 'Controlled notification transport',
  type: 'SYSTEM', severity: 'INFO', isRead: false, createdAt: '2026-10-11T01:00:00Z',
  actionUrl: '/salon/promotions', branchId: 'branch', businessId: 'tenant' });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const evidence = [];
  try {
    for (const width of [375, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
      await context.routeWebSocket('**', socket => socket.close());
      const page = await context.newPage();
      const errors = [], stale = [], heldReads = [], heldAccount = [], apiCalls = [];
      let remaining = 21, reads = 0, holdOldAccount = false;
      page.on('pageerror', error => errors.push(error.message));
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin === 'http://127.0.0.1:5176' && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/socket.io')) {
          return route.continue();
        }
        apiCalls.push({ method: request.method(), path: url.pathname });
        const fulfill = body => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
        if (url.pathname === '/api/v1/auth/refresh') return fulfill(session('A'));
        if (url.pathname === '/api/v1/notifications/unread-count') return fulfill({ count: remaining });
        if (url.pathname === '/api/v1/notifications/read-all') { remaining = 0; return fulfill({ count: 20 }); }
        if (/\/api\/v1\/notifications\/[^/]+\/read$/.test(url.pathname)) {
          reads++; heldReads.push({ fulfill }); return;
        }
        if (url.pathname === '/api/v1/notifications') {
          const account = request.headers().authorization;
          const requestedPage = Number(url.searchParams.get('page') || 1);
          if (account === 'Bearer mock-B') return fulfill({ data: [row('account-B')], pagination: { page: 1, total: 1, totalPages: 1 } });
          if (holdOldAccount) { heldAccount.push({ fulfill }); return; }
          if (url.searchParams.get('state') === 'all') { stale.push({ fulfill }); return; }
          const total = remaining;
          const data = remaining === 0 ? [] : requestedPage === 2 ? (remaining === 21 ? [row('last')] : [])
            : Array.from({ length: Math.min(20, remaining) }, (_, index) => row(index + 1));
          return fulfill({ data, pagination: { page: requestedPage, total, totalPages: Math.ceil(total / 20) } });
        }
        // Unplanned backend calls are mocked as well; never forward transport.
        if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) errors.push(`Unplanned mocked write: ${request.method()} ${url.pathname}`);
        return fulfill([]);
      });
      await page.goto('http://127.0.0.1:5176/salon/notifications', { waitUntil: 'domcontentloaded' });
      await expect.poll(() => stale.length).toBeGreaterThan(0);
      await page.getByRole('combobox', { name: 'Lọc trạng thái' }).click();
      await page.getByRole('option', { name: 'Chưa đọc', exact: true }).click();
      await expect(page.getByRole('button', { name: /Notification 1 / })).toBeVisible();
      for (const request of stale) await request.fulfill({ data: [row('stale')], pagination: { page: 1, total: 99, totalPages: 5 } });
      await expect(page.getByText('Notification stale', { exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: /Trang sau/ }).click();
      const last = page.getByRole('button', { name: /Notification last/ });
      await expect(last).toBeVisible();
      // Two synchronous attempts use the same captured row, reproducing the
      // original handler race without depending on mouse timing.
      await last.evaluate(button => { button.click(); button.click(); });
      await expect.poll(() => reads).toBe(1);
      await expect(page.getByRole('button', { name: 'Xem nội dung liên quan' })).toHaveCount(0);
      await page.screenshot({ path: path.join(output, `pending-denied-link-${width}.png`), fullPage: true });
      await page.getByRole('dialog').getByRole('button', { name: 'Đóng', exact: true }).last().click();
      await expect(last).toBeDisabled();
      remaining = 20; await heldReads[0].fulfill({ isRead: true });
      await expect(page.getByText(/Trang 1 \/ 1/)).toBeVisible();
      await expect(page.getByText(/Hiển thị 20 \/ 20/)).toBeVisible();
      await page.screenshot({ path: path.join(output, `bounded-unread-${width}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Đọc tất cả' }).click();
      await expect(page.getByText('Không có thông báo', { exact: true })).toBeVisible();
      await expect(page.getByText('Bạn đã đọc tất cả thông báo.', { exact: true })).toBeVisible();
      holdOldAccount = true;
      await page.getByRole('combobox', { name: 'Lọc trạng thái' }).click();
      await page.getByRole('option', { name: 'Tất cả trạng thái', exact: true }).click();
      await expect.poll(() => heldAccount.length).toBeGreaterThan(0);
      await page.evaluate(async next => {
        const { useAuthStore } = await import('/src/store/authStore.js');
        useAuthStore.getState().setSession(next);
      }, session('B'));
      await expect(page.getByText('Notification account-B', { exact: true })).toBeVisible();
      for (const request of heldAccount) await request.fulfill({ data: [row('private-A')], pagination: { page: 1, total: 1, totalPages: 1 } });
      await expect(page.getByText('Notification private-A', { exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(errors).toEqual([]);
      await page.screenshot({ path: path.join(output, `session-fence-${width}.png`), fullPage: true });
      evidence.push({ width, status: 'PASS', reads, errors, apiCalls,
        assertions: ['late list fenced', 'duplicate read locked', 'forbidden related link hidden', 'last unread page bounded', 'mark all reconciled', 'account response fenced', 'no horizontal overflow'] });
      await context.close();
    }
  } catch (error) {
    evidence.push({ status: 'FAIL', message: error.stack });
    throw error;
  } finally {
    fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
    console.log(output, evidence.map(result => ({ width: result.width, status: result.status })));
    await Promise.race([browser.close(), new Promise(resolve => setTimeout(resolve, 3000))]);
  }
})().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
