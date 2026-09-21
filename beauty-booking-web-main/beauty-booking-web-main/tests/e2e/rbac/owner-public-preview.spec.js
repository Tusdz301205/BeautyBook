import { readFileSync } from 'node:fs';
import { test, expect } from '../fixtures/test.js';
import { credentialsFor } from '../helpers/environment.js';
import { loginViaUi } from '../helpers/login.js';

test('@rbac owner public and preview views never act as a customer', async ({ page }) => {
  const credential = credentialsFor('businessOwner');
  const path = process.env.PW_RESTRICTION_FIXTURE;
  test.skip(!credential || !path, 'Requires own branch fixture and owner credentials');
  const fixture = JSON.parse(readFileSync(path, 'utf8'));
  await loginViaUi(page, credential);
  const customerCalls = [];
  page.on('request', request => {
    if (/\/(saved-services|loyalty\/mine|bookings\/my-appointments)(?:[/?]|$)/.test(request.url())) customerCalls.push(request.url());
  });
  for (const preview of [false, true]) {
    const route = preview ? `/salon/branches/${fixture.branchId}/preview` : `/explore/branches/${fixture.branchId}`;
    await page.goto(route);
    await expect(page.locator('article.bb-detail-document')).toBeVisible();
    if (preview) await expect(page.getByText('Chế độ xem trước', { exact: true })).toBeVisible();
    const booking = page.getByRole('link', { name: 'Chọn dịch vụ', exact: true });
    await booking.click();
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await expect(page.getByText(preview ? 'Chế độ xem trước không thực hiện thao tác khách hàng.' : /tài khoản khách hàng/i).last()).toBeVisible();
  }
  expect(customerCalls).toEqual([]);
});
