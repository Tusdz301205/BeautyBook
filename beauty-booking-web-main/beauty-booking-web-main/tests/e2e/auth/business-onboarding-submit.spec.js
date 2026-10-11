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
      legalSubjects: [{code:'ORGANIZATION_10',label:'Doanh nghiệp / tổ chức độc lập',pattern:'^[0-9]{10}$',hint:'10 chữ số'}],
      representativeIdentityTypes: [],
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
  await page.locator('#onboarding-legalSubjectType').click();
  await page.getByRole('option', { name: 'Doanh nghiệp / tổ chức độc lập', exact: true }).click();
  await page.locator('#onboarding-taxCode').fill('0123456789');
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

for (const width of [375, 768, 1024, 1440]) {
  test(`@responsive transitional tax checklist follows legal subject at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const business = { ...structuredClone(initialBusiness), name: 'Tiệm QA giấy tờ thuế', addressLine: 'Địa chỉ QA',
      onboardingStep: 2, onboardingData: { businessType: 'SPA', legalSubjectType: 'LEGACY_DEPENDENT_10', completedSteps: [1] },
      owner: { companyName: 'Công ty QA', taxCode: '0123456789', identityCardNumber: null } };
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route('**/api/v1/**', route => {
      const pathname = new URL(route.request().url()).pathname;
      let body = {};
      if (pathname === '/api/v1/auth/refresh') body = { accessToken: 'mock-tax-ui-token', user: {
        id: 'mock-owner-tax-ui', email: 'owner@example.test', fullName: 'Chủ thử', phone: '+84912345678',
        sessionType: 'salon', roles: ['BUSINESS_OWNER'], permissions: ['business:create:self'],
        scopes: [{ code: 'BUSINESS_OWNER', businessId: business.id }] } };
      else if (pathname === '/api/v1/business/onboarding/mine') body = business;
      else if (pathname === '/api/v1/business/onboarding/config') body = {
        businessTypes: [{ code: 'SPA', label: 'Spa' }], requiredDocuments: [], requirePhoneVerification: false,
        legalSubjects: [{ code: 'LEGACY_DEPENDENT_10', label: 'Đơn vị phụ thuộc mã số thuế chuyển tiếp', pattern: '^[0-9]{10}$', hint: '10 chữ số' },
          { code: 'ORGANIZATION_10', label: 'Doanh nghiệp / tổ chức độc lập', pattern: '^[0-9]{10}$', hint: '10 chữ số' }],
        representativeIdentityTypes: [] };
      else if (pathname.endsWith('/onboarding')) body = { ...business, ...route.request().postDataJSON() };
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto('/salon/onboarding');
    await expect(page.getByRole('heading', { name: 'Đăng ký BeautyBook Business' })).toBeVisible();
    const checklist = page.getByLabel('Giấy tờ cần nộp');
    await expect(checklist).toContainText('Tài liệu thuế');
    await expect(checklist).toContainText('Chưa có tệp');
    await expect(checklist).not.toContainText('không yêu cầu');
    await page.locator('#onboarding-legalSubjectType').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`transitional-tax-${width}.png`) });
    await page.locator('#onboarding-legalSubjectType').click();
    await page.getByRole('option', { name: 'Doanh nghiệp / tổ chức độc lập', exact: true }).click();
    await expect(checklist).not.toContainText('Tài liệu thuế');
    await expect(checklist).toContainText('không yêu cầu');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(pageErrors).toEqual([]);
  });
}
