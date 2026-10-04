import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

test('@critical owner registration, real PDF upload, resume, review and resubmit on an isolated local database', async ({ page, browser, request }) => {
  test.skip(process.env.PW_REAL_ONBOARDING !== '1', 'Requires the dedicated onboarding-review-server fixture');
  test.setTimeout(180_000);
  const output = resolve('../../report-output/business-owner-registration');
  const fixture = JSON.parse(readFileSync(resolve(output, 'local-fixture.json'), 'utf8'));
  expect(fixture.database).toMatch(/^beautybook_test_onboarding_\d+$/);
  expect(fixture.api).toBe('http://localhost:3011/api/v1');
  expect(fixture.smtpDisabled).toBe(true);
  expect(process.env.PW_BASE_URL).toBe(fixture.web);
  mkdirSync(output, { recursive: true });
  const requireApi = createRequire(resolve('../../beauty-booking-api-main/package.json'));
  const pg = requireApi('pg');
  const dotenv = requireApi('dotenv');
  const bcrypt = requireApi('bcryptjs');
  const environment = dotenv.parse(readFileSync(resolve('../../beauty-booking-api-main/.env')));
  const dbUrl = new URL(environment.DATABASE_URL);
  expect(['localhost', '127.0.0.1']).toContain(dbUrl.hostname);
  dbUrl.pathname = `/${fixture.database}`;
  const db = new pg.Client({ connectionString: dbUrl.toString() }); await db.connect();
  const checks = [];
  const run = Date.now();
  const email = `owner-${run}@example.test`;
  const phone = `09${String(run).slice(-8)}`;
  const password = 'BeautyBook123';
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const call = async (path, token, method = 'GET', data) => request.fetch(`${fixture.api}${path}`, {
    method, data, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Idempotency-Key': randomUUID() },
  });
  try {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto('/register/business');
    await expect(page.getByRole('radio', { name: /Chủ doanh nghiệp/ })).toBeChecked();
    await page.locator('#register-fullName').fill('Chủ doanh nghiệp thử nghiệm');
    await page.locator('#register-email').fill(email);
    await page.locator('#register-phone').fill(phone);
    await page.locator('#register-password').fill(password);
    await page.locator('#register-confirmPassword').fill(password);
    await page.locator('label[for="register-terms"]').click();
    await page.screenshot({ path: resolve(output, 'register-owner-mobile.png'), fullPage: true, animations: 'disabled' });
    const registered = page.waitForResponse((response) => response.url().endsWith('/auth/register') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
    const registration = await registered; expect(registration.status()).toBe(201);
    const owner = await registration.json();
    expect(owner.user.roles).toEqual(['BUSINESS_OWNER']);
    const token = owner.accessToken;
    await expect(page.getByRole('heading', { name: 'Đăng ký BeautyBook Business' })).toBeVisible();
    let mine = await (await call('/business/onboarding/mine', token)).json();
    expect(mine.status).toBe('DRAFT'); expect(mine.branches).toHaveLength(0);
    expect(mine.checklist.find((row) => row.key === 'business').completed).toBe(false);
    const businessId = mine.id;
    const initialSubmit = await call(`/business/${businessId}/submit`, token, 'POST');
    expect(initialSubmit.status()).toBe(400);
    checks.push('Real owner registration creates only a DRAFT business; internal draft name cannot be submitted.');

    const config = await (await call('/business/onboarding/config', token)).json();
    expect(config.requiredDocuments).toEqual(['BUSINESS_LICENSE', 'OWNER_ID_CARD']);
    for (const type of config.businessTypes) await expect(page.getByRole('button', { name: type.label, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Spa', exact: true }).click();
    await page.getByRole('button', { name: /Lưu và tiếp tục/ }).click();
    await expect(page.locator('#onboarding-name')).toHaveValue('');
    await page.getByRole('button', { name: /Lưu và tiếp tục/ }).click();
    await expect(page.locator('#onboarding-name')).toHaveAttribute('aria-invalid', 'true');
    const fields = { name: 'Thương hiệu thử nghiệm', slug: `qa-${run}`, companyName: 'Pháp nhân thử nghiệm', taxCode: `TEST-${run}`,
      contactPhone: phone, addressLine: 'Địa chỉ thử nghiệm', legalRepresentative: 'Người đại diện thử nghiệm' };
    for (const [key, value] of Object.entries(fields)) await page.locator(`#onboarding-${key}`).fill(value);
    await page.getByRole('button', { name: /Lưu và tiếp tục/ }).click();
    await expect(page.getByText('Bước 3/4')).toBeVisible();
    await page.getByRole('button', { name: /Lưu và tiếp tục/ }).click();
    await expect(page.getByText('Bước 3/4')).toBeVisible();
    await expect(page.getByText('Hoàn thiện các mục sau:')).toBeVisible();
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 0 /Kids [] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
    const uploadedIds = [];
    for (const [index, type] of ['BUSINESS_LICENSE', 'OWNER_ID_CARD'].entries()) {
      if (index) {
        await page.getByRole('button', { name: 'Thêm tài liệu' }).click();
        await page.getByRole('combobox', { name: /Loại tài liệu/ }).nth(index).click();
        await page.getByRole('option', { name: 'CCCD người đại diện', exact: true }).click();
      }
      const uploaded = page.waitForResponse((response) => response.url().endsWith('/media/upload') && response.request().method() === 'POST');
      await page.locator('input[type="file"]').nth(index).setInputFiles({ name: `qa-${type.toLowerCase()}.pdf`, mimeType: 'application/pdf', buffer: pdf });
      const result = await uploaded; expect(result.status()).toBe(201);
      const media = await result.json(); expect(media.visibility).toBe('PRIVATE'); uploadedIds.push(media.id);
      await expect(page.getByRole('button', { name: /Lưu & tiếp tục sau/ })).toBeEnabled();
    }
    await page.getByRole('button', { name: /Lưu và tiếp tục/ }).click();
    await expect(page.getByText('Bước 4/4')).toBeVisible();
    // Reload uses a real rotating refresh cookie and reads saved data back from PostgreSQL.
    await page.reload();
    await expect(page.getByText('Bước 4/4')).toBeVisible();
    await expect(page.getByText(fields.name, { exact: true })).toBeVisible();
    mine = await (await call('/business/onboarding/mine', token)).json();
    expect(mine.contactPhone).toBe(`+84${phone.slice(1)}`); expect(mine.owner.taxCode).toBe(fields.taxCode);
    expect(mine.legalDocuments).toHaveLength(2);
    for (const id of uploadedIds) {
      expect((await call(`/media/${id}/content`, token)).status()).toBe(200);
      expect((await call(`/media/public/${id}`)).status()).toBe(404);
    }
    checks.push('Real private PDF uploads, required-document validation, save and refresh-cookie reload preserve the latest database values.');
    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: resolve(output, `onboarding-review-${width}.png`), fullPage: true, animations: 'disabled' });
    }
    await page.getByRole('button', { name: /Gửi hồ sơ doanh nghiệp/ }).click();
    await expect(page.getByRole('heading', { name: 'Hồ sơ đang được xét duyệt' })).toBeVisible();
    mine = await (await call('/business/onboarding/mine', token)).json(); expect(mine.status).toBe('PENDING_REVIEW');
    expect(mine.branches).toHaveLength(0);

    // A fresh platform reviewer exists only inside this guarded QA database.
    const adminId = randomUUID(); const adminEmail = `reviewer-${run}@example.test`;
    await db.query('INSERT INTO users (id,email,password_hash,full_name,updated_at) VALUES ($1,$2,$3,$4,NOW())', [adminId, adminEmail, await bcrypt.hash(password, 12), 'Người duyệt thử nghiệm']);
    await db.query('INSERT INTO user_roles (id,user_id,role_id) SELECT $1,$2,id FROM roles WHERE code=$3', [randomUUID(), adminId, 'PLATFORM_ADMIN']);
    const adminLogin = await call('/auth/login', null, 'POST', { email: adminEmail, password, workspace: 'PLATFORM' });
    expect(adminLogin.status()).toBe(200); const admin = await adminLogin.json();
    const detail = await (await call(`/business/${businessId}/detail`, admin.accessToken)).json();
    expect(detail.businessTypeLabel).toBe('Spa');
    const queue = await (await call('/admin/compliance-queue', admin.accessToken)).json();
    expect(queue.pendingBusinesses.find((row) => row.id === businessId).businessTypeLabel).toBe('Spa');
    const reviewerContext = await browser.newContext(); const reviewerPage = await reviewerContext.newPage();
    await reviewerPage.goto(`${fixture.web}/login`);
    await reviewerPage.locator('#login-email').fill(adminEmail);
    await reviewerPage.locator('#login-password').fill(password);
    await reviewerPage.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(reviewerPage).toHaveURL(/\/admin$/);
    await reviewerPage.goto(`${fixture.web}/admin/businesses/${businessId}`);
    await reviewerPage.getByRole('button', { name: 'Hồ sơ đăng ký', exact: true }).click();
    await expect(reviewerPage.getByText('Spa', { exact: true })).toBeVisible();
    await expect(reviewerPage.getByText(fields.companyName, { exact: true })).toBeVisible();
    await expect(reviewerPage.getByText(fields.taxCode, { exact: true })).toBeVisible();
    await expect(reviewerPage.getByText('Giấy phép kinh doanh', { exact: true })).toBeVisible();
    await expect(reviewerPage.getByText('CCCD người đại diện', { exact: true })).toBeVisible();
    for (const width of [375, 1440]) {
      await reviewerPage.setViewportSize({ width, height: 900 });
      expect(await reviewerPage.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await reviewerPage.screenshot({ path: resolve(output, `admin-registration-${width}.png`), fullPage: true, animations: 'disabled' });
    }
    await reviewerContext.close();
    checks.push('Admin detail and review queue read the service-type label from the same backend catalog; legal identity fields render on mobile and desktop.');
    expect((await call(`/business/${businessId}/review`, admin.accessToken, 'PATCH', { decision: 'REQUEST_INFO', note: 'Bổ sung giới thiệu doanh nghiệp để thử luồng gửi lại.' })).status()).toBe(200);
    await page.reload();
    await expect(page.getByRole('button', { name: /Gửi hồ sơ doanh nghiệp/ })).toBeVisible();
    await page.getByRole('button', { name: /2. Thông tin pháp nhân/ }).click();
    await page.locator('#onboarding-description').fill('Đây là hồ sơ thử nghiệm riêng cho kiểm tra luồng gửi bổ sung.');
    await page.getByRole('button', { name: /Lưu và tiếp tục/ }).click();
    await expect(page.getByText('Bước 3/4')).toBeVisible();
    await page.getByRole('button', { name: /Lưu và tiếp tục/ }).click();
    await expect(page.getByText('Bước 4/4')).toBeVisible();
    await page.getByRole('button', { name: /Gửi hồ sơ doanh nghiệp/ }).click();
    await expect(page.getByRole('heading', { name: 'Hồ sơ đang được xét duyệt' })).toBeVisible();
    mine = await (await call('/business/onboarding/mine', token)).json();
    expect(mine.reviewEvents.some((row) => row.action === 'RESUBMIT')).toBe(true);
    expect((await call(`/business/${businessId}/review`, admin.accessToken, 'PATCH', { decision: 'APPROVE' })).status()).toBe(200);
    await page.reload();
    await expect(page).toHaveURL(/\/salon\/profile$/);
    await expect(page.getByRole('heading', { name: 'Hồ sơ doanh nghiệp & chi nhánh' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Chưa có chi nhánh' })).toBeVisible();
    expect((await call(`/business/${businessId}/submit`, token, 'POST')).status()).toBe(409);
    checks.push('PENDING_REVIEW → NEED_MORE_INFO → resubmit → APPROVED uses real review APIs and does not create/publicize a branch.');
    await page.setViewportSize({ width: 375, height: 900 });
    await page.screenshot({ path: resolve(output, 'onboarding-approved-mobile.png'), fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: resolve(output, 'onboarding-approved-desktop.png'), fullPage: true, animations: 'disabled' });

    const other = await (await call('/auth/register', null, 'POST', { accountType: 'BUSINESS_OWNER', email: `other-${run}@example.test`, fullName: 'Chủ tài khoản khác', password })).json();
    expect((await call(`/business/${businessId}/onboarding`, other.accessToken, 'PATCH', { description: 'Foreign update' })).status()).toBe(403);
    expect((await call(`/media/${uploadedIds[0]}/content`, other.accessToken)).status()).toBe(403);
    checks.push('Another owner cannot edit this business or read its private legal documents.');
    const customerContext = await browser.newContext(); const customerPage = await customerContext.newPage();
    await customerPage.goto(`${fixture.web}/register`);
    await customerPage.locator('#register-fullName').fill('Khách hàng thử nghiệm');
    await customerPage.locator('#register-email').fill(`customer-${run}@example.test`);
    await customerPage.locator('#register-password').fill(password);
    await customerPage.locator('#register-confirmPassword').fill(password);
    await customerPage.locator('label[for="register-terms"]').click();
    const customerRegistered = customerPage.waitForResponse((response) => response.url().endsWith('/auth/register') && response.request().method() === 'POST');
    await customerPage.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
    const customerResponse = await customerRegistered; expect(customerResponse.status()).toBe(201);
    const customer = await customerResponse.json(); expect(customer.user.roles).toEqual(['CUSTOMER']);
    await expect(customerPage).toHaveURL(/customer\/appointments/);
    expect((await db.query('SELECT count(*)::int count FROM business_owner_profiles WHERE user_id=$1', [customer.user.id])).rows[0].count).toBe(0);
    await customerContext.close();
    checks.push('Customer registration through the real form still creates only a customer account.');
    expect((await call('/auth/register', null, 'POST', { accountType: 'BUSINESS_OWNER', email, fullName: 'Trùng email thử nghiệm', password })).status()).toBe(409);
    expect((await call('/auth/register', null, 'POST', { accountType: 'CUSTOMER', email: `duplicate-phone-${run}@example.test`, phone, fullName: 'Trùng điện thoại thử nghiệm', password })).status()).toBe(409);
    checks.push('Real database uniqueness rejects duplicate email and normalized phone.');
    expect(errors).toEqual([]);
    const final = await (await call('/business/onboarding/mine', token)).json();
    expect(final.status).toBe('APPROVED'); expect(final.branches).toHaveLength(0);
    writeFileSync(resolve(output, 'real-api-results.json'), JSON.stringify({ checkedAt: new Date().toISOString(), database: fixture.database, businessId, status: final.status, privateDocuments: uploadedIds.length, branches: final.branches.length, checks, consolePageErrors: errors, smtpDisabled: true }, null, 2));
  } finally { await db.end(); }
});
