import { NotFoundException } from '@nestjs/common';
import { ServicesService } from './services.service';
import { StaffService } from '../staff/staff.service';

describe('customer detail visibility', () => {
  const avatar = { url: '/private-avatar', visibility: 'PRIVATE' };
  const images = [{ media: { url: '/public-portfolio' } }];

  it('public service details restrict gallery media and do not return a private staff avatar', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'service', price: 100, businessService: { name: 'Chăm sóc da', canonicalService: null },
      staffServices: [{ staff: { id: 'staff', user: { avatarMedia: avatar }, images, reviewRatings: [] } }],
    });
    const prisma = { branchServiceOffering: { findFirst }, serviceVariant: { findMany: jest.fn().mockResolvedValue([]) } };
    const result = await new ServicesService(prisma as never).findOne('service', true);
    const query = findFirst.mock.calls[0][0];
    expect(query.include.images.where).toEqual({ media: { visibility: 'PUBLIC', fileType: 'IMAGE' } });
    expect(query.include.staffServices.include.staff.include.images.where).toEqual(query.include.images.where);
    expect(result?.staffServices[0].staff).toHaveProperty('avatarUrl', '/public-portfolio');
    expect(result?.staffServices[0].staff).not.toHaveProperty('user');
    await new ServicesService(prisma as never).findOne('service', false);
    expect(findFirst.mock.calls[1][0].include.images).not.toHaveProperty('where');
  });

  it('staff details require a published bookable branch and catalog, with public photos only', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'staff', user: { avatarMedia: avatar }, images, staffServices: [], reviewRatings: [],
    });
    const result = await new StaffService({ staffProfile: { findFirst } } as never, {} as never).findPublicOne('staff');
    const query = findFirst.mock.calls[0][0];
    expect(query.where).toMatchObject({ status: 'ACTIVE', isBookable: true, publicVisible: true, deletedAt: null,
      branch: { status: 'ACTIVE', reviewStatus: 'APPROVED', operationalStatus: 'ACTIVE', deletedAt: null,
        business: { deletedAt: null, bookingRestrictedAt: null } } });
    expect(query.select.staffServices.where.service).toMatchObject({ bookable: true, status: 'ACTIVE', deletedAt: null,
      businessService: { status: 'ACTIVE', deletedAt: null } });
    expect(query.select.images.where).toEqual({ media: { visibility: 'PUBLIC', fileType: 'IMAGE' } });
    expect(result.avatarUrl).toBe('/public-portfolio');
    expect(result).not.toHaveProperty('user');
  });

  it('unpublished or unavailable staff detail is unavailable to customers', async () => {
    const service = new StaffService({ staffProfile: { findFirst: jest.fn().mockResolvedValue(null) } } as never, {} as never);
    await expect(service.findPublicOne('hidden')).rejects.toBeInstanceOf(NotFoundException);
  });
});
