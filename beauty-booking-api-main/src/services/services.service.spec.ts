import { ServicesService } from './services.service';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('Service command validation', () => {
  test.each(['bufferBeforeMinutes', 'bufferAfterMinutes'])('a null %s update fails without changing the variant', async (field) => {
    const update = jest.fn();
    const service = new ServicesService({ serviceVariant: {
      findUnique: jest.fn().mockResolvedValue({ id: 'variant', priceType: 'FIXED', price: 10,
        maxPrice: null, durationMinutes: 15, maxDurationMinutes: null,
        bufferBeforeMinutes: 0, bufferAfterMinutes: 0, deletedAt: null }), update,
    } } as never);
    await expect(service.updateVariant('variant', { [field]: null } as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });
  test.each([
    { bufferBeforeMinutes: 1.5 }, { bufferBeforeMinutes: 'invalid' },
    { bufferAfterMinutes: 1.5 }, { bufferAfterMinutes: -1 },
    { maxDurationMinutes: 1.5 }, { maxDurationMinutes: '2' }, { maxDurationMinutes: 0 },
  ])('invalid variant timing is rejected without writing: %j', async (timing) => {
    const create = jest.fn();
    const service = new ServicesService({
      branchServiceOffering: { findFirst: jest.fn().mockResolvedValue({ id: 'service' }) },
      serviceVariant: { create },
    } as never);
    await expect(service.createVariant('service', {
      code: 'valid', name: 'Biến thể', price: 10, durationMinutes: 1, ...timing,
    } as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
  const service = new ServicesService({} as never);
  test.each([{ price: 10 }, { code: 'valid', name: '   ', price: 10 }, { code: 1, name: 'Tên', price: 10 }])('malformed variant fails as a client error before persistence', async (data) => {
    await expect(service.createVariant('service', data as never)).rejects.toBeInstanceOf(BadRequestException);
  });
  test.each([
    { name: 'Quy tắc', adjustmentType: 'INVALID', adjustmentValue: 1, conditions: {} },
    { name: 1, adjustmentType: 'FIXED_AMOUNT', adjustmentValue: 1, conditions: {} },
    { name: 'Quy tắc', adjustmentType: 'FIXED_AMOUNT', adjustmentValue: 1, conditions: [] },
    { name: 'Quy tắc', adjustmentType: 'FIXED_AMOUNT', adjustmentValue: 1, conditions: {}, validFrom: 'invalid' },
  ])('malformed price rule never reaches Prisma', async (data) => {
    await expect(service.createPriceRule('service', data as never)).rejects.toBeInstanceOf(BadRequestException);
  });
  test('a variant update cannot rebind its service through an arbitrary payload field', async () => {
    await expect(service.updateVariant('variant', { serviceId: 'foreign-service' } as never)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ServicesService branch availability', () => {
  test('creates a hidden compatibility category when owner omits categoryId', async () => {
    const catalogCreate = jest.fn().mockResolvedValue({ id: 'catalog-1' });
    const offeringCreateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      businessService: { create: catalogCreate },
      branchServiceOffering: { createMany: offeringCreateMany },
    };
    const prisma = {
      branch: { findMany: jest.fn().mockResolvedValue([{ id: 'branch-1', businessId: 'business-1' }]) },
      serviceCategory: { upsert: jest.fn().mockResolvedValue({ id: 'category-default' }) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new ServicesService(prisma as never);

    await service.createCatalog({
      branchId: 'branch-1',
      name: 'Chăm sóc da',
      price: 400000,
      durationMinutes: 60,
    });

    expect(prisma.serviceCategory.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { businessId_slug: { businessId: 'business-1', slug: 'dich-vu' } },
    }));
    expect(catalogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ categoryId: 'category-default' }),
    }));
    expect(offeringCreateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ categoryId: 'category-default' })],
    }));
  });

  test('pausing a service updates only the selected branch row', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'branch-service-a', status: 'INACTIVE' });
    const prisma = {
      businessService: { findUnique: jest.fn().mockResolvedValue({ id: 'catalog-1', businessId: 'business-1', deletedAt: null }) },
      branch: { findUnique: jest.fn().mockResolvedValue({ businessId: 'business-1' }) },
      branchServiceOffering: {
        findUnique: jest.fn().mockResolvedValue({ id: 'branch-service-a', branchId: 'branch-a', deletedAt: null }),
        update,
      },
    };
    const service = new ServicesService(prisma as never);
    await service.setBranchAvailability('catalog-1', 'branch-a', 'pause');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'branch-service-a' }, data: { status: 'INACTIVE', bookable: false },
    });
  });

  test('applying a catalog creates a real branch service using base values', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'branch-service-b' });
    const prisma = {
      businessService: { findUnique: jest.fn().mockResolvedValue({
        id: 'catalog-1', businessId: 'business-1', categoryId: 'category-1',
        name: 'Chăm sóc da', description: 'Mô tả', basePrice: 465000,
        baseDurationMinutes: 105, deletedAt: null,
      }) },
      branch: { findUnique: jest.fn().mockResolvedValue({ businessId: 'business-1' }) },
      branchServiceOffering: { findUnique: jest.fn().mockResolvedValue(null), create },
    };
    const service = new ServicesService(prisma as never);
    await service.setBranchAvailability('catalog-1', 'branch-b', 'apply');
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
      businessServiceId: 'catalog-1', branchId: 'branch-b', status: 'ACTIVE',
      price: 465000, durationMinutes: 105,
    }) });
  });

  test('public listing always filters inactive branch services', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new ServicesService({ branchServiceOffering: { findMany } } as never);
    await service.findAll('branch-a', true);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ branchId: 'branch-a', status: 'ACTIVE', bookable: true, deletedAt: null }),
    }));
  });

  test('does not archive a catalog while future bookings still reference it', async () => {
    const prisma = {
      bookingService: { count: jest.fn().mockResolvedValue(2) },
      $transaction: jest.fn(),
    };
    const service = new ServicesService(prisma as never);
    await expect(service.archiveCatalog('catalog-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('does not soft-delete a branch service with a future booking', async () => {
    const update = jest.fn();
    const prisma = {
      bookingService: { count: jest.fn().mockResolvedValue(1) },
      branchServiceOffering: { update },
    };
    const service = new ServicesService(prisma as never);
    await expect(service.softDelete('service-1')).rejects.toBeInstanceOf(ConflictException);
    expect(update).not.toHaveBeenCalled();
  });
});
