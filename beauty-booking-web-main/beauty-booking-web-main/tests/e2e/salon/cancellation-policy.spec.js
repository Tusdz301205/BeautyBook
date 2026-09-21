import { test, expect } from '../fixtures/test.js';
import { credentialsFor, mutationGate } from '../helpers/environment.js';
import { loginViaUi } from '../helpers/login.js';

test('@critical no-show requires explicit confirmation and updates without refresh', async ({ page }) => {
  const salon = credentialsFor('businessOwner');
  const bookingId = process.env.PW_NO_SHOW_BOOKING_ID;
  test.skip(!mutationGate() || !salon || !bookingId, 'Requires isolated test-copy no-show booking');
  // Mutating policy verification is restricted to the dedicated test server.
  expect(['http://localhost:3101/api/v1', 'http://localhost:3102/api/v1']).toContain(process.env.PW_API_BASE_URL);
  if (process.env.PW_API_BASE_URL === 'http://localhost:3102/api/v1') {
    expect(process.env.PW_TEST_DATABASE_NAME).toMatch(/^beautybook_test_restriction_\d+$/);
  }
  await loginViaUi(page, salon);
  await page.goto(`/salon/appointments?bookingId=${bookingId}`);
  await expect(page.getByText('Chi tiết lịch hẹn', { exact: true })).toBeVisible();
  await expect(page.getByText(`TEST-CANCEL-${bookingId}`, { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Ghi nhận khách không đến', exact: true }).click();
  const confirmation = page.getByRole('button', { name: 'Xác nhận không đến', exact: true });
  await expect(confirmation).toBeDisabled();
  await page.getByRole('checkbox', { name: /Tôi đã kiểm tra/ }).check();
  await expect(confirmation).toBeEnabled();
  const update = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().endsWith(`/bookings/${bookingId}/status`));
  await confirmation.click();
  expect((await update).status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Ghi nhận khách không đến', exact: true })).toHaveCount(0);
  await expect(page.getByText('Đã ghi nhận khách không đến', { exact: true })).toBeVisible();
  await expect(page.getByText('Không đến', { exact: true }).first()).toBeVisible();
});

test('@critical customer sees pending cancellation instead of a successful cancellation', async ({ page }) => {
  const customer = credentialsFor('customer');
  const bookingId = process.env.PW_PENDING_CANCEL_BOOKING_ID;
  test.skip(!customer || !bookingId, 'Requires isolated pending cancellation booking');
  await loginViaUi(page, customer);
  await page.goto(`/customer/appointments/${bookingId}`);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByText('Đã gửi yêu cầu thay đổi, đang chờ cơ sở xử lý. Lịch hẹn hiện tại chưa thay đổi.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Hủy lịch$|^Yêu cầu hủy sát giờ$/ })).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('01/01/1970');
});
