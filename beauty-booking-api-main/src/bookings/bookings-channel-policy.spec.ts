import { ConflictException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

jest.mock('./bookings.validation', () => ({
  ...jest.requireActual('./bookings.validation'),
  validateStaffForService: jest.fn().mockResolvedValue(undefined),
}));

function fixture(source: 'WALK_IN' | 'PHONE' | 'STAFF_CREATED') {
  const allowed = { allowWalkIn: true, allowCounterBooking: true };
  const currentBranch = { bookingPolicy: { ...allowed } };
  const tx = {
    recurringBookingPlan: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    branch: { findFirst: jest.fn().mockResolvedValue(currentBranch) },
    booking: { create: jest.fn() },
    bookingService: { findFirst: jest.fn() },
  };
  const prisma = {
    branchServiceOffering: { findMany: jest.fn().mockResolvedValue([{ id: 'service-1', price: 100000, durationMinutes: 60 }]) },
    serviceDependency: { findMany: jest.fn().mockResolvedValue([]) },
    servicePriceRule: { findMany: jest.fn().mockResolvedValue([]) },
    branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch-1', businessId: 'business-1', bookingPolicy: allowed }) },
    branchHoliday: { findFirst: jest.fn().mockResolvedValue(null) },
    specialWorkingDay: { findFirst: jest.fn().mockResolvedValue(null) },
    staffProfile: { findMany: jest.fn().mockResolvedValue([{ id: 'staff-1', staffServices: [{ serviceId: 'service-1' }] }]) },
    $transaction: jest.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)),
  };
  const service = new BookingsService(prisma as never, {} as never, {} as never, {
    getEffective: jest.fn().mockResolvedValue({ minBookingLeadTimeHours: 0, maxAdvanceBookingDays: 100000 }),
    getConfigured: jest.fn().mockResolvedValue({}),
  } as never, {
    quote: jest.fn().mockResolvedValue({ finalAmount: 100000 }),
  } as never);
  jest.spyOn(service, 'expirePendingHolds').mockResolvedValue(0);
  const request = {
    customerId: 'customer-1', createdBy: 'receptionist-1', branchId: 'branch-1',
    serviceIds: ['service-1'], appointmentDate: '2099-07-22T02:00:00.000Z', source,
  };
  return { service, request, prisma, tx };
}

