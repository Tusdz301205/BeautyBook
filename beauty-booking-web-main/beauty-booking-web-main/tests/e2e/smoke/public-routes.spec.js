import { test, expect } from '../fixtures/test.js';
import { apiBaseURL } from '../helpers/environment.js';

const publicRoutes = [
  ['/', /Tìm dịch vụ làm đẹp hợp với bạn/i],
  ['/explore', /Tìm đúng dịch vụ/i],
  ['/login', /Đăng nhập BeautyBook/i],
  ['/register', /tạo tài khoản/i],
  ['/for-business', /Một nơi để vận hành cơ sở làm đẹp/i],
];

test('@smoke API health is ready', async ({ request }) => {
  const response = await request.get(`${apiBaseURL}/health/ready`);
  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toMatchObject({ status: 'ready', database: 'up' });
});

for (const [route, heading] of publicRoutes) {
  test(`@smoke public route ${route} renders without fatal runtime errors`, async ({ page }) => {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
    const text = (await page.locator('body').innerText()).trim();
    expect(text.length).toBeGreaterThan(40);
  });
}

test('@smoke signed-out booking entry redirects once to login', async ({ page }) => {
  await page.goto('/book');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Đăng nhập BeautyBook' })).toBeVisible();
});

test('@smoke unknown public route has a real not-found screen', async ({ page }) => {
  await page.goto('/pw-e2e-route-that-does-not-exist');
  await expect(page.locator('body')).toContainText(/không tìm thấy|404/i);
  await expect(page.locator('body')).not.toBeEmpty();
});
