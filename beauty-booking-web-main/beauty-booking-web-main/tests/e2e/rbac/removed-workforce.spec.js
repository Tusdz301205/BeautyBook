import { test, expect } from '../fixtures/test.js';
import { apiBaseURL, credentialsFor } from '../helpers/environment.js';
import { loginViaUi } from '../helpers/login.js';

const oldUiRoutes = [
  '/salon/attendance',
  '/salon/attendance/qr',
  '/salon/workforce',
  '/salon/staff/schedule',
  '/salon/shifts',
  '/salon/leave',
  '/salon/timesheets',
  '/salon/payroll',
  '/salon/payruns',
  '/salon/compensation',
];

const oldApiRoots = [
  '/attendance',
  '/workforce',
  '/shifts',
  '/leave',
  '/timesheets',
  '/payroll',
  '/payruns',
  '/compensation',
];

test('@rbac removed HR API roots return 404 rather than crash', async ({ request }) => {
  for (const path of oldApiRoots) {
    const response = await request.get(`${apiBaseURL}${path}`);
    expect(response.status(), `${path} should remain removed`).toBe(404);
  }
});

test('@rbac removed HR routes never render for an authenticated salon user', async ({ page }) => {
  const credential = credentialsFor('branchManager') || credentialsFor('businessOwner') || credentialsFor('staff');
  test.skip(!credential, 'Set a salon role credential');
  const requestedHrApis = [];
  page.on('request', (request) => {
    if (oldApiRoots.some((root) => new URL(request.url()).pathname.includes(`/api/v1${root}`))) {
      requestedHrApis.push(request.url());
    }
  });

  await loginViaUi(page, credential);
  const navigation = page.getByRole('complementary', { name: 'Điều hướng chính' });
  await expect(navigation).not.toContainText(/chấm công|attendance|workforce|phân ca|lịch làm việc|nghỉ phép|timesheet|payroll|payrun|compensation/i);

  for (const route of oldUiRoutes) {
    await page.goto(route);
    await expect(page).not.toHaveURL(new RegExp(`${route.replaceAll('/', '\\/')}$`));
    await expect(page.locator('body')).not.toContainText(/quản lý chấm công|bảng lương|quản lý ca làm việc/i);
  }
  expect(requestedHrApis).toEqual([]);
});

test('@rbac staff-facing salon navigation keeps booking and account surfaces', async ({ page }) => {
  const credential = credentialsFor('staff');
  test.skip(!credential, 'Set staff E2E credentials');
  await loginViaUi(page, credential);
  const navigation = page.getByRole('complementary', { name: 'Điều hướng chính' });
  await expect(navigation).toContainText('Lịch hẹn của tôi');
  await expect(navigation).toContainText('Tài khoản');
});
