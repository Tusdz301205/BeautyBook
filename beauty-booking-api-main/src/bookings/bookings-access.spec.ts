/**
 * Cross-tenant access tests for BookingsAccessService — verifies the
 * service-layer second-defense guard correctly blocks an attempt to
 * access a booking owned by another tenant even when the caller holds
 * a `BUSINESS_OWNER` role on a different business.
 *
 * Uses an in-memory Prisma stub (no real DB required).
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BookingsAccessService } from './bookings-access.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';

const OWNER_T1: AuthUser = {
  id: 'u-owner-1',
  email: 'o1@x.com',
  roles: ['BUSINESS_OWNER'],
  scopes: [{ code: 'BUSINESS_OWNER', businessId: 'biz-1' }],
  sessionType: 'salon',
};

const OWNER_T2: AuthUser = {
  id: 'u-owner-2',
  email: 'o2@x.com',
  roles: ['BUSINESS_OWNER'],
  scopes: [{ code: 'BUSINESS_OWNER', businessId: 'biz-2' }],
  sessionType: 'salon',
};

const PLATFORM: AuthUser = {
  id: 'u-admin',
  email: 'a@x.com',
  roles: ['PLATFORM_ADMIN'],
  scopes: [{ code: 'PLATFORM_ADMIN' }],
  sessionType: 'admin',
  permissions: ['booking:read:platform'],
};

const REFUND_OPERATOR: AuthUser = {
  id: 'u-support',
  email: 'support@x.com',
  roles: ['PLATFORM_ADMIN'],
  scopes: [{ code: 'PLATFORM_ADMIN' }],
  sessionType: 'admin',
  permissions: ['booking:read:platform', 'payment:refund:platform'],
};

const STAFF: AuthUser = {
  id: 'staff-user-1',
  email: 'staff@x.com',
  roles: ['STAFF'],
  scopes: [{ code: 'STAFF', businessId: 'biz-1', branchId: 'br-1' }],
  sessionType: 'salon',
};

const OTHER_STAFF: AuthUser = {
  ...STAFF,
  id: 'staff-user-2',
  email: 'other-staff@x.com',
};

interface FakeBooking {
  id: string;
  branchId: string;
  customerId: string;
  deletedAt: Date | null;
  customer: { userId: string };
  branch: { businessId: string };
  bookingServices: { staffId: string | null }[];
}

function fakePrisma(booking: FakeBooking | null): PrismaService {
  return {
    booking: {
      findUnique: async ({ where }: any) =>
        booking && where.id === booking.id
          ? {
              id: booking.id,
              customerId: booking.customerId,
              branchId: booking.branchId,
              deletedAt: booking.deletedAt,
              customer: booking.customer,
              branch: booking.branch,
              bookingServices: booking.bookingServices,
            }
          : null,
      findFirst: async ({ where }: any) =>
        booking &&
        where.id === booking.id &&
        (where.deletedAt !== null || booking.deletedAt === null)
          ? {
              id: booking.id,
              customerId: booking.customerId,
              branchId: booking.branchId,
              deletedAt: booking.deletedAt,
              customer: booking.customer,
              branch: booking.branch,
              bookingServices: booking.bookingServices,
            }
          : null,
    },
    branch: {
      findUnique: async ({ where }: any) => {
        // branchId → businessId
        const map: Record<string, string> = { 'br-1': 'biz-1', 'br-2': 'biz-1', 'br-3': 'biz-2' };
        return map[where.id] ? { businessId: map[where.id] } : null;
      },
    },
    staffProfile: {
      findFirst: async ({ where }: any) => {
        const staff = [
          { id: 'staff-profile-1', userId: 'staff-user-1' },
          { id: 'staff-profile-2', userId: 'staff-user-2' },
        ].find((row) => where.id.in.includes(row.id) && where.userId === row.userId);
        return staff ? { userId: staff.userId } : null;
      },
    },
  } as unknown as PrismaService;
}

describe('BookingsAccessService — cross-tenant blocking', () => {
  test('owner of tenant 2 cannot read a booking in tenant 1', async () => {
    const booking: FakeBooking = {
      id: 'bk-1',
      branchId: 'br-1',
      customerId: 'cp-1',
      deletedAt: null,
      customer: { userId: 'cust-user-1' },
      branch: { businessId: 'biz-1' },
      bookingServices: [],
    };
    const svc = new BookingsAccessService(fakePrisma(booking));
    await expect(
      svc.loadAndAssert(OWNER_T2, 'bk-1', 'booking:read:tenant'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('owner of tenant 1 can read a booking in their own tenant', async () => {
    const booking: FakeBooking = {
      id: 'bk-1',
      branchId: 'br-1',
      customerId: 'cp-1',
      deletedAt: null,
      customer: { userId: 'cust-user-1' },
      branch: { businessId: 'biz-1' },
      bookingServices: [],
    };
    const svc = new BookingsAccessService(fakePrisma(booking));
    const info = await svc.loadAndAssert(OWNER_T1, 'bk-1', 'booking:read:tenant');
    expect(info.businessId).toBe('biz-1');
    expect(info.customerUserId).toBe('cust-user-1');
  });

  test('platform admin can read any tenant booking', async () => {
    const booking: FakeBooking = {
      id: 'bk-1',
      branchId: 'br-1',
      customerId: 'cp-1',
      deletedAt: null,
      customer: { userId: 'cust-user-1' },
      branch: { businessId: 'biz-1' },
      bookingServices: [],
    };
    const svc = new BookingsAccessService(fakePrisma(booking));
    const info = await svc.loadAndAssert(PLATFORM, 'bk-1', 'booking:read:platform');
    expect(info.businessId).toBe('biz-1');
  });

  test('platform admin cannot create a tenant booking', async () => {
    const svc = new BookingsAccessService(fakePrisma(null));
    await expect(svc.assertCustomerCreate(PLATFORM, 'br-1'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  test.each(['RECEPTIONIST', 'BRANCH_MANAGER'])('%s cannot create at another branch of the same business', async (role) => {
    const user = { ...STAFF, roles: [role], scopes: [{ code: role, businessId: 'biz-1', branchId: 'br-1' }] } as AuthUser;
    const service = new BookingsAccessService(fakePrisma(null));
    await expect(service.assertCustomerCreate(user, 'br-1')).resolves.toBe('biz-1');
    await expect(service.assertCustomerCreate(user, 'br-2')).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('owner can create across their branches but not another business', async () => {
    const service = new BookingsAccessService(fakePrisma(null));
    await expect(service.assertCustomerCreate(OWNER_T1, 'br-2')).resolves.toBe('biz-1');
    await expect(service.assertCustomerCreate(OWNER_T1, 'br-3')).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('a second assigned provider can update a multi-provider booking', async () => {
    const booking: FakeBooking = {
      id: 'bk-1', branchId: 'br-1', customerId: 'cp-1', deletedAt: null,
      customer: { userId: 'cust-user-1' }, branch: { businessId: 'biz-1' },
      bookingServices: [{ staffId: 'staff-profile-1' }, { staffId: 'staff-profile-2' }],
    };
    await expect(new BookingsAccessService(fakePrisma(booking)).assertWrite(OTHER_STAFF, 'bk-1'))
      .resolves.toMatchObject({ staffUserId: 'staff-user-2' });
  });

  test('platform refund operator can authorize a refund without force-cancel permission', async () => {
    const booking: FakeBooking = {
      id: 'bk-1',
      branchId: 'br-1',
      customerId: 'cp-1',
      deletedAt: null,
      customer: { userId: 'cust-user-1' },
      branch: { businessId: 'biz-1' },
      bookingServices: [],
    };
    const svc = new BookingsAccessService(fakePrisma(booking));
    await expect(svc.assertRefund(REFUND_OPERATOR, 'bk-1')).resolves.toMatchObject({
      bookingId: 'bk-1',
    });
  });

  test('staff can update an assigned booking', async () => {
    const booking: FakeBooking = {
      id: 'bk-1', branchId: 'br-1', customerId: 'cp-1', deletedAt: null,
      customer: { userId: 'cust-user-1' }, branch: { businessId: 'biz-1' },
      bookingServices: [{ staffId: 'staff-profile-1' }],
    };
    await expect(new BookingsAccessService(fakePrisma(booking)).assertWrite(STAFF, 'bk-1'))
      .resolves.toMatchObject({ staffUserId: 'staff-user-1' });
  });

  test('staff cannot update a booking assigned to another staff member', async () => {
    const booking: FakeBooking = {
      id: 'bk-1', branchId: 'br-1', customerId: 'cp-1', deletedAt: null,
      customer: { userId: 'cust-user-1' }, branch: { businessId: 'biz-1' },
      bookingServices: [{ staffId: 'staff-profile-1' }],
    };
    await expect(new BookingsAccessService(fakePrisma(booking)).assertWrite(OTHER_STAFF, 'bk-1'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  test('deleted booking throws NotFoundException', async () => {
    const booking: FakeBooking = {
      id: 'bk-1',
      branchId: 'br-1',
      customerId: 'cp-1',
      deletedAt: new Date(),
      customer: { userId: 'cust-user-1' },
      branch: { businessId: 'biz-1' },
      bookingServices: [],
    };
    const svc = new BookingsAccessService(fakePrisma(booking));
    await expect(
      svc.loadAndAssert(OWNER_T1, 'bk-1', 'booking:read:tenant'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  test('non-existent booking throws NotFoundException', async () => {
    const svc = new BookingsAccessService(fakePrisma(null));
    await expect(
      svc.loadAndAssert(OWNER_T1, 'missing', 'booking:read:tenant'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
