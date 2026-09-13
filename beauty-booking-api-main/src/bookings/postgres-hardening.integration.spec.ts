import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { normalizeAppointmentForStorage, zonedDateTimeToInstant } from '../common/utils/booking-datetime';
import { PaymentsService } from '../payments/payments.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { ServicesService } from '../services/services.service';
import { assertCustomerNotDoubleBooked, assertNoOverlap, validateStaffForService } from './bookings.validation';
import { BookingsService } from './bookings.service';
import { timeValueMinutes } from '../common/utils/booking-datetime';
import { withSerializableTransaction } from '../common/utils/serializable-transaction';
import { PricingEngineService } from '../promotions/pricing-engine.service';
import { LoyaltyService } from '../loyalty/loyalty.service';

const postgresDescribe = process.env.RUN_POSTGRES_INTEGRATION === '1' ? describe : describe.skip;

if (process.env.RUN_POSTGRES_INTEGRATION === '1') {
  const database = new URL(process.env.DATABASE_URL ?? '').pathname;
  if (!/(^|[_/])(test|e2e)(_|$)/i.test(database) || process.env.NODE_ENV === 'production') {
    throw new Error('PostgreSQL integration tests require a disposable test/e2e database');
  }
}

function instant(day: number, hour: number): Date {
  return zonedDateTimeToInstant({
    year: 2099,
    month: 7,
    day,
    hour,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
}

postgresDescribe('PostgreSQL hardening integration', () => {
  const prisma = new PrismaService();

  beforeAll(async () => prisma.onModuleInit());
  afterAll(async () => prisma.onModuleDestroy());

  test('date-aware staff/customer overlap accepts different days and adjacent slots', async () => {
    const rollback = new Error('ROLLBACK_EXPECTED');
    try {
      await prisma.$transaction(async (tx) => {
        const staffService = await tx.staffService.findFirst({
          include: {
            staff: { select: { branchId: true } },
            service: {
              select: {
                businessServiceId: true,
                businessService: {
                  select: { canonicalServiceId: true, name: true },
                },
              },
            },
          },
        });
        const customer = await tx.customerProfile.findFirst({ select: { id: true } });
        if (!staffService || !customer) throw new Error('Integration fixture requires staff/service/customer rows');

        const stored = normalizeAppointmentForStorage(instant(15, 9), instant(15, 10));
        const booking = await tx.booking.create({
          data: {
            bookingCode: `IT-DATETIME-${randomUUID()}`,
            customerId: customer.id,
            branchId: staffService.staff.branchId,
            status: 'CONFIRMED',
            totalAmount: 1,
            ...stored,
          },
        });
        await tx.bookingService.create({
          data: {
            bookingId: booking.id,
            serviceId: staffService.serviceId,
            businessServiceId: staffService.service.businessServiceId,
            canonicalServiceId: staffService.service.businessService.canonicalServiceId,
            staffId: staffService.staffId,
            priceAtBooking: 1,
            durationMinutes: 60,
            serviceNameSnapshot: staffService.service.businessService.name,
          },
        });

        const client = tx as unknown as PrismaService;
        await expect(
          assertNoOverlap(client, staffService.staffId, null, instant(16, 9), instant(16, 10)),
        ).resolves.toBeUndefined();
        await expect(
          assertNoOverlap(client, staffService.staffId, null, instant(15, 10), instant(15, 11)),
        ).resolves.toBeUndefined();
        await expect(
          assertNoOverlap(client, staffService.staffId, null, instant(15, 9), instant(15, 10)),
        ).rejects.toBeInstanceOf(ConflictException);
        await expect(
          assertCustomerNotDoubleBooked(client, customer.id, null, instant(15, 9), instant(15, 10)),
        ).rejects.toBeInstanceOf(ConflictException);
        const otherProvider = await tx.staffProfile.findFirst({
          where: { id: { not: staffService.staffId }, status: 'ACTIVE', deletedAt: null },
          select: { id: true },
        });
        if (!otherProvider) throw new Error('Integration fixture requires two active providers');
        await expect(
          assertNoOverlap(client, otherProvider.id, null, instant(15, 9), instant(15, 10)),
        ).resolves.toBeUndefined();

        await tx.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });
        await expect(
          assertNoOverlap(client, staffService.staffId, null, instant(15, 9), instant(15, 10)),
        ).resolves.toBeUndefined();
        await expect(
          assertCustomerNotDoubleBooked(client, customer.id, null, instant(15, 9), instant(15, 10)),
        ).resolves.toBeUndefined();
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  test('two concurrent collection attempts settle exactly one payment', async () => {
    const fixture = await prisma.booking.findFirst({
      select: { customerId: true, branchId: true, branch: { select: { businessId: true } } },
    });
    if (!fixture) throw new Error('Integration fixture requires at least one booking');

    const booking = await prisma.booking.create({
      data: {
        bookingCode: `IT-PAYMENT-${randomUUID()}`,
        customerId: fixture.customerId,
        branchId: fixture.branchId,
        status: 'COMPLETED',
        totalAmount: 100,
        finalAmount: 100,
        ...normalizeAppointmentForStorage(instant(20, 9), instant(20, 10)),
      },
    });
    const actor: AuthUser = {
      id: randomUUID(),
      email: 'postgres-integration@example.test',
      roles: ['RECEPTIONIST'],
      scopes: [{
        code: 'RECEPTIONIST',
        businessId: fixture.branch.businessId,
        branchId: fixture.branchId,
      }],
      sessionType: 'salon',
    };

    try {
      const service = new PaymentsService(prisma);
      const outcomes = await Promise.allSettled([
        service.collect(booking.id, 'CASH', actor),
        service.collect(booking.id, 'CASH', actor),
      ]);
      expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
      expect(
        await prisma.payment.count({
          where: {
            bookingId: booking.id,
            status: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
          },
        }),
      ).toBe(1);
    } finally {
      const immutableLedgerExists = await prisma.financialLedgerEntry.findFirst({
        where: { bookingId: booking.id },
        select: { id: true },
      });
      // A successful collection creates immutable accounting evidence. The
      // integration suite runs only on a disposable database, so retain that
      // evidence instead of weakening or bypassing the production trigger.
      if (!immutableLedgerExists) {
        await prisma.refundRequest.deleteMany({ where: { payment: { bookingId: booking.id } } });
        await prisma.payment.deleteMany({ where: { bookingId: booking.id } });
        await prisma.booking.delete({ where: { id: booking.id } });
      }
    }
  });

  test('two concurrent bookings for one customer/slot create exactly one hold', async () => {
    const fixture = await prisma.booking.findFirst({
      select: { customerId: true, branchId: true },
    });
    if (!fixture) throw new Error('Integration fixture requires at least one booking');

    const interval = normalizeAppointmentForStorage(
      instant(22, 9),
      instant(22, 10),
    );
    const outcomes = await Promise.allSettled([
      prisma.booking.create({
        data: {
          bookingCode: `IT-CUSTOMER-${randomUUID()}`,
          customerId: fixture.customerId,
          branchId: fixture.branchId,
          status: 'PENDING',
          totalAmount: 1,
          ...interval,
        },
      }),
      prisma.booking.create({
        data: {
          bookingCode: `IT-CUSTOMER-${randomUUID()}`,
          customerId: fixture.customerId,
          branchId: fixture.branchId,
          status: 'PENDING',
          totalAmount: 1,
          ...interval,
        },
      }),
    ]);
    const createdIds = outcomes.flatMap((outcome) => outcome.status === 'fulfilled' ? [outcome.value.id] : []);

    try {
      expect(createdIds).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
    } finally {
      await prisma.booking.deleteMany({ where: { id: { in: createdIds } } });
    }
  });

  test.each([
    [5, 'ONLINE_WEB'],
    [10, 'STAFF_CREATED'],
  ] as const)(
    '%i concurrent %s booking requests for one provider/slot create exactly one reservation',
    async (requestCount, source) => {
    const fixture = await prisma.staffProfile.findFirst({
      where: {
        status: 'ACTIVE',
        isBookable: true,
        deletedAt: null,
        branch: {
          status: 'ACTIVE',
          deletedAt: null,
          workingHours: { some: { isClosed: false } },
        },
        staffServices: {
          some: { service: { status: 'ACTIVE', bookable: true, deletedAt: null } },
        },
      },
      include: {
        branch: {
          include: {
            workingHours: {
              where: { isClosed: false },
              orderBy: { dayOfWeek: 'asc' },
            },
          },
        },
        staffServices: {
          where: { service: { status: 'ACTIVE', bookable: true, deletedAt: null } },
          include: { service: true },
        },
      },
    });
    const customers = await prisma.customerProfile.findMany({
      take: requestCount,
      select: { id: true },
    });
    const working = fixture?.branch.workingHours[0];
    if (!fixture || customers.length < requestCount || !working || !fixture.staffServices[0]) {
      throw new Error(`Integration fixture requires an active provider/service and ${requestCount} customers`);
    }
    const serviceRow = fixture.staffServices[0].service;
    const firstStartMinutes = timeValueMinutes(working.openTime);
    const now = new Date();
    const appointmentDay = Array.from({ length: 27 }, (_, index) => {
      const value = new Date(now);
      value.setUTCDate(value.getUTCDate() + index + 2);
      return value;
    }).find((value) => value.getUTCDay() === working.dayOfWeek);
    if (!appointmentDay) throw new Error('Cannot resolve integration appointment day');
    const lastEndMinutes = timeValueMinutes(working.closeTime);
    let start: Date | undefined;
    for (let startMinutes = firstStartMinutes; startMinutes + serviceRow.durationMinutes <= lastEndMinutes; startMinutes += 30) {
      const candidate = zonedDateTimeToInstant({
        year: appointmentDay.getUTCFullYear(),
        month: appointmentDay.getUTCMonth() + 1,
        day: appointmentDay.getUTCDate(),
        hour: Math.floor(startMinutes / 60), minute: startMinutes % 60,
        second: 0, millisecond: 0,
      });
      try {
        await validateStaffForService(
          prisma, fixture.id, serviceRow.id, candidate,
          new Date(candidate.getTime() + serviceRow.durationMinutes * 60_000), fixture.branchId,
        );
        start = candidate;
        break;
      } catch {
        // Keep scanning to avoid branch closures and existing reservations.
      }
    }
    if (!start) throw new Error('Cannot resolve a valid integration appointment slot');
    const mail = { sendBookingConfirmation: jest.fn(), sendBookingCancellation: jest.fn() };
    const gateway = { notifyBookingCreated: jest.fn(), notifyBookingUpdated: jest.fn() };
    const bookings = new BookingsService(
      prisma,
      mail as never,
      gateway as never,
      new PlatformSettingsService(prisma),
      new PricingEngineService(prisma),
      new LoyaltyService(prisma),
    );
    const payload = {
      branchId: fixture.branchId,
      serviceIds: [serviceRow.id],
      staffId: fixture.id,
      appointmentDate: start.toISOString(),
      source,
    };
    const outcomes = await Promise.allSettled(
      customers.map((customer) => bookings.create({ ...payload, customerId: customer.id })),
    );
    const createdIds = outcomes.flatMap((outcome) => outcome.status === 'fulfilled' ? [outcome.value.id] : []);
    try {
      if (createdIds.length !== 1) {
        const reasons = outcomes.map((outcome) => outcome.status === 'rejected'
          ? String(outcome.reason?.message ?? outcome.reason)
          : `fulfilled:${outcome.value.id}`);
        throw new Error(`Expected exactly one reservation; outcomes: ${reasons.join(' | ')}`);
      }
      expect(createdIds).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(requestCount - 1);
      expect(await prisma.bookingService.count({
        where: {
          staffId: fixture.id,
          status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
          itemStartAt: { lt: new Date(start.getTime() + serviceRow.durationMinutes * 60_000) },
          itemEndAt: { gt: start },
          booking: {
            deletedAt: null,
            status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] },
          },
        },
      })).toBe(1);
    } finally {
      await prisma.notification.deleteMany({ where: { relatedBookingId: { in: createdIds } } });
      await prisma.booking.deleteMany({ where: { id: { in: createdIds } } });
    }
    },
  );

  test('a concurrent reschedule and create for one provider/slot have exactly one winner', async () => {
    const staffService = await prisma.staffService.findFirst({
      where: {
        staff: { status: 'ACTIVE', isBookable: true, deletedAt: null },
        service: { status: 'ACTIVE', bookable: true, deletedAt: null },
      },
      include: {
        staff: { select: { branchId: true } },
        service: {
          select: {
            businessServiceId: true,
            businessService: { select: { canonicalServiceId: true, name: true } },
          },
        },
      },
    });
    const customers = await prisma.customerProfile.findMany({ take: 2, select: { id: true } });
    if (!staffService || customers.length < 2) {
      throw new Error('Integration fixture requires one provider/service and two customers');
    }

    const oldInterval = normalizeAppointmentForStorage(instant(23, 8), instant(23, 9));
    const targetStart = instant(24, 10);
    const targetEnd = instant(24, 11);
    const targetInterval = normalizeAppointmentForStorage(targetStart, targetEnd);
    const codeA = `IT-RESCHEDULE-A-${randomUUID()}`;
    const codeB = `IT-RESCHEDULE-B-${randomUUID()}`;
    const bookingA = await prisma.booking.create({
      data: {
        bookingCode: codeA,
        customerId: customers[0].id,
        branchId: staffService.staff.branchId,
        status: 'CONFIRMED',
        totalAmount: 1,
        ...oldInterval,
      },
    });
    const itemA = await prisma.bookingService.create({
      data: {
        bookingId: bookingA.id,
        serviceId: staffService.serviceId,
        businessServiceId: staffService.service.businessServiceId,
        canonicalServiceId: staffService.service.businessService.canonicalServiceId,
        staffId: staffService.staffId,
        priceAtBooking: 1,
        durationMinutes: 60,
        serviceNameSnapshot: staffService.service.businessService.name,
        itemStartAt: instant(23, 8),
        itemEndAt: instant(23, 9),
      },
    });

    try {
      const outcomes = await Promise.allSettled([
        withSerializableTransaction(prisma, async (tx) => {
          await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${bookingA.id} FOR UPDATE`;
          await tx.bookingService.update({
            where: { id: itemA.id },
            data: { itemStartAt: targetStart, itemEndAt: targetEnd },
          });
          return tx.booking.update({
            where: { id: bookingA.id },
            data: targetInterval,
          });
        }),
        withSerializableTransaction(prisma, async (tx) => {
          const bookingB = await tx.booking.create({
            data: {
              bookingCode: codeB,
              customerId: customers[1].id,
              branchId: staffService.staff.branchId,
              status: 'CONFIRMED',
              totalAmount: 1,
              ...targetInterval,
            },
          });
          await tx.bookingService.create({
            data: {
              bookingId: bookingB.id,
              serviceId: staffService.serviceId,
              businessServiceId: staffService.service.businessServiceId,
              canonicalServiceId: staffService.service.businessService.canonicalServiceId,
              staffId: staffService.staffId,
              priceAtBooking: 1,
              durationMinutes: 60,
              serviceNameSnapshot: staffService.service.businessService.name,
              itemStartAt: targetStart,
              itemEndAt: targetEnd,
            },
          });
          return bookingB;
        }),
      ]);

      expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
      expect(await prisma.bookingService.count({
        where: {
          staffId: staffService.staffId,
          itemStartAt: { lt: targetEnd },
          itemEndAt: { gt: targetStart },
          booking: {
            deletedAt: null,
            status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] },
          },
        },
      })).toBe(1);

      if (outcomes[0].status === 'rejected') {
        const unchanged = await prisma.booking.findUniqueOrThrow({ where: { id: bookingA.id } });
        expect(unchanged.appointmentDate).toEqual(oldInterval.appointmentDate);
        expect(unchanged.appointmentStartTime).toEqual(oldInterval.appointmentStartTime);
        expect(unchanged.appointmentEndTime).toEqual(oldInterval.appointmentEndTime);
      }
    } finally {
      await prisma.booking.deleteMany({ where: { bookingCode: { in: [codeA, codeB] } } });
    }
  });

  test('concurrent refund requests cannot reserve more than the paid amount', async () => {
    const fixture = await prisma.booking.findFirst({
      select: { customerId: true, branchId: true, branch: { select: { businessId: true } } },
    });
    if (!fixture) throw new Error('Integration fixture requires at least one booking');

    const booking = await prisma.booking.create({
      data: {
        bookingCode: `IT-REFUND-${randomUUID()}`,
        customerId: fixture.customerId,
        branchId: fixture.branchId,
        status: 'COMPLETED',
        totalAmount: 100,
        finalAmount: 100,
        ...normalizeAppointmentForStorage(instant(21, 9), instant(21, 10)),
      },
    });
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: 100,
        method: 'CASH',
        status: 'PAID',
        paidAt: new Date(),
      },
    });
    const actor: AuthUser = {
      id: randomUUID(),
      email: 'postgres-refund@example.test',
      roles: ['BUSINESS_OWNER'],
      scopes: [{
        code: 'BUSINESS_OWNER',
        businessId: fixture.branch.businessId,
        branchId: null,
      }],
      sessionType: 'salon',
    };

    try {
      const service = new PaymentsService(prisma);
      const outcomes = await Promise.allSettled([
        service.requestRefund(payment.id, 80, 'integration request A', null, actor),
        service.requestRefund(payment.id, 80, 'integration request B', null, actor),
      ]);
      expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
      const reserved = await prisma.refundRequest.aggregate({
        where: { paymentId: payment.id, status: { in: ['PENDING', 'APPROVED', 'REFUNDED'] } },
        _sum: { amount: true },
      });
      expect(Number(reserved._sum.amount)).toBe(80);
    } finally {
      await prisma.refundRequest.deleteMany({ where: { paymentId: payment.id } });
      await prisma.payment.delete({ where: { id: payment.id } });
      await prisma.booking.delete({ where: { id: booking.id } });
    }
  });

  test('a merged canonical remains searchable through its legacy alias', async () => {
    const target = await prisma.canonicalService.findFirst({
      where: {
        status: 'ACTIVE',
        businessServices: {
          some: {
            status: 'ACTIVE',
            deletedAt: null,
            branchServices: {
              some: {
                status: 'ACTIVE',
                bookable: true,
                deletedAt: null,
                branch: {
                  status: 'ACTIVE',
                  reviewStatus: 'APPROVED',
                  operationalStatus: 'ACTIVE',
                  deletedAt: null,
                  business: {
                    status: { in: ['APPROVED', 'ACTIVE'] },
                    bookingRestrictedAt: null,
                    deletedAt: null,
                  },
                },
                staffServices: {
                  some: {
                    staff: {
                      status: 'ACTIVE',
                      isBookable: true,
                      publicVisible: true,
                      deletedAt: null,
                    },
                  },
                },
              },
            },
          },
        },
      },
      select: { id: true },
    });
    if (!target) throw new Error('Integration fixture requires a public mapped canonical service');

    const suffix = randomUUID().replace(/-/g, '');
    const aliasName = `IntegrationAlias${suffix}`;
    const alias = await prisma.canonicalService.create({
      data: {
        code: `IT_ALIAS_${suffix}`,
        slug: `integration-alias-${suffix}`,
        name: aliasName,
        status: 'MERGED',
        replacementCanonicalId: target.id,
      },
    });

    try {
      const result = await new ServicesService(prisma).search({ query: aliasName, limit: 5 });
      expect(result.data.length).toBeGreaterThan(0);
      for (const item of result.data) expect(item).toMatchObject({ canonicalServiceId: target.id });
    } finally {
      await prisma.canonicalService.delete({ where: { id: alias.id } });
    }
  });
});
