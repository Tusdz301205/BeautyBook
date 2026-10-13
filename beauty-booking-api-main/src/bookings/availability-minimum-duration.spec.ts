import { BadRequestException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import * as validation from './bookings.validation';

type Offering = { id: string; durationMinutes: number };
type Variant = {
  id: string;
  serviceId: string;
  priceType: string;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
};

describe('availability shares booking creation minimum total duration', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-21T01:00:00.000Z'));
    jest.spyOn(validation, 'validateStaffForService').mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  function fixture(offerings: Offering[], anyStaff: boolean, variants: Variant[] = []) {
    const staff = {
      id: 'staff', branchId: 'branch', status: 'ACTIVE', isBookable: true,
      userId: null, staffServices: offerings.map(service => ({ serviceId: service.id })),
    };
    const prisma = {
      branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch' }) },
      branchServiceOffering: { findMany: jest.fn().mockResolvedValue(offerings) },
      serviceVariant: { findMany: jest.fn().mockResolvedValue(variants) },
      branchHoliday: { findUnique: jest.fn().mockResolvedValue(null) },
      specialWorkingDay: { findFirst: jest.fn().mockResolvedValue(null) },
      branchWorkingHour: { findUnique: jest.fn().mockResolvedValue({
        openTime: new Date('1970-01-01T09:00:00Z'),
        closeTime: new Date('1970-01-01T10:00:00Z'), isClosed: false,
      }) },
      staffProfile: {
        findUnique: jest.fn().mockResolvedValue(staff),
        findMany: jest.fn().mockResolvedValue([staff]),
      },
      bookingService: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const policy = { getEffective: jest.fn().mockResolvedValue({
      minBookingLeadTimeHours: 0, maxAdvanceBookingDays: 1,
    }) };
    const service = new BookingsService(
      prisma as never, {} as never, {} as never, policy as never, {} as never,
    );
    jest.spyOn(service, 'expirePendingHolds').mockResolvedValue(0);
    const params = {
      branchId: 'branch', staffId: anyStaff ? null : 'staff',
      serviceIds: offerings.map(offering => offering.id), date: '2026-09-21',
      variantSelections: Object.fromEntries(variants.map(variant => [variant.serviceId, variant.id])),
    };
    return { prisma, policy, serviceIds: params.serviceIds, run: () => service.getAvailableSlots(params) };
  }

  function expectNoHoursOrSlots(h: ReturnType<typeof fixture>) {
    expect(h.prisma.branchHoliday.findUnique).not.toHaveBeenCalled();
    expect(h.prisma.specialWorkingDay.findFirst).not.toHaveBeenCalled();
    expect(h.prisma.branchWorkingHour.findUnique).not.toHaveBeenCalled();
    expect(h.prisma.staffProfile.findUnique).not.toHaveBeenCalled();
    expect(h.prisma.staffProfile.findMany).not.toHaveBeenCalled();
    expect(h.prisma.bookingService.findMany).not.toHaveBeenCalled();
    expect(h.policy.getEffective).not.toHaveBeenCalled();
    expect(validation.validateStaffForService).not.toHaveBeenCalled();
  }

  async function expectFullSlots(h: ReturnType<typeof fixture>, total: number) {
    // Anchor acceptance to the unchanged validator called by create().
    expect(() => validation.assertValidDuration(total)).not.toThrow();
    const result = await h.run();
    expect(result.totalDuration).toBe(total);
    const starts = total === 30 ? ['02:00', '02:30'] : ['02:00'];
    expect(result.slots).toEqual(starts.map(start => {
      const startDate = new Date(`2026-09-21T${start}:00.000Z`);
      return { start: startDate.toISOString(), end: new Date(startDate.getTime() + total * 60000).toISOString() };
    }));
    expect(validation.validateStaffForService).toHaveBeenCalledTimes(starts.length * h.serviceIds.length);
  }

  describe.each([false, true])('any staff=%s', anyStaff => {
    it('rejects a standalone 15-minute service with HTTP 400 before hours or slot generation', async () => {
      const h = fixture([{ id: 'service', durationMinutes: 15 }], anyStaff);
      expect(() => validation.assertValidDuration(15)).toThrow('Slot tối thiểu là 30 phút');
      await expect(h.run()).rejects.toMatchObject({
        status: 400, message: 'Slot tối thiểu là 30 phút',
      });
      expectNoHoursOrSlots(h);
    });

    it('allows duration 1 plus bufferAfter 29 and occupies the full 30 minutes', async () => {
      const h = fixture([{ id: 'service', durationMinutes: 60 }], anyStaff, [{
        id: 'variant', serviceId: 'service', priceType: 'FIXED',
        durationMinutes: 1, bufferBeforeMinutes: 0, bufferAfterMinutes: 29,
      }]);
      await expectFullSlots(h, 30);
      expect(validation.validateStaffForService).toHaveBeenCalledWith(
        h.prisma, 'staff', 'service', new Date('2026-09-21T02:00:00Z'),
        new Date('2026-09-21T02:30:00Z'), 'branch',
      );
    });

    it.each([[15, 15], [20, 25]])('allows combined selected durations %i + %i', async (first, second) => {
      const h = fixture([
        { id: 'first', durationMinutes: first }, { id: 'second', durationMinutes: second },
      ], anyStaff);
      await expectFullSlots(h, first + second);
      for (const serviceId of ['first', 'second']) {
        expect(validation.validateStaffForService).toHaveBeenCalledWith(
          h.prisma, 'staff', serviceId, new Date('2026-09-21T02:00:00Z'),
          new Date(new Date('2026-09-21T02:00:00Z').getTime() + (first + second) * 60000), 'branch',
        );
      }
    });

    it('rejects duration 20 plus bufferAfter 5 before hours or slot generation', async () => {
      const h = fixture([{ id: 'service', durationMinutes: 60 }], anyStaff, [{
        id: 'variant', serviceId: 'service', priceType: 'FIXED',
        durationMinutes: 20, bufferBeforeMinutes: 0, bufferAfterMinutes: 5,
      }]);
      expect(() => validation.assertValidDuration(25)).toThrow('Slot tối thiểu là 30 phút');
      await expect(h.run()).rejects.toMatchObject({ status: 400, message: 'Slot tối thiểu là 30 phút' });
      expectNoHoursOrSlots(h);
    });

    it('preserves zero-duration HTTP 400 and the existing availability message', async () => {
      const h = fixture([{ id: 'service', durationMinutes: 0 }], anyStaff);
      await expect(h.run()).rejects.toBeInstanceOf(BadRequestException);
      await expect(h.run()).rejects.toMatchObject({ status: 400, message: 'Tổng thời lượng dịch vụ phải > 0' });
      expectNoHoursOrSlots(h);
    });
  });
});
