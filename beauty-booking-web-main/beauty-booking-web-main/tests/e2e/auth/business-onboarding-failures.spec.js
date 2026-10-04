import { test, expect } from '@playwright/test';

const recoveryKey = 'beautybook-business-onboarding-recovery-v2';
const completeDraft = {
  id: 'onboarding-review-fixture', name: 'Thương hiệu thử nghiệm', slug: 'thuong-hieu-thu-nghiem',
  contactEmail: 'owner@example.test', contactPhone: '+84912345678', addressLine: 'Địa chỉ thử nghiệm',
  legalRepresentative: 'Người đại diện thử nghiệm', description: '', status: 'DRAFT', onboardingStep: 4,
  onboardingData: { businessType: 'SPA', completedSteps: [1, 2, 3] }, legalDocuments: [], reviewEvents: [],
  owner: { companyName: 'Pháp nhân thử nghiệm', taxCode: 'TEST-ONLY', identityCardNumber: 'IDENTITY-TEST' },
};

async function fixture(page, options = {}) {
  let business = options.business === null ? null : structuredClone({ ...completeDraft, ...options.business });
  const state = { saves: 0, submits: 0, failRead: false, failSubmit: false };
  const json = (route, body, status = 200) => route.fulfill({ contentType: 'application/json', status, body: JSON.stringify(body) });
  await page.route('**/api/v1/auth/refresh', (route) => json(route, {
    accessToken: 'fixture-token', user: { id: 'review-owner', email: 'owner@example.test', fullName: 'Chủ thử',
      sessionType: 'salon', roles: ['BUSINESS_OWNER'], permissions: ['business:create:self', 'business:update:tenant'],
      scopes: [{ code: 'BUSINESS_OWNER', businessId: business?.id }] },
  }));
  await page.route('**/api/v1/business/onboarding/config', (route) => json(route, {
    businessTypes: [{ code: 'SPA', label: 'Spa' }], requiredDocuments: [], requirePhoneVerification: false,
    ...options.config,
  }));
  await page.route('**/api/v1/business/onboarding/mine', (route) => state.failRead
    ? json(route, { message: 'database internal exception' }, 503) : json(route, business));
  await page.route('**/api/v1/business/onboarding-review-fixture/onboarding', (route) => {
    state.saves += 1;
    const body = route.request().postDataJSON();
    business = { ...business, ...body, owner: { ...business.owner, companyName: body.companyName, taxCode: body.taxCode } };
    return json(route, business);
  });
  await page.route('**/api/v1/business/onboarding-review-fixture/submit', (route) => {
    state.submits += 1;
    if (state.failSubmit) return json(route, { message: 'internal failure' }, 503);
    business = { ...business, status: options.resultStatus || 'PENDING_REVIEW' };
    return json(route, business);
  });
  return state;
}

test('@smoke internal draft brand remains empty and blocks submission despite stale completed steps', async ({ page }) => {
  const state = await fixture(page, { business: { name: 'Hồ sơ cơ sở của Chủ thử', slug: 'draft-test' } });
  await page.goto('/salon/onboarding');
  await expect(page.getByText('25%', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Gửi hồ sơ doanh nghiệp/ }).click();
  await expect(page.locator('#onboarding-name')).toHaveValue('');
  await expect(page.locator('#onboarding-name')).toHaveAttribute('aria-invalid', 'true');
  expect(state.submits).toBe(0); expect(state.saves).toBe(0);
});

test('@smoke removing a completed required field invalidates progress and blocks sending', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/salon/onboarding');
  await expect(page.getByText('75%', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /2. Thông tin pháp nhân/ }).click();
  await page.locator('#onboarding-name').fill('');
  await expect(page.getByText('25%', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Lưu và tiếp tục/ }).click();
  await expect(page.locator('#onboarding-name')).toHaveAttribute('aria-invalid', 'true');
  expect(state.submits).toBe(0);
});

test('@smoke an uploaded document without its title is blocked instead of silently archived', async ({ page }) => {
  const state = await fixture(page, { business: { legalDocuments: [{ documentType: 'OTHER', documentName: '', mediaId: 'media-1' }] } });
  await page.goto('/salon/onboarding');
  await page.getByRole('button', { name: /Gửi hồ sơ doanh nghiệp/ }).click();
  await expect(page.getByText('Bước 3/4')).toBeVisible();
  await expect(page.locator('input[data-onboarding-field="documentDetails"]')).toHaveAttribute('aria-invalid', 'true');
  expect(state.submits).toBe(0); expect(state.saves).toBe(0);
});

