import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';

const RECEPTIONIST: AuthUser = {
  id: 'reception-user', email: 'r@example.com', roles: ['RECEPTIONIST'],
  scopes: [{ code: 'RECEPTIONIST', businessId: 'biz-1', branchId: 'branch-1' }],
  sessionType: 'salon',
};

const OWNER: AuthUser = {
  id: 'owner-user', email: 'o@example.com', roles: ['BUSINESS_OWNER'],
  scopes: [{ code: 'BUSINESS_OWNER', businessId: 'biz-1', branchId: null }],
  sessionType: 'salon',
};

const PLATFORM_ADMIN: AuthUser = {
  id: 'platform-admin',
  email: 'admin@example.com',
  roles: ['PLATFORM_ADMIN'],
  scopes: [{ code: 'PLATFORM_ADMIN', businessId: null, branchId: null }],
  permissions: ['refund:process:platform'],
  sessionType: 'admin',
};

const CUSTOMER: AuthUser = {
  id: 'customer-user',
  email: 'customer@example.com',
  roles: ['CUSTOMER'],
  permissions: ['package_purchase:create:self'],
  scopes: [{ code: 'CUSTOMER', businessId: null, branchId: null }],
  sessionType: 'customer',
};

function transactionalPrisma(delegates: Record<string, unknown>): PrismaService {
  const prisma: any = {
    ...delegates,
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  prisma.$transaction = jest.fn((operation: (tx: unknown) => unknown) => operation(prisma));
  return prisma as PrismaService;
}

describe('PaymentsService authorization and amounts', () => {
  test('real check-in consumes reserved sessions once; subsequent cancellation does not silently return used sessions', async () => {
    let reserved = [{ id: 'entitlement', purchaseId: 'purchase', redeemedBookingService: { status: 'SCHEDULED' } }];
    const updates = jest.fn().mockImplementation(async ({ data }) => { reserved = []; return { count: 1 }; });
    const prisma = transactionalPrisma({ packageSessionEntitlement: { findMany: jest.fn(async () => reserved), updateMany: updates } });
    const service = new PaymentsService(prisma);
    jest.spyOn(service as any, 'recalculatePackagePurchase').mockResolvedValue(null);
    await service.redeemPackageEntitlements('booking', 'CHECKED_IN');
    await service.redeemPackageEntitlements('booking', 'CHECKED_IN');
    await service.redeemPackageEntitlements('booking', 'CANCELLED');
    expect(updates).toHaveBeenCalledTimes(1);
    expect(updates.mock.calls[0][0].data).toMatchObject({ status: 'REDEEMED', redeemedAt: expect.any(Date) });
  });
  test.each(['CONFIRMED', 'CHECKED_IN'])('package reservation for %s is idempotent and settles attended sessions', async status => {
    let session: any = null;
    const entitlement = { id: 'entitlement', status: 'AVAILABLE' };
    const delegates = {
      packagePurchase: { findUnique: jest.fn().mockResolvedValue({ id: 'purchase', customerId: 'customer', customer: { userId: CUSTOMER.id },
        businessId: 'biz-1', status: 'ACTIVE', expiresAt: new Date('2099-01-01') }) },
      bookingService: { findFirst: jest.fn().mockResolvedValue({ id: 'item', booking: { status, branchId: 'branch-1' } }) },
      packageSessionEntitlement: {
        findFirst: jest.fn(async ({ where }) => where.status === 'AVAILABLE' ? entitlement : session),
        update: jest.fn(async ({ data }) => { session = { ...entitlement, ...data }; return session; }),
        findUniqueOrThrow: jest.fn(async () => session),
      },
    };
    const prisma = transactionalPrisma(delegates), service = new PaymentsService(prisma);
    const consume = jest.spyOn(service, 'redeemPackageEntitlements').mockImplementation(async () => { session.status = 'REDEEMED'; });
    const body = { bookingId: 'booking', bookingServiceId: 'item' };
    expect((await service.reservePackageSession(CUSTOMER, 'purchase', body)).status).toBe(status === 'CONFIRMED' ? 'RESERVED' : 'REDEEMED');
    await service.reservePackageSession(CUSTOMER, 'purchase', body);
    expect(delegates.packageSessionEntitlement.update).toHaveBeenCalledTimes(1);
    expect(consume).toHaveBeenCalledTimes(status === 'CHECKED_IN' ? 1 : 0);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'Serializable' }));
  });
  test.each([['CONFIRMED', 100, false], ['CHECKED_IN', 99, false], ['CHECKED_IN', 100, true], ['COMPLETED', 100, true]] as const)
    ('platform fee on %s with verified %i requires both recorded attendance and full payment', async (status, amount, eligible) => {
      const booking = { id: 'booking', status, totalAmount: 100, finalAmount: 100, branchId: 'branch', branch: { businessId: 'business' },
        paymentTransactions: [{ status: 'VERIFIED', amount }], payments: [] };
      const tx = { $queryRaw: jest.fn(), booking: { findUnique: jest.fn().mockResolvedValue(booking) },
        platformFeeEntry: { upsert: jest.fn().mockResolvedValue({ id: 'fee', businessId: 'business', branchId: 'branch', feeAmount: 5, feeRate: 5 }) },
        platformFeeAdjustment: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }), create: jest.fn() },
        financialLedgerEntry: { upsert: jest.fn() } };
      await new PaymentsService({} as never).ensurePlatformFee(tx as never, 'booking');
      expect(tx.platformFeeEntry.upsert).toHaveBeenCalledTimes(eligible ? 1 : 0);
      expect(tx.financialLedgerEntry.upsert).toHaveBeenCalledTimes(eligible ? 1 : 0);
      expect(booking.status).toBe(status);
    });
  test('post-arrival price and balance changes append one fee adjustment, preserving the initial assessment', async () => {
    const booking = { status: 'CHECKED_IN', totalAmount: 100, finalAmount: 100, branchId: 'branch', branch: { businessId: 'business' },
      payments: [], paymentTransactions: [{ status: 'VERIFIED', amount: 100 }] };
    const fee = { id: 'fee', businessId: 'business', branchId: 'branch', feeAmount: 5, feeRate: 5 };
    const adjustments: Array<{ amount: number; id: string }> = [];
    const tx = { $queryRaw: jest.fn(), booking: { findUnique: jest.fn().mockResolvedValue(booking) }, platformFeeEntry: { upsert: jest.fn().mockResolvedValue(fee) },
      platformFeeAdjustment: { aggregate: jest.fn(async () => ({ _sum: { amount: adjustments.reduce((sum, row) => sum + row.amount, 0) } })),
        create: jest.fn(async ({ data }) => { const row = { ...data, id: `adjustment-${adjustments.length}` }; adjustments.push(row); return row; }) },
      financialLedgerEntry: { upsert: jest.fn() } };
    const service = new PaymentsService({} as never);
    await service.ensurePlatformFee(tx as never, 'booking');
    booking.totalAmount = 200; booking.finalAmount = 200;
    await service.ensurePlatformFee(tx as never, 'booking');
    expect(adjustments).toHaveLength(0); // New amount is not fully paid yet.
    booking.paymentTransactions.push({ status: 'VERIFIED', amount: 100 });
    await service.ensurePlatformFee(tx as never, 'booking');
    await service.ensurePlatformFee(tx as never, 'booking');
    expect(adjustments).toHaveLength(1); expect(adjustments[0].amount).toBe(5);
    expect(fee.feeAmount).toBe(5); expect(booking.status).toBe('CHECKED_IN');
    expect(tx.financialLedgerEntry.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ type: 'PLATFORM_FEE_ADJUSTMENT', direction: 'DEBIT', amount: 5 }) }));
  });
  test('a receptionist cannot use a purchase in branch A to consume a session for booking branch B', async () => {
    const create = jest.fn();
    const prisma = transactionalPrisma({ packagePurchase: { findUnique: jest.fn().mockResolvedValue({ id: 'purchase', businessId: 'biz-1', branchId: 'branch-1', customerId: 'customer', customer: { userId: 'customer' }, status: 'ACTIVE' }) },
      bookingService: { findFirst: jest.fn().mockResolvedValue({ id: 'item', booking: { status: 'CHECKED_IN', branchId: 'branch-2' } }) },
      packageSessionEntitlement: { update: create, findFirst: jest.fn() } });
    await expect(new PaymentsService(prisma).reservePackageSession(RECEPTIONIST, 'purchase', { bookingId: 'booking', bookingServiceId: 'item' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(create).not.toHaveBeenCalled();
  });
  test('check-in releases skipped/cancelled reservations while consuming only the remaining service', async () => {
    const rows = ['SCHEDULED', 'SKIPPED', 'CANCELLED'].map((status, index) => ({ id: `session-${index}`, purchaseId: 'purchase', redeemedBookingService: { status } }));
    const updateMany = jest.fn();
    const prisma = transactionalPrisma({ packageSessionEntitlement: { findMany: jest.fn().mockResolvedValue(rows), updateMany } });
    const service = new PaymentsService(prisma); jest.spyOn(service as any, 'recalculatePackagePurchase').mockResolvedValue(null);
    await service.redeemPackageEntitlements('booking', 'CHECKED_IN');
    expect(updateMany).toHaveBeenCalledWith({ where: { id: { in: ['session-1', 'session-2'] }, status: 'RESERVED' }, data: { status: 'AVAILABLE', bookingId: null, redeemedBookingServiceId: null, reservedAt: null } });
    expect(updateMany).toHaveBeenCalledWith({ where: { id: { in: ['session-0'] }, status: 'RESERVED' }, data: { status: 'REDEEMED', redeemedAt: expect.any(Date) } });
  });
  test('processing refunds continue to reserve balance until settlement or failure', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'refund-next' });
    const prisma = transactionalPrisma({
      payment: { findUnique: jest.fn().mockResolvedValue({
        id: 'payment-1', status: 'PAID', amount: 100,
        booking: { branch: { businessId: 'biz-1' } },
        refundRequests: [{ status: 'PROCESSING', amount: 80 }],
      }) },
      refundRequest: { create },
    });
    const actor = { ...OWNER, permissions: ['refund:create:tenant'] };
    await expect(new PaymentsService(prisma).requestRefund('payment-1', 30, 'Không vượt số dư', null, actor))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
    await expect(new PaymentsService(prisma).requestRefund('payment-1', 20, 'Phần số dư còn lại', null, actor))
      .resolves.toMatchObject({ id: 'refund-next' });
  });
  test('branch-scoped collector cannot collect another branch payment', async () => {
    const prisma = transactionalPrisma({
      booking: { findUnique: jest.fn().mockResolvedValue({
        id: 'booking-1', branchId: 'branch-2', status: 'COMPLETED',
        totalAmount: 100, finalAmount: 100, payments: [], branch: { businessId: 'biz-1' },
      }) },
    });
    await expect(
      new PaymentsService(prisma).collect('booking-1', 'CASH', RECEPTIONIST),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  test.each(['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'])('collector creates a paid cash payment for %s without START being required', async status => {
    const create = jest.fn().mockResolvedValue({ id: 'payment-1', status: 'PAID' });
    const prisma = transactionalPrisma({
      booking: { findUnique: jest.fn().mockResolvedValue({
        id: 'booking-1', branchId: 'branch-1', status,
        totalAmount: 100, finalAmount: 90, payments: [], branch: { businessId: 'biz-1' },
      }) },
      payment: { create },
    });
    await expect(
      new PaymentsService(prisma).collect('booking-1', 'CASH', RECEPTIONIST),
    ).resolves.toMatchObject({ status: 'PAID' });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ amount: 90, status: 'PAID' }),
    }));
  });

  test('refund request cannot exceed remaining paid amount', async () => {
    const prisma = transactionalPrisma({
      payment: { findUnique: jest.fn().mockResolvedValue({
        id: 'payment-1', amount: 100, status: 'PARTIALLY_REFUNDED',
        booking: { branch: { businessId: 'biz-1' } },
        refundRequests: [{ amount: 80, status: 'REFUNDED' }],
      }) },
    });
    await expect(
      new PaymentsService(prisma).requestRefund('payment-1', 30, 'adjustment', null, OWNER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  test('pending refunds reserve the remaining refundable amount', async () => {
    const prisma = transactionalPrisma({
      payment: { findUnique: jest.fn().mockResolvedValue({
        id: 'payment-1', amount: 100, status: 'PAID',
        booking: { branch: { businessId: 'biz-1' } },
        refundRequests: [{ amount: 80, status: 'PENDING' }],
      }) },
    });
    await expect(
      new PaymentsService(prisma).requestRefund('payment-1', 30, 'second request', null, OWNER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  test('requester cannot approve their own refund', async () => {
    const prisma = {
      refundRequest: { findUnique: jest.fn().mockResolvedValue({
        id: 'refund-1', status: 'PENDING', requestedBy: OWNER.id,
        payment: {
          booking: { branch: { businessId: 'biz-1' } },
          refundRequests: [],
        },
      }) },
    } as unknown as PrismaService;
    await expect(
      new PaymentsService(prisma).reviewRefund('refund-1', true, undefined, OWNER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('unimplemented payment providers are rejected honestly', async () => {
    const prisma = transactionalPrisma({});
    await expect(
      new PaymentsService(prisma).collect('booking-1', 'MOMO', RECEPTIONIST),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  test('customer cannot self-confirm a cash payment', async () => {
    const prisma = transactionalPrisma({
      paymentIntent: { findUnique: jest.fn() },
      paymentTransaction: {},
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          branchId: 'branch-1',
          status: 'CONFIRMED',
          totalAmount: 100,
          finalAmount: 100,
          payments: [],
          paymentTransactions: [],
          branch: { businessId: 'biz-1' },
          customer: { userId: CUSTOMER.id },
        }),
      },
    });

    await expect(
      new PaymentsService(prisma).collect('booking-1', 'CASH', CUSTOMER, {
        idempotencyKey: 'customer-cash-attempt',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('owner cannot query another tenant package purchases', async () => {
    const prisma = transactionalPrisma({
      packagePurchase: { findMany: jest.fn() },
    });

    await expect(
      new PaymentsService(prisma).listPackagePurchases(OWNER, 'biz-2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('concurrent refund review uses a conditional state transition', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const prisma = {
      refundRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'refund-1', status: 'PENDING', requestedBy: 'another-user',
          payment: { booking: { branch: { businessId: 'biz-1' } }, refundRequests: [] },
        }),
        updateMany,
      },
    } as unknown as PrismaService;

    await expect(
      new PaymentsService(prisma).reviewRefund('refund-1', true, undefined, OWNER),
    ).rejects.toThrow('Refund đã được xử lý');
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'refund-1', status: 'PENDING' } }),
    );
  });

  test('refund processing starts without claiming that money was settled', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const findUnique = jest.fn()
      .mockResolvedValueOnce({ paymentId: 'payment-1' })
      .mockResolvedValueOnce({
        id: 'refund-1',
        paymentId: 'payment-1',
        amount: 40,
        status: 'APPROVED',
        payment: {
          amount: 100,
          method: 'CASH',
          booking: { branch: { businessId: 'biz-1' } },
          refundRequests: [],
        },
      });
    const prisma = transactionalPrisma({
      refundRequest: {
        findUnique,
        updateMany,
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'refund-1',
          status: 'PROCESSING',
        }),
      },
    });

    await expect(
      new PaymentsService(prisma).processRefund(
        'refund-1',
        { action: 'START' },
        PLATFORM_ADMIN,
      ),
    ).resolves.toMatchObject({ status: 'PROCESSING' });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'refund-1', status: 'APPROVED' },
      data: expect.objectContaining({
        status: 'PROCESSING',
        processingStartedAt: expect.any(Date),
        processedBy: PLATFORM_ADMIN.id,
      }),
    });
  });

  test('processing refund requires settlement evidence before marking refunded', async () => {
    const refund = {
      id: 'refund-1',
      paymentId: 'payment-1',
      amount: 40,
      status: 'PROCESSING',
      payment: {
        amount: 100,
        method: 'BANK_TRANSFER',
        booking: { branch: { businessId: 'biz-1' } },
        refundRequests: [],
      },
    };
    const prisma = transactionalPrisma({
      refundRequest: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ paymentId: 'payment-1' })
          .mockResolvedValueOnce(refund),
      },
    });

    await expect(
      new PaymentsService(prisma).processRefund(
        'refund-1',
        { action: 'CONFIRM' },
        PLATFORM_ADMIN,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  test('settlement reference completes refund and updates payment ledger state', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const paymentUpdate = jest.fn().mockResolvedValue({
      id: 'payment-1',
      status: 'PARTIALLY_REFUNDED',
    });
    const prisma = transactionalPrisma({
      refundRequest: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ paymentId: 'payment-1' })
          .mockResolvedValueOnce({
            id: 'refund-1',
            paymentId: 'payment-1',
            amount: 40,
            status: 'PROCESSING',
            payment: {
              amount: 100,
              method: 'BANK_TRANSFER',
              booking: { branch: { businessId: 'biz-1' } },
              refundRequests: [],
            },
          }),
        updateMany,
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'refund-1',
          status: 'REFUNDED',
        }),
      },
      payment: { update: paymentUpdate },
    });

    await expect(
      new PaymentsService(prisma).processRefund(
        'refund-1',
        { action: 'CONFIRM', settlementReference: 'BANK-TRACE-001' },
        PLATFORM_ADMIN,
      ),
    ).resolves.toMatchObject({ status: 'REFUNDED' });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'refund-1', status: 'PROCESSING' },
      data: expect.objectContaining({
        status: 'REFUNDED',
        settlementReference: 'BANK-TRACE-001',
        processedAt: expect.any(Date),
      }),
    });
    expect(paymentUpdate).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: { status: 'PARTIALLY_REFUNDED' },
    });
  });
});
