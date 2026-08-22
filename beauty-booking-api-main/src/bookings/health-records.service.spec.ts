import { GoneException } from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type { PrismaService } from '../prisma/prisma.service';
import { HealthRecordsService } from './health-records.service';

const STAFF: AuthUser = {
  id: 'staff-user',
  email: 'staff@example.com',
  roles: ['STAFF'],
  scopes: [{ code: 'STAFF', businessId: 'biz-1', branchId: 'branch-1' }],
  sessionType: 'salon',
};

function prismaStub(assigned: boolean): PrismaService {
  return {
    booking: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'booking-1',
        branchId: 'branch-1',
        customerId: 'customer-profile-1',
        customer: { id: 'customer-profile-1', userId: 'customer-user' },
        branch: { businessId: 'biz-1' },
        bookingServices: [
          { staff: { userId: assigned ? 'staff-user' : 'other-staff' } },
        ],
      }),
    },
    sensitiveConsent: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'consent-1',
        granted: true,
        revokedAt: null,
      }),
    },
    bookingHealthRecord: {
      upsert: jest.fn().mockResolvedValue({ id: 'record-1' }),
    },
  } as unknown as PrismaService;
}

describe('HealthRecordsService legacy quarantine', () => {
  test('assigned staff cannot create a free-form legacy record', async () => {
    const prisma = prismaStub(true);
    const service = new HealthRecordsService(prisma);

    await expect(
      service.create(STAFF, 'booking-1', 'ALLERGY', { note: 'latex' }),
    ).rejects.toBeInstanceOf(GoneException);
    expect(prisma.bookingHealthRecord.upsert).not.toHaveBeenCalled();
  });

  test('unassigned staff receives the same closed legacy behavior', async () => {
    const service = new HealthRecordsService(prismaStub(false));
    await expect(
      service.create(STAFF, 'booking-1', 'ALLERGY', { note: 'latex' }),
    ).rejects.toBeInstanceOf(GoneException);
  });

  test('authorized read appends a dedicated access log without copying payload', async () => {
    const accessCreate = jest.fn().mockResolvedValue({ id: 'access-1' });
    const prisma = {
      bookingHealthRecord: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'record-1',
          bookingId: 'booking-1',
          customerId: 'customer-profile-1',
          consentId: 'consent-1',
          payload: { allergy: 'latex' },
          consent: { granted: true, revokedAt: null },
          booking: {
            branchId: 'branch-1',
            branch: { id: 'branch-1', businessId: 'biz-1' },
            customer: { id: 'customer-profile-1' },
          },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      customerProfile: {
        findUnique: jest.fn().mockResolvedValue({ userId: 'customer-user' }),
      },
      healthRecordAccessLog: { create: accessCreate },
    } as unknown as PrismaService;
    const customer = {
      id: 'customer-user', email: 'c@example.com', roles: ['CUSTOMER'],
      scopes: [{ code: 'CUSTOMER' }], permissions: ['health_record:read:self'],
      sessionType: 'customer',
    } as AuthUser;

    await new HealthRecordsService(prisma).read(customer, 'record-1', {
      ipAddress: '127.0.0.1',
      purpose: 'CUSTOMER_SELF_SERVICE',
    });
    const logged = accessCreate.mock.calls[0][0].data;
    expect(logged).toEqual(expect.objectContaining({
      actorId: 'customer-user', recordId: 'record-1', result: 'GRANTED',
    }));
    expect(logged).not.toHaveProperty('payload');
  });
});
