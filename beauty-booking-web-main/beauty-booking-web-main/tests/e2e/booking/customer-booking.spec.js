import { test, expect } from '../fixtures/test.js';
import { credentialsFor, mutationGate } from '../helpers/environment.js';
import { loginViaUi } from '../helpers/login.js';

const branchId = process.env.PW_BOOKING_BRANCH_ID;
const serviceId = process.env.PW_BOOKING_SERVICE_ID;
const staffId = process.env.PW_BOOKING_STAFF_ID;
const staffName = process.env.PW_BOOKING_STAFF_NAME;
const phone = process.env.PW_CUSTOMER_PHONE;

async function chooseFirstLiveSlot(page) {
  const dateButtons = page.getByRole('button', { name: /tháng \d+/i });
  const timeButtons = page.getByRole('button', { name: /^\d{2}:\d{2}$/ });
  const empty = page.getByText('Ngày này đã kín lịch');

  for (let index = 0; index < await dateButtons.count(); index += 1) {
    await dateButtons.nth(index).click();
    await Promise.race([
      timeButtons.first().waitFor({ state: 'visible' }),
      empty.waitFor({ state: 'visible' }),
    ]);
    if (await timeButtons.count()) {
      await timeButtons.first().click();
      return true;
    }
  }
  return false;
}

async function selectConfiguredBooking(page, specificStaff) {
  await page.goto(`/book?branchId=${encodeURIComponent(branchId)}&serviceId=${encodeURIComponent(serviceId)}`);
  await expect(page.getByRole('heading', { name: 'Chọn chi nhánh và dịch vụ' })).toBeVisible();
  await expect(page.getByRole('button', { pressed: true })).toHaveCount(2);

  const variantSelects = page.getByRole('combobox');
  for (let index = 0; index < await variantSelects.count(); index += 1) {
    const select = variantSelects.nth(index);
    const enabledOptions = select.locator('option:not([disabled])');
    if (await enabledOptions.count() > 1) {
      const value = await enabledOptions.nth(1).getAttribute('value');
      if (value) await select.selectOption(value);
    }
  }

  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await expect(page.getByRole('heading', { name: 'Chọn chuyên viên' })).toBeVisible();
  if (specificStaff) {
    const configured = staffName
      ? page.getByRole('button', { name: new RegExp(staffName, 'i') })
      : page.getByRole('button').filter({ hasNotText: 'Bất kỳ chuyên viên phù hợp' }).filter({ hasText: /Chuyên viên|⭐|\(\d+\)/ }).first();
    await expect(configured, 'Configured staff must be active, skilled and public').toBeVisible();
    await configured.click();
  } else {
    await page.getByRole('button', { name: /Bất kỳ chuyên viên phù hợp/i }).click();
  }
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await expect(page.getByRole('heading', { name: 'Chọn ngày và khung giờ' })).toBeVisible();

  const hasSlot = await chooseFirstLiveSlot(page);
  test.skip(!hasSlot, 'No live slot is available in the next seven days');
  await page.getByRole('button', { name: 'Tiếp tục' }).click();

  await page.getByLabel('Số điện thoại').fill(phone);
  await page.getByLabel(/Tôi đồng ý để BeautyBook xử lý thông tin liên hệ/i).check();
  await page.getByRole('button', { name: 'Xem lại và xác nhận' }).click();
  await expect(page.getByRole('heading', { name: 'Kiểm tra và xác nhận' })).toBeVisible();
}

async function confirmWithoutDuplicate(page) {
  const responses = [];
  page.on('response', (response) => {
    if (response.request().method() === 'POST' && /\/api\/v1\/bookings$/.test(new URL(response.url()).pathname)) {
      responses.push(response);
    }
  });

  const confirm = page.getByRole('button', { name: 'Xác nhận đặt lịch' });
  await expect(confirm).toBeEnabled();
  await Promise.allSettled([
    confirm.dispatchEvent('click'),
    confirm.dispatchEvent('click'),
  ]);
  await page.waitForURL(/\/book\/success$/);
  await expect(page.getByRole('heading', { name: /Đặt lịch thành công|Đã gửi yêu cầu đặt lịch/ })).toBeVisible();

  const successful = responses.filter((response) => response.ok());
  expect(successful.length).toBeGreaterThanOrEqual(1);
  expect(responses.every((response) => response.status() < 500)).toBeTruthy();
  const bookings = await Promise.all(successful.map((response) => response.json()));
  expect(new Set(bookings.map((booking) => booking.id)).size).toBe(1);
  return bookings[0];
}

test('@critical customer creates one booking with a specific qualified staff member', async ({ page }) => {
  const customer = credentialsFor('bookingCustomer') || credentialsFor('customer');
  test.skip(!mutationGate(), 'Set PW_RUN_MUTATING_E2E=1 only for an isolated test database');
  test.skip(!customer || !branchId || !serviceId || !staffId || !phone, 'Missing prepared booking fixture environment');
  test.slow();

  await loginViaUi(page, customer);
  await selectConfiguredBooking(page, true);
  const booking = await confirmWithoutDuplicate(page);

  expect(booking.branch?.id).toBe(branchId);
  expect(booking.bookingCode).toMatch(/^BB-/);
  expect(new Date(booking.appointmentDate || booking.startAt).getUTCFullYear()).toBeGreaterThan(2000);
  const bookingServices = booking.bookingServices || booking.services || [];
  expect(bookingServices.some((item) => (item.service?.id || item.serviceId) === serviceId)).toBeTruthy();
  expect(bookingServices.some((item) => (item.staff?.id || item.staffId) === staffId)).toBeTruthy();
  await expect(page.getByText(booking.bookingCode)).toBeVisible();
});

test('@critical customer can book with any suitable staff without an epoch date', async ({ page }) => {
  const customer = credentialsFor('bookingCustomer') || credentialsFor('customer');
  test.skip(!mutationGate(), 'Set PW_RUN_MUTATING_E2E=1 only for an isolated test database');
  test.skip(!customer || !branchId || !serviceId || !phone, 'Missing prepared booking fixture environment');
  test.slow();

  await loginViaUi(page, customer);
  await selectConfiguredBooking(page, false);
  const booking = await confirmWithoutDuplicate(page);
  expect(booking.bookingCode).toMatch(/^BB-/);

  await page.getByRole('link', { name: 'Xem lịch hẹn' }).click();
  await expect(page.locator('body')).toContainText(booking.bookingCode);
  await expect(page.locator('body')).not.toContainText('01/01/1970');
});

test('@critical prepared booking rule violations return explicit 4xx responses', async ({ request }) => {
  const customer = credentialsFor('bookingCustomer') || credentialsFor('customer');
  const rawCases = process.env.PW_BOOKING_NEGATIVE_CASES_JSON;
  test.skip(!mutationGate() || !customer || !rawCases, 'Provide isolated negative booking fixtures');
  const cases = JSON.parse(rawCases);

  const login = await request.post('/api/v1/auth/login', { data: { email: customer.email, password: customer.password } });
  expect(login.ok()).toBeTruthy();
  const { accessToken } = await login.json();
  for (const item of cases) {
    const response = await request.post('/api/v1/bookings', {
      headers: { Authorization: `Bearer ${accessToken}`, 'Idempotency-Key': crypto.randomUUID() },
      data: item.payload,
    });
    expect(response.status(), item.name).toBe(item.expectedStatus);
    expect(response.status(), item.name).toBeLessThan(500);
  }
});
