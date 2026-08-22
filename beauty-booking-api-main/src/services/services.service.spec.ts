import { ServicesService } from './services.service';
import { ConflictException } from '@nestjs/common';

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