describe('Booking creation channel policy', () => {
  describe('lead-time boundaries before transactional availability checks', () => {
    beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-10-06T12:00:00Z')));
    afterEach(() => jest.useRealTimers());
    function leadFixture() {
      const setup = fixture('WALK_IN');
      (setup.service as any).platformSettings.getEffective.mockResolvedValue({ minBookingLeadTimeHours: 2, maxAdvanceBookingDays: 1 });
      return setup;
    }
    it('exact 19:00 to 21:00 reaches the transaction; thirty seconds later fails lead validation', async () => {
      const { service, request, prisma } = leadFixture();
      const data = { ...request, source: 'ONLINE_WEB' as const, appointmentDate: '2026-10-06T14:00:00Z', recurringPlanId: 'stopped' };
      // The existing stopped-plan fence deliberately prevents writes after advance validation.
      await expect(service.create(data)).rejects.toThrow('đã dừng tạo');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      jest.setSystemTime(new Date('2026-10-06T12:00:30Z'));
      await expect(service.create(data)).rejects.toThrow('Cần đặt trước');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
    it('authorized near-now walk-in passes lead validation; source alone fails', async () => {
      const { service, request } = leadFixture();
      const data = { ...request, appointmentDate: '2026-10-06T12:01:00Z', recurringPlanId: 'stopped' };
      await expect(service.create(data)).rejects.toThrow('Cần đặt trước');
      await expect(service.create(data, { authorizedCounter: true })).rejects.toThrow('đã dừng tạo');
    });
    it('counter exemption retains strict future and maximum horizon checks', async () => {
      const { service, request } = leadFixture();
      for (const appointmentDate of ['2026-10-06T11:59:59Z', '2026-10-06T12:00:00Z']) {
        await expect(service.create({ ...request, appointmentDate }, { authorizedCounter: true })).rejects.toThrow('tương lai');
      }
      await expect(service.create({ ...request, appointmentDate: '2026-10-08T12:00:00Z' }, { authorizedCounter: true })).rejects.toThrow('tối đa');
    });
    it('authorized near-now counter still obeys disabled branch channel policy', async () => {
      const { service, request, prisma } = leadFixture();
      prisma.branch.findFirst.mockResolvedValue({ id: 'branch-1', businessId: 'business-1', bookingPolicy: { allowWalkIn: false, allowCounterBooking: false } });
      await expect(service.create({ ...request, appointmentDate: '2026-10-06T12:01:00Z' }, { authorizedCounter: true })).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
    function transactionFixture(clockAtQuote: string, clockAtCatalog = clockAtQuote) {
      const setup = leadFixture();
      const catalog = { id: 'service-1', price: 100000, durationMinutes: 60,
        businessServiceId: 'business-service-1', updatedAt: new Date('2026-10-01T00:00:00Z') };
      setup.prisma.branchServiceOffering.findMany.mockResolvedValue([catalog]);
      (setup.service as any).pricingEngine.quote.mockImplementation(async () => {
        jest.setSystemTime(new Date(clockAtQuote));
        return { finalAmount: 100000 };
      });
      Object.assign(setup.tx, {
        $queryRaw: jest.fn().mockResolvedValue([]),
        branchServiceOffering: { findMany: jest.fn().mockImplementation(async () => {
          jest.setSystemTime(new Date(clockAtCatalog));
          return [catalog];
        }) },
        customerBookingPolicy: { upsert: jest.fn().mockResolvedValue({}), findUnique: jest.fn().mockResolvedValue(null) },
        bookingViolationEvent: { findMany: jest.fn().mockResolvedValue([]) },
      });
      // Stop at the reservation lookup so this test cannot create any booking.
      setup.tx.bookingService.findFirst.mockRejectedValue(new Error('reservation reached'));
      return setup;
    }
    it('rechecks online lead after time advances during quoting', async () => {
      const { service, request, prisma, tx } = transactionFixture('2026-10-06T12:00:30Z');
      await expect(service.create({ ...request, source: 'ONLINE_WEB', appointmentDate: '2026-10-06T14:00:00Z' }))
        .rejects.toThrow('Cần đặt trước');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(tx.bookingService.findFirst).not.toHaveBeenCalled();
      expect(tx.booking.create).not.toHaveBeenCalled();
    });
    it.each(['2026-10-06T12:01:00Z', '2026-10-06T12:01:01Z'])(
      'rejects counter start becoming current/past during transactional catalog work (%s)', async time => {
        const { service, request, prisma, tx } = transactionFixture('2026-10-06T12:00:30Z', time);
        await expect(service.create({ ...request, appointmentDate: '2026-10-06T12:01:00Z' }, { authorizedCounter: true }))
          .rejects.toThrow('tương lai');
        expect(prisma.$transaction).toHaveBeenCalled();
        expect(tx.bookingService.findFirst).not.toHaveBeenCalled();
        expect(tx.booking.create).not.toHaveBeenCalled();
      },
    );
    it('still permits authorized counter reservation below online lead when it remains future', async () => {
      const { service, request, tx } = transactionFixture('2026-10-06T12:00:30Z');
      await expect(service.create({ ...request, appointmentDate: '2026-10-06T12:01:00Z' }, { authorizedCounter: true }))
        .rejects.toThrow('reservation reached');
      expect(tx.bookingService.findFirst).toHaveBeenCalled();
    });
    it('still permits reservation at the exact online boundary', async () => {
      const { service, request, tx } = transactionFixture('2026-10-06T12:00:00Z');
      await expect(service.create({ ...request, source: 'ONLINE_WEB', appointmentDate: '2026-10-06T14:00:00Z' }))
        .rejects.toThrow('reservation reached');
      expect(tx.bookingService.findFirst).toHaveBeenCalled();
    });
  });
  it('checks the recurring plan fence inside the booking transaction before inserting an occurrence', async () => {
    const { service, request, prisma, tx } = fixture('PHONE');
    await expect(service.create({ ...request, recurringPlanId: 'recovered-plan' })).rejects.toThrow('đã dừng tạo');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.recurringBookingPlan.updateMany).toHaveBeenCalledWith({
      where: { id: 'recovered-plan', customerId: request.customerId, branchId: request.branchId, status: 'CREATING', deletedAt: null },
      data: { updatedAt: expect.any(Date), createdOccurrenceCount: { increment: 1 } },
    });
    expect(tx.booking.create).not.toHaveBeenCalled();
    expect(tx.branch.findFirst).not.toHaveBeenCalled();
  });
  it.each(['WALK_IN', 'PHONE', 'STAFF_CREATED'] as const)('rejects direct service creation for disabled %s', async (source) => {
    const { service, request, prisma, tx } = fixture(source);
    prisma.branch.findFirst.mockResolvedValue({ id: 'branch-1', businessId: 'business-1', bookingPolicy: { allowWalkIn: false, allowCounterBooking: false } });
    await expect(service.create(request)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it.each(['WALK_IN', 'PHONE', 'STAFF_CREATED'] as const)('rechecks %s when policy changes during quote/availability calculation', async (source) => {
    const { service, request, tx } = fixture(source);
    tx.branch.findFirst.mockResolvedValue({ bookingPolicy: { allowWalkIn: false, allowCounterBooking: false } });
    await expect(service.create(request)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.branch.findFirst).toHaveBeenCalled();
    expect(tx.booking.create).not.toHaveBeenCalled();
    expect(tx.bookingService.findFirst).not.toHaveBeenCalled();
  });

  it('rejects creation when the branch closes after the initial availability check', async () => {
    const { service, request, tx } = fixture('PHONE');
    tx.branch.findFirst.mockResolvedValue(null as any);
    await expect(service.create(request)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.booking.create).not.toHaveBeenCalled();
  });
});
