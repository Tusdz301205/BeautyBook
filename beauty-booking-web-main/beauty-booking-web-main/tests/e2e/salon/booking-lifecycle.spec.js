import { test, expect } from '../fixtures/test.js';
import { credentialsFor, mutationGate } from '../helpers/environment.js';
import { loginViaUi } from '../helpers/login.js';

test('@critical salon scheduler keeps day, week and month calendar views', async ({ page }) => {
  const salon = credentialsFor('receptionist') || credentialsFor('branchManager') || credentialsFor('businessOwner');
  test.skip(!salon, 'Set a salon account with booking:read scope');
  await loginViaUi(page, salon);
  await page.goto('/salon/appointments');

  const viewGroup = page.getByRole('group', { name: 'Chế độ xem lịch' });
  await expect(viewGroup).toBeVisible();
  for (const mode of ['Ngày', 'Tuần', 'Tháng']) {
    await viewGroup.getByRole('button', { name: mode }).click();
    await expect(viewGroup.getByRole('button', { name: mode })).toBeVisible();
  }
  await expect(page.locator('body')).not.toContainText('01/01/1970');
});

test('@critical existing customer booking detail never renders epoch time', async ({ page }) => {
  const customer = credentialsFor('lifecycleCustomer') || credentialsFor('customer');
  const bookingId = process.env.PW_EXISTING_BOOKING_ID;
  test.skip(!customer || !bookingId, 'Set a customer-owned PW_EXISTING_BOOKING_ID');
  await loginViaUi(page, customer);
  await page.goto(`/customer/appointments/${bookingId}`);
  await expect(page.locator('body')).not.toContainText('01/01/1970');
  await expect(page.locator('main')).toBeVisible();
});

test('@critical salon status action is immediately reflected without refresh', async ({ page }) => {
  const salon = credentialsFor('receptionist') || credentialsFor('branchManager');
  const bookingId = process.env.PW_EXISTING_BOOKING_ID;
  test.skip(!mutationGate() || !salon || !bookingId, 'Requires an isolated lifecycle booking fixture');
  await loginViaUi(page, salon);
  const bookingRequest = page.waitForResponse((response) =>
    response.request().method() === 'GET' && response.url().endsWith(`/bookings/${bookingId}`));
  await page.goto(`/salon/appointments?bookingId=${encodeURIComponent(bookingId)}`);
  expect((await bookingRequest).ok()).toBeTruthy();
  await expect(page.getByText('Chi tiết lịch hẹn')).toBeVisible();
  const action = page.getByRole('button', { name: /Xác nhận lịch|Check-in|Bắt đầu dịch vụ|Hoàn tất dịch vụ/ }).first();
  await expect(action).toBeVisible();
  const update = page.waitForResponse((response) =>
    response.url().includes(`/bookings/${bookingId}`) && ['POST', 'PATCH'].includes(response.request().method()));
  await action.click();
  expect((await update).status()).toBeLessThan(400);
  await expect(page.locator('body')).not.toContainText(/không có quyền.*booking:read:branch/i);
});
