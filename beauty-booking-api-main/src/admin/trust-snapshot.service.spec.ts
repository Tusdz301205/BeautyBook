import type { PrismaService } from '../prisma/prisma.service';
import { TrustSnapshotService } from './trust-snapshot.service';

jest.mock('../common/utils/audit', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
}));

describe('TrustSnapshotService fairness', () => {
  test('customer-caused cancellation and no-show do not penalize the salon', async () => {
    const prisma = {
      booking: {
        findMany: jest.fn().mockResolvedValue([
          {
            status: 'CANCELLED', cancelledByType: 'CUSTOMER', cancelledAt: new Date(),
            appointmentDate: new Date('2026-07-15T00:00:00.000Z'),
            appointmentStartTime: new Date('1970-01-01T09:00:00.000Z'),
            createdAt: new Date(), statusHistory: [],
          },
          {
            status: 'NO_SHOW', cancelledByType: null, cancelledAt: null,
            appointmentDate: new Date('2026-07-15T00:00:00.000Z'),
            appointmentStartTime: new Date('1970-01-01T10:00:00.000Z'),
            createdAt: new Date(), statusHistory: [],
          },
        ]),
      },
    } as unknown as PrismaService;

    const metrics = await new TrustSnapshotService(prisma, {} as never, {} as never).computeForBusiness('biz-1');
    expect(metrics.cancellationRate).toBe(0);
    expect(metrics.noShowRate).toBe(0.5);
    expect(metrics.trustScore).toBe(100);
  });

  test('restore returns a suspended business to its recorded prior lifecycle state', async () => {
    const businessUpdate = jest.fn().mockResolvedValue({ id: 'biz-1' });
    const trustActionCreate = jest.fn().mockResolvedValue({ id: 'restore-1' });
    const prisma: any = {
      business: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'biz-1',
          status: 'SUSPENDED',
        }),
        update: businessUpdate,
      },
      trustAction: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'suspend-1',
          action: 'SUSPENDED',
          statusBefore: 'APPROVED',
        }),
        create: trustActionCreate,
        findMany: jest.fn().mockResolvedValue([]),
      },
      salonMember: { findMany: jest.fn().mockResolvedValue([]) },
    };
    prisma.$transaction = jest.fn(
      async (operation: (tx: unknown) => Promise<unknown>) => operation(prisma),
    );
    const settings = {
      getEffective: jest.fn().mockResolvedValue({
        violationSuspendThreshold: 3,
      }),
    };

    await new TrustSnapshotService(
      prisma as PrismaService,
      settings as never,
      {} as never,
    ).performAction({
      actorId: 'admin-1',
      businessId: 'biz-1',
      action: 'RESTORED',
      reason: 'Đã hoàn thành kiểm tra',
    });

    expect(businessUpdate).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: {
        status: 'APPROVED',
        bookingRestrictedAt: null,
        bookingRestrictionReason: null,
      },
    });
    expect(trustActionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'RESTORED',
        statusBefore: 'SUSPENDED',
        statusAfter: 'APPROVED',
        restoreOfActionId: 'suspend-1',
      }),
    });
  });
});
