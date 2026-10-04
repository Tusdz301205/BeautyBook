import { test, expect } from '@playwright/test';

const initialBusiness = {
  id: 'business-onboarding-test',
  name: 'Hồ sơ cơ sở của Chủ thử',
  slug: 'draft-test',
  description: '',
  contactEmail: 'owner@example.test',
  contactPhone: '+84912345678',
  addressLine: '',
  legalRepresentative: null,
  status: 'DRAFT',
  onboardingStep: 1,
  onboardingData: {},
  legalDocuments: [],
  reviewEvents: [],
  owner: { companyName: null, taxCode: null, identityCardNumber: null },
};

test('@smoke failed latest draft save never submits an older draft id; success reloads server status', async ({ page }) => {
  let business = structuredClone(initialBusiness);
  let failNextSave = false;
  let submitCalls = 0;
  let mineCalls = 0;

  await page.route('**/api/v1/auth/refresh', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      accessToken: 'test-access-token',
      user: {
        id: 'owner-user-test',
        email: 'owner@example.test',
        fullName: 'Chủ thử',
        phone: '+84912345678',
        sessionType: 'salon',
        roles: ['BUSINESS_OWNER'],
        permissions: ['business:create:self'],
        scopes: [{ code: 'BUSINESS_OWNER', businessId: business.id }],
      },
    }),
  }));

  await page.route('**/api/v1/business/onboarding/mine', (route) => {
    mineCalls += 1;
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(business) });
  });
  await page.route('**/api/v1/business/onboarding/config', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      businessTypes: [{ code: 'SPA', label: 'Spa' }],
      requiredDocuments: [],
      requirePhoneVerification: false,
    }),
  }));
  await page.route('**/api/v1/business/business-onboarding-test/onboarding', async (route) => {
    if (failNextSave) {
      failNextSave = false;
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'database internal exception' }) });
      return;
    }
    const update = route.request().postDataJSON();
    business = {
      ...business,
      ...update,
      name: update.name || business.name,
      slug: update.slug || business.slug,
      owner: {
        ...business.owner,
        companyName: update.companyName ?? business.owner.companyName,
        taxCode: update.taxCode ?? business.owner.taxCode,
        identityCardNumber: update.identityCardNumber ?? business.owner.identityCardNumber,
      },
    };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(business) });
  });
  await page.route('**/api/v1/business/business-onboarding-test/submit', async (route) => {
    submitCalls += 1;
    business = { ...business, status: 'PENDING_REVIEW', reviewEvents: [] };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(business) });
  });

  await page.goto('/salon/onboarding');
  await expect(page.getByRole('heading', { name: 'Đăng ký BeautyBook Business' })).toBeVisible();
  await page.getByRole('button', { name: 'Spa' }).click();
  await page.getByRole('button', { name: /Lưu và tiếp tục/ }).click();

  await page.locator('#onboarding-name').fill('Tiệm Demo');
  await page.locator('#onboarding-companyName').fill('Công ty Demo');
  await page.locator('#onboarding-taxCode').fill('MST-TEST');
  await page.locator('#onboarding-addressLine').fill('Quận 1, TP.HCM');
  await page.locator('#onboarding-legalRepresentative').fill('Chủ thử');
  await page.locator('#onboarding-contactPhone').fill('0912 345 678');
  await page.getByRole('button', { name: /Lưu và tiếp tục/ }).click();
  await expect(page.getByText('Bước 3/4')).toBeVisible();
  await page.getByRole('button', { name: /Lưu và tiếp tục/ }).click();
  await expect(page.getByText('Bước 4/4')).toBeVisible();

  await page.waitForTimeout(1000);
  const submitButton = page.getByRole('button', { name: /Gửi hồ sơ doanh nghiệp/ });
  await expect(submitButton).toBeEnabled();
  failNextSave = true;
  await submitButton.click();
  await expect(page.getByText('Tiệm Demo', { exact: true })).toBeVisible();
  await expect.poll(() => submitCalls).toBe(0);
  await expect(page.getByText(/nội dung đã nhập vẫn được giữ lại/)).toBeVisible();

  await submitButton.click();
  await expect(page.getByText('Hồ sơ đang được xét duyệt')).toBeVisible();
  await expect(page.getByText('Chờ xét duyệt', { exact: true })).toBeVisible();
  await expect.poll(() => submitCalls).toBe(1);
  expect(mineCalls).toBeGreaterThanOrEqual(2);
});
