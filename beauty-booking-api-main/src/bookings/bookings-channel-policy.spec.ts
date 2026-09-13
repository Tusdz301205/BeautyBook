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
  } as never, {
    previewRedemption: jest.fn().mockResolvedValue({ discount: 0 }),
  } as never);
  jest.spyOn(service, 'expirePendingHolds').mockResolvedValue(0);
  const request = {
    customerId: 'customer-1', createdBy: 'receptionist-1', branchId: 'branch-1',
    serviceIds: ['service-1'], appointmentDate: '2099-07-22T02:00:00.000Z', source,
  };
  return { service, request, prisma, tx };
}

describe('Booking creation channel policy', () => {
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
