import { readFileSync } from 'node:fs';
import { test, expect } from '../fixtures/test.js';
import { loginViaUi } from '../helpers/login.js';

const fixturePath = process.env.PW_RESTRICTION_FIXTURE;
const fixture = fixturePath ? JSON.parse(readFileSync(fixturePath, 'utf8')) : null;
const api = process.env.PW_API_BASE_URL;
test.beforeEach(() => {
  test.skip(!fixture || process.env.PW_RUN_MUTATING_E2E !== '1', 'Requires dedicated fresh restriction copy fixtures');
  expect(fixture.testDatabase).toMatch(/^beautybook_test_restriction_\d+$/);
  expect(api).toBe('http://localhost:3102/api/v1');
});

async function confirmPage(page) {
  let payload;
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith('/bookings/preview-price')) payload = request.postDataJSON();
  });
  await page.goto(`/book?branchId=${fixture.branchId}&serviceId=${fixture.serviceId}`);
  await expect(page.getByRole('heading', { name: 'Chọn chi nhánh và dịch vụ' })).toBeVisible();
  await expect(page.getByRole('button', { pressed: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(fixture.staffName) }).click();
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  const dates = page.getByRole('button', { name: /tháng \d+/i });
  const times = page.getByRole('button', { name: /^\d{2}:\d{2}$/ });
  await expect(dates.first()).toBeVisible();
  let found = false;
  for (let i = 1; i < await dates.count(); i++) {
    await dates.nth(i).click();
    await expect.poll(async () => await times.count() || await page.getByText('Ngày này đã kín lịch').count()).toBeGreaterThan(0);
    if (await times.count()) { await times.first().click(); found = true; break; }
  }
  expect(found, 'Prepared branch must have a future live slot; do not silently skip').toBe(true);
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await page.getByLabel('Số điện thoại').fill('0901234567');
  await page.getByLabel(/Tôi đồng ý để BeautyBook xử lý thông tin liên hệ/i).check();
  await page.getByRole('button', { name: 'Xem lại và xác nhận' }).click();
  await expect(page.getByRole('heading', { name: 'Kiểm tra và xác nhận' })).toBeVisible();
  await expect(page.getByTestId('booking-policy-notice')).toBeVisible();
  await expect.poll(() => Boolean(payload)).toBe(true);
  return { branchId: fixture.branchId, serviceIds: [fixture.serviceId], staffId: fixture.staffId,
    appointmentDate: payload.appointmentDate, source: 'ONLINE_WEB' };
}
async function create(request, token, payload, path = '/bookings') {
  return request.post(`${api}${path}`, { headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': crypto.randomUUID() }, data: payload });
}
for (const score of [2, 3, 4]) {
  test(`@critical real policy ${score} points controls confirmation and API`, async ({ page, request }) => {
    test.slow();
    const session = await loginViaUi(page, { email: fixture.customers[score].email, password: 'Password123!' });
    const payload = await confirmPage(page);
    const submit = page.getByRole('button', { name: 'Xác nhận đặt lịch', exact: true });
    await expect(page.getByTestId('booking-policy-notice')).toContainText(`${score} điểm`);
    if (score === 2) {
      await expect(page.getByRole('checkbox', { name: 'Tôi hiểu và tiếp tục đặt lịch' })).toHaveCount(0);
      await expect(submit).toBeEnabled();
      await submit.click(); await expect(page).toHaveURL(/\/book\/success$/);
    } else if (score === 3) {
      await expect(submit).toBeDisabled();
      const denied = await create(request, session.accessToken, payload);
      expect(denied.status()).toBe(409);
      expect(await denied.json()).toMatchObject({ code: 'BOOKING_WARNING_ACK_REQUIRED' });
      const invalid = await create(request, session.accessToken, { ...payload, violationAcknowledged: 'true' });
      expect(invalid.status()).toBe(400);
      await page.getByRole('checkbox', { name: 'Tôi hiểu và tiếp tục đặt lịch' }).check();
      await expect(submit).toBeEnabled(); await submit.click(); await expect(page).toHaveURL(/\/book\/success$/);
    } else {
      await expect(submit).toBeDisabled();
      await expect(page.getByTestId('booking-policy-notice')).toContainText('Hạn chế tự đặt lịch đến');
      for (const source of ['ONLINE_WEB', 'STAFF_CREATED']) {
        const denied = await create(request, session.accessToken, { ...payload, source, violationAcknowledged: true });
        expect(denied.status()).toBe(403);
        expect(await denied.json()).toMatchObject({ code: 'SELF_BOOKING_RESTRICTED' });
      }
      const legacy = await create(request, session.accessToken, { branchId: payload.branchId, serviceIds: payload.serviceIds,
        staffId: payload.staffId, appointmentDate: payload.appointmentDate, guestName: 'Policy test', guestPhone: '0901234567', violationAcknowledged: true }, '/bookings/guest');
      expect(legacy.status()).toBe(403);
      const recurring = await create(request, session.accessToken, { branchId: payload.branchId, serviceIds: payload.serviceIds,
        staffId: payload.staffId, staffMode: 'SAME_STAFF', frequency: 'WEEKLY', startDate: payload.appointmentDate.slice(0,10),
        preferredTime: new Date(payload.appointmentDate).toLocaleTimeString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }),
        occurrenceCount: 2, skipConflicts: true, violationAcknowledged: true }, '/recurring');
      expect(recurring.status(), await recurring.text()).toBe(403);
      expect(await recurring.json()).toMatchObject({ code: 'SELF_BOOKING_RESTRICTED' });
      const ownerLogin = await request.post(`${api}/auth/login`, { data: { email: 'lananh.owner@glowbook.vn', password: 'Password123!' } });
      expect(ownerLogin.ok()).toBe(true);
      const owner = await ownerLogin.json();
      const assisted = await create(request, owner.accessToken, { ...payload, customerId: fixture.customers[4].customerId, source: 'STAFF_CREATED' });
      expect(assisted.status(), await assisted.text()).toBe(201);
      expect(await assisted.json()).toMatchObject({ customerId: fixture.customers[4].customerId, source: 'STAFF_CREATED' });
      // Select another real slot after the owner's reservation and repeat as
      // the branch's receptionist; neither flow needs customer acknowledgment.
      const next = await confirmPage(page);
      const receptionLogin = await request.post(`${api}/auth/login`, { data: { email: 'reception@glowbook.vn', password: 'Password123!' } });
      expect(receptionLogin.ok()).toBe(true);
      const reception = await receptionLogin.json();
      const receptionBooking = await create(request, reception.accessToken, { ...next, customerId: fixture.customers[4].customerId, source: 'PHONE' });
      expect(receptionBooking.status(), await receptionBooking.text()).toBe(201);
      expect(await receptionBooking.json()).toMatchObject({ customerId: fixture.customers[4].customerId, source: 'PHONE' });
    }
  });
}
test('@critical newly activated restriction refreshes confirmation without redirecting to slot conflict', async ({ page, request }) => {
  test.slow();
  expect(fixture.raceNoShowBookingId).toBeTruthy();
  await loginViaUi(page, { email: fixture.customers[3].email, password: 'Password123!' });
  await confirmPage(page);
  await page.getByRole('checkbox', { name: 'Tôi hiểu và tiếp tục đặt lịch' }).check();
  const submit = page.getByRole('button', { name: 'Xác nhận đặt lịch', exact: true });
  await expect(submit).toBeEnabled();
  const login = await request.post(`${api}/auth/login`, { data: { email: 'lananh.owner@glowbook.vn', password: 'Password123!' } });
  const owner = await login.json();
  const changed = await request.patch(`${api}/bookings/${fixture.raceNoShowBookingId}/status`, {
    headers: { Authorization: `Bearer ${owner.accessToken}` }, data: { status: 'NO_SHOW', noShowConfirmed: true } });
  expect(changed.status(), await changed.text()).toBe(200);
  const denied = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/bookings'));
  await submit.click(); expect((await denied).status()).toBe(403);
  await expect(page).toHaveURL(/\/book\/confirm$/);
  await expect(page.getByTestId('booking-policy-notice')).toContainText('Hạn chế tự đặt lịch đến');
  await expect(submit).toBeDisabled();
});
