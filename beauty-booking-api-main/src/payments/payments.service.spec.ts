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

  test('collector creates a paid cash payment for completed booking', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'payment-1', status: 'PAID' });
    const prisma = transactionalPrisma({
      booking: { findUnique: jest.fn().mockResolvedValue({
        id: 'booking-1', branchId: 'branch-1', status: 'COMPLETED',
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
