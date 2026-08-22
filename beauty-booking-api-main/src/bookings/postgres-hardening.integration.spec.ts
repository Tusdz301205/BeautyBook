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

const postgresDescribe = process.env.RUN_POSTGRES_INTEGRATION === '1' ? describe : describe.skip;

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
    const createdIds = outcomes
      .filter((outcome): outcome is PromiseFulfilledResult<{ id: string }> => outcome.status === 'fulfilled')
      .map((outcome) => outcome.value.id);

    try {
      expect(createdIds).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
    } finally {
      await prisma.booking.deleteMany({ where: { id: { in: createdIds } } });
    }
  });

  test('two concurrent booking requests for one staff/slot create exactly one reservation', async () => {
    const fixture = await prisma.staffProfile.findFirst({
      where: {
        status: 'ACTIVE', deletedAt: null, branch: { status: 'ACTIVE', deletedAt: null },
        workingHours: { some: { isOff: false } },
        staffServices: { some: { service: { status: 'ACTIVE', deletedAt: null } } },
      },
      include: {
        branch: { include: { workingHours: true } },
        workingHours: { where: { isOff: false }, orderBy: { dayOfWeek: 'asc' } },
        staffServices: { where: { service: { status: 'ACTIVE', deletedAt: null } }, include: { service: true } },
      },
    });
    const customers = await prisma.customerProfile.findMany({ take: 2, select: { id: true } });
    const working = fixture?.workingHours.find((item) => {
      const branchDay = fixture.branch.workingHours.find((entry) => entry.dayOfWeek === item.dayOfWeek);
      return !branchDay || !branchDay.isClosed;
    });
    if (!fixture || customers.length < 2 || !working || !fixture.staffServices[0]) {
      throw new Error('Integration fixture requires active staff/service and two customers');
    }
    const serviceRow = fixture.staffServices[0].service;
    const branchHour = await prisma.branchWorkingHour.findUnique({
      where: { branchId_dayOfWeek: { branchId: fixture.branchId, dayOfWeek: working.dayOfWeek } },
    });
    const firstStartMinutes = Math.max(
      timeValueMinutes(working.startTime),
      branchHour && !branchHour.isClosed ? timeValueMinutes(branchHour.openTime) : 0,
    );
    const now = new Date();
    const appointmentDay = Array.from({ length: 27 }, (_, index) => {
      const value = new Date(now);
      value.setUTCDate(value.getUTCDate() + index + 2);
      return value;
    }).find((value) => value.getUTCDay() === working.dayOfWeek);
    if (!appointmentDay) throw new Error('Cannot resolve integration appointment day');
    const lastEndMinutes = Math.min(
      timeValueMinutes(working.endTime),
      branchHour && !branchHour.isClosed ? timeValueMinutes(branchHour.closeTime) : 24 * 60,
    );
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
        // Keep scanning to avoid staff breaks and other date-aware closures.
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
    );
    const payload = {
      branchId: fixture.branchId,
      serviceIds: [serviceRow.id],
      staffId: fixture.id,
      appointmentDate: start.toISOString(),
      source: 'ONLINE_WEB' as const,
    };
    const outcomes = await Promise.allSettled([
      bookings.create({ ...payload, customerId: customers[0].id }),
      bookings.create({ ...payload, customerId: customers[1].id }),
    ]);
    const createdIds = outcomes
      .filter((outcome): outcome is PromiseFulfilledResult<{ id: string }> => outcome.status === 'fulfilled')
      .map((outcome) => outcome.value.id);
    try {
      if (createdIds.length !== 1) {
        const reasons = outcomes.map((outcome) => outcome.status === 'rejected'
          ? String(outcome.reason?.message ?? outcome.reason)
          : `fulfilled:${outcome.value.id}`);
        throw new Error(`Expected exactly one reservation; outcomes: ${reasons.join(' | ')}`);
      }
      expect(createdIds).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
    } finally {
      await prisma.notification.deleteMany({ where: { relatedBookingId: { in: createdIds } } });
      await prisma.booking.deleteMany({ where: { id: { in: createdIds } } });
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
      expect(result.data.every((item) => item.canonicalServiceId === target.id)).toBe(true);
    } finally {
      await prisma.canonicalService.delete({ where: { id: alias.id } });
    }
  });
});