test('@smoke submit failure keeps latest form and allows a retry', async ({ page }) => {
  const state = await fixture(page); state.failSubmit = true;
  await page.goto('/salon/onboarding');
  await page.getByRole('button', { name: /Gửi hồ sơ doanh nghiệp/ }).click();
  await expect(page.getByText(/Dữ liệu trên biểu mẫu vẫn được giữ lại/)).toBeVisible();
  await expect(page.getByText(completeDraft.name, { exact: true })).toBeVisible();
  expect(state.submits).toBe(1);
  state.failSubmit = false;
  await page.getByRole('button', { name: /Gửi hồ sơ doanh nghiệp/ }).click();
  await expect(page.getByRole('heading', { name: 'Hồ sơ đang được xét duyệt' })).toBeVisible();
  expect(state.submits).toBe(2);
});

test('@smoke successful submit with a failed status read cannot be submitted twice', async ({ page }) => {
  const state = await fixture(page, { resultStatus: 'APPROVED' });
  await page.goto('/salon/onboarding');
  state.failRead = true;
  await page.getByRole('button', { name: /Gửi hồ sơ doanh nghiệp/ }).click();
  await expect(page.getByRole('heading', { name: 'Hồ sơ đã gửi, đang chờ cập nhật trạng thái' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Gửi hồ sơ doanh nghiệp/ })).toHaveCount(0);
  expect(state.submits).toBe(1);
  state.failRead = false;
  await page.getByRole('button', { name: 'Tải lại trạng thái' }).click();
  await expect(page.getByRole('heading', { name: 'Hồ sơ đã được phê duyệt' })).toBeVisible();
  expect(state.submits).toBe(1);
});

test('@smoke legacy or another account recovery never populates a new owner draft', async ({ page }) => {
  await page.addInitScript(({ key }) => {
    const recovery = JSON.stringify({ identity: { name: 'Other account', taxCode: 'SECRET-TAX', identityCardNumber: 'SECRET-ID' }, draft: { businessType: 'SPA', completedSteps: [1, 2, 3] }, step: 4 });
    localStorage.setItem(key, recovery); localStorage.setItem(`${key}:other-account`, recovery);
  }, { key: recoveryKey });
  await fixture(page, { business: null });
  await page.goto('/salon/onboarding');
  await expect(page.getByText('Bước 1/4')).toBeVisible();
  await page.getByRole('button', { name: 'Spa', exact: true }).click();
  await page.getByRole('button', { name: /Lưu và tiếp tục/ }).click();
  await expect(page.locator('#onboarding-name')).toHaveValue('');
  await expect(page.locator('#onboarding-taxCode')).toHaveValue('');
  expect(await page.evaluate((key) => localStorage.getItem(key), recoveryKey)).toBeNull();
});

test('@smoke storage removal failure cannot turn a successful draft save into an error', async ({ page }) => {
  await page.addInitScript(() => {
    const remove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      if (String(key).startsWith('beautybook-business-onboarding-recovery')) throw new Error('Storage blocked');
      return remove.call(this, key);
    };
  });
  const state = await fixture(page);
  await page.goto('/salon/onboarding');
  await page.getByRole('button', { name: /Gửi hồ sơ doanh nghiệp/ }).click();
  await expect(page.getByRole('heading', { name: 'Hồ sơ đang được xét duyệt' })).toBeVisible();
  expect(state.submits).toBe(1);
});

test('@smoke phone verification policy blocks unverified accounts without pretending an OTP was sent', async ({ page }) => {
  const state = await fixture(page, { config: { requirePhoneVerification: true, phoneVerified: false } });
  await page.goto('/salon/onboarding');
  await page.getByRole('button', { name: /Gửi hồ sơ doanh nghiệp/ }).click();
  await expect(page.locator('#onboarding-contactPhone')).toHaveAttribute('aria-invalid', 'true');
  expect(state.submits).toBe(0);
});

test('@smoke rejected profile displays its actual decision instead of pending-review copy', async ({ page }) => {
  await fixture(page, { business: { status: 'REJECTED', reviewNote: 'Hồ sơ thử nghiệm không được duyệt.' } });
  await page.goto('/salon/onboarding');
  await expect(page.getByRole('heading', { name: 'Hồ sơ đã bị từ chối' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Gửi hồ sơ doanh nghiệp/ })).toHaveCount(0);
});
