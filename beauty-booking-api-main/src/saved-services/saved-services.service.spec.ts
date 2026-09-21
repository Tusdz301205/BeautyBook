import { NotFoundException } from '@nestjs/common';
import { SavedServicesService } from './saved-services.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
const customer: AuthUser = { id: 'user-1', email: 'test@example.test', roles: ['CUSTOMER'], scopes: [{ code: 'CUSTOMER' }], sessionType: 'customer' };

describe('SavedServicesService', () => {
  it('only saves an offering that is publicly bookable through its branch and business state', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = {
      customerProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'customer-1' }) },
      branchServiceOffering: { findFirst },
      customerSavedService: { upsert: jest.fn() },
    };
    const service = new SavedServicesService(prisma as any);

    await expect(service.save(customer, 'offering-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      id: 'offering-1', status: 'ACTIVE', bookable: true,
      branch: expect.objectContaining({
        reviewStatus: 'APPROVED', operationalStatus: 'ACTIVE',
        business: expect.objectContaining({ bookingRestrictedAt: null }),
      }),
    }) }));
  });

  it('scopes removal to the authenticated customer and offering pair', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      customerProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'customer-1' }) },
      customerSavedService: { deleteMany },
    };
    const service = new SavedServicesService(prisma as any);

    await service.remove(customer, 'offering-1');
    expect(deleteMany).toHaveBeenCalledWith({
      where: { customerId: 'customer-1', branchServiceOfferingId: 'offering-1' },
    });
  });
});
