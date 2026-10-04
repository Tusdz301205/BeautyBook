import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import {
  assertSubmittableBusinessName,
  BUSINESS_TYPE_CATALOG,
  businessTypeLabel,
  BusinessOnboardingService,
} from './business-onboarding.service';

describe('BusinessOnboardingService state machine', () => {
  const settings = { getEffective: jest.fn() } as any;

  test('onboarding config exposes one active service-type catalog and current document rules', async () => {
    settings.getEffective.mockResolvedValue({ requireIdVerification: true, requirePhoneVerification: false });
    const service = new BusinessOnboardingService({ user: { findUnique: jest.fn() } } as any, settings);
    await expect(service.getOnboardingConfig('owner-1')).resolves.toEqual({
      businessTypes: BUSINESS_TYPE_CATALOG.filter((item) => item.active).map(({ code, label }) => ({ code, label })),
      requiredDocuments: ['BUSINESS_LICENSE', 'OWNER_ID_CARD'],
      requirePhoneVerification: false,
      phoneVerified: true,
    });
  });

  test('onboarding config reports the authenticated account phone verification under current policy', async () => {
    settings.getEffective.mockResolvedValue({ requireIdVerification: false, requirePhoneVerification: true });
    const userLookup = jest.fn().mockResolvedValue({ isPhoneVerified: false });
    const service = new BusinessOnboardingService({ user: { findUnique: userLookup } } as any, settings);
    await expect(service.getOnboardingConfig('owner-1')).resolves.toMatchObject({
      requiredDocuments: [], requirePhoneVerification: true, phoneVerified: false,
    });
    expect(userLookup).toHaveBeenCalledWith({ where: { id: 'owner-1' }, select: { isPhoneVerified: true } });
  });

  test('server rejects internal draft names and accepts a trimmed user brand', () => {
    expect(() => assertSubmittableBusinessName('Hồ sơ cơ sở của Người dùng')).toThrow('tên thương hiệu');
    expect(() => assertSubmittableBusinessName('   ')).toThrow('tên thương hiệu');
    expect(assertSubmittableBusinessName('  Tiệm Hoa  ')).toBe('Tiệm Hoa');
  });

  test('malformed document fields return a validation error rather than a TypeError', () => {
    const service = new BusinessOnboardingService({} as PrismaService, settings);
    for (const row of [null, [], { documentName: 12 }, { documentName: 'Test', documentUrl: 12 },
      { documentName: 'Test', documentUrl: '/api/v1/media/m/content', mediaId: {}, documentType: 'OTHER' }]) {
      expect(() => (service as any).validateDocuments([row])).toThrow(BadRequestException);
    }
  });

  test('document expiry rejects impossible calendar dates and accepts leap years', () => {
    const service = new BusinessOnboardingService({} as PrismaService, settings);
    const row = { documentName: 'Test', documentType: 'OTHER', mediaId: 'media-1', documentUrl: '/api/v1/media/media-1/content' };
    expect(() => (service as any).validateDocuments([{ ...row, expiresAt: '2026-02-30' }])).toThrow(BadRequestException);
    expect((service as any).validateDocuments([{ ...row, expiresAt: '2028-02-29' }])[0].expiresAt).toBe('2028-02-29');
  });

  test('checklist does not mark an internal brand or a document without an uploaded version complete', async () => {
    const prisma = { business: { findUnique: jest.fn().mockResolvedValue({
      name: 'Hồ sơ cơ sở của Chủ thử', contactEmail: 'owner@example.test', contactPhone: '+84912345678',
      addressLine: 'Địa chỉ thử', legalRepresentative: 'Chủ thử', status: 'DRAFT', onboardingData: { businessType: 'SPA' },
      owner: { companyName: 'Công ty thử', taxCode: 'TEST' }, documents: [{ documentType: 'BUSINESS_LICENSE', versions: [] }],
    }) } } as any;
    const rows = await new BusinessOnboardingService(prisma, settings).checklist('biz-1');
    expect(rows.find((row) => row.key === 'business')?.completed).toBe(false);
    expect(rows.find((row) => row.key === 'license')?.completed).toBe(false);
  });

  test('submit refuses the generated internal draft name before applying review policy', async () => {
    settings.getEffective.mockClear();
    const prisma = {
      business: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'biz-1', name: 'Hồ sơ cơ sở của Chủ thử', status: 'DRAFT',
        }),
      },
    } as unknown as PrismaService;
    const user = {
      id: 'owner-1', roles: ['BUSINESS_OWNER'], scopes: [{ code: 'BUSINESS_OWNER', businessId: 'biz-1' }],
    } as any;
    await expect(new BusinessOnboardingService(prisma, settings).submit('biz-1', user))
      .rejects.toThrow('tên thương hiệu');
    expect(settings.getEffective).not.toHaveBeenCalled();
  });

  test('business type validation is tied to the catalog and rejects unknown or inactive values', () => {
    const service = new BusinessOnboardingService({} as PrismaService, settings);
    expect((service as any).validateOnboardingData({ businessType: 'SPA' })).toEqual({ businessType: 'SPA' });
    expect(() => (service as any).validateOnboardingData({ businessType: 'LEGAL_ENTITY' }))
      .toThrow('Loại hình doanh nghiệp');
    const spa = BUSINESS_TYPE_CATALOG.find((item) => item.code === 'SPA')!;
    try {
      (spa as { active: boolean }).active = false;
      expect(() => (service as any).validateOnboardingData({ businessType: 'SPA' })).toThrow('không còn khả dụng');
    } finally { (spa as { active: boolean }).active = true; }
  });

  test('review labels use the same catalog as the owner configuration', () => {
    expect(businessTypeLabel({ businessType: 'SPA' })).toBe('Spa');
    expect(businessTypeLabel({ businessType: 'LEGAL_ENTITY' })).toBe('Chưa chọn loại hình dịch vụ');
  });

  test('draft normalization trims contact values without assuming legal identifier formats', () => {
    const service = new BusinessOnboardingService({} as PrismaService, settings);
    expect((service as any).normalizeDraftInput({
      name: '  Tiệm Hoa  ', slug: 'Tiem-Hoa', contactEmail: ' OWNER@EXAMPLE.VN ',
      contactPhone: '0912 345 678', taxCode: 'AB-123', identityCardNumber: 'ID-456',
    })).toMatchObject({
      name: 'Tiệm Hoa', slug: 'tiem-hoa', contactEmail: 'owner@example.vn',
      contactPhone: '+84912345678', taxCode: 'AB-123', identityCardNumber: 'ID-456',
    });
    expect((service as any).normalizeDraftInput({ name: '   ', slug: 'draft-1' })).toMatchObject({ name: null });
  });
  test('review requires a pending-review business', async () => {
    const prisma = {
      business: { findUnique: jest.fn().mockResolvedValue({ id: 'biz-1', status: 'DRAFT' }) },
    } as unknown as PrismaService;
    await expect(
      new BusinessOnboardingService(prisma, settings).review('biz-1', 'APPROVE', undefined, 'admin-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  test('request-info requires a reason', async () => {
    const prisma = {
      business: { findUnique: jest.fn().mockResolvedValue({ id: 'biz-1', status: 'PENDING_REVIEW' }) },
    } as unknown as PrismaService;
    await expect(
      new BusinessOnboardingService(prisma, settings).review('biz-1', 'REQUEST_INFO', undefined, 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  test('approve moves pending review to approved', async () => {
    const update = jest.fn().mockResolvedValue({ count: 1 });
    const businessReviewEventCreate = jest.fn().mockResolvedValue({ id: 'event-1' });
    const auditCreate = jest.fn().mockResolvedValue({ id: 'audit-1' });
    const prisma = {
      business: {
        findUnique: jest.fn().mockResolvedValue({ id: 'biz-1', status: 'PENDING_REVIEW', documents: [] }),
        updateMany: update,
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'biz-1', status: 'APPROVED' }),
      },
      businessReviewEvent: { create: businessReviewEventCreate },
      auditLog: { create: auditCreate },
      $transaction: jest.fn(async (callback) => callback({
        business: { updateMany: update, findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'biz-1', status: 'APPROVED' }) },
        businessReviewEvent: { create: businessReviewEventCreate },
        businessDocument: { update: jest.fn() },
        documentReviewEvent: { create: jest.fn() },
      })),
    } as unknown as PrismaService;
    await expect(
      new BusinessOnboardingService(prisma, settings).review('biz-1', 'APPROVE', undefined, 'admin-1'),
    ).resolves.toMatchObject({ status: 'APPROVED' });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'APPROVED' }),
    }));
  });

  test('stale reviewer cannot write a second decision or history', async () => {
    const createEvent = jest.fn();
    const tx = {
      business: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), findUniqueOrThrow: jest.fn() },
      businessReviewEvent: { create: createEvent },
    };
    const prisma = {
      business: { findUnique: jest.fn().mockResolvedValue({ id: 'biz-1', status: 'PENDING_REVIEW', updatedAt: new Date(), documents: [] }) },
      $transaction: jest.fn((callback) => callback(tx)),
    } as unknown as PrismaService;
    await expect(new BusinessOnboardingService(prisma, settings).review('biz-1', 'REJECT', 'Không đủ hồ sơ', 'admin-2'))
      .rejects.toBeInstanceOf(ConflictException);
    expect(createEvent).not.toHaveBeenCalled();
  });
});
