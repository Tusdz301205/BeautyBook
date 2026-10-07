import { BookingsService } from './bookings.service';
import * as validation from './bookings.validation';
import type { BookingLeadContext } from './booking-lead-policy';

describe('Available slots respect the same advance policy as booking creation', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-21T02:00:00.000Z'));
    jest.spyOn(validation, 'validateStaffForService').mockResolvedValue(undefined as never);
  });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
  function fixture(min = 2, max = 1, anyStaff = false, context?: BookingLeadContext, allowed = true, closed = false, noStaff = false) {
    const staff = { id: 'staff', branchId: 'branch', status: 'ACTIVE', isBookable: true, userId: null, staffServices: [{ serviceId: 'service' }] };
    const prisma = {
      branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch', bookingPolicy: { allowWalkIn: allowed, allowCounterBooking: allowed } }) },
      branchServiceOffering: { findMany: jest.fn().mockResolvedValue([{ id: 'service', durationMinutes: 30 }]) },
      serviceVariant: { findMany: jest.fn().mockResolvedValue([{ id: 'quote-variant', serviceId: 'service',
        priceType: 'QUOTE', durationMinutes: 45, bufferBeforeMinutes: 10, bufferAfterMinutes: 5 }]) },
      branchHoliday: { findUnique: jest.fn().mockResolvedValue(null) },
      specialWorkingDay: { findFirst: jest.fn().mockResolvedValue(null) },
      branchWorkingHour: { findUnique: jest.fn().mockResolvedValue({ openTime: new Date('1970-01-01T09:00:00Z'), closeTime: new Date('1970-01-01T12:00:00Z'), isClosed: closed }) },
      staffProfile: { findUnique: jest.fn().mockResolvedValue(staff), findMany: jest.fn().mockResolvedValue(noStaff ? [] : [staff]) },
      bookingService: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new BookingsService(prisma as never, {} as never, {} as never, { getEffective: jest.fn().mockResolvedValue({ minBookingLeadTimeHours: min, maxAdvanceBookingDays: max }) } as never, {} as never);
    jest.spyOn(service, 'expirePendingHolds').mockResolvedValue(0);
    return (date = '2026-09-21', variantSelections?: Record<string, string>) => service.getAvailableSlots({
      branchId: 'branch', staffId: anyStaff ? null : 'staff', serviceIds: ['service'], date, variantSelections,
    }, context);
  }
  it.each([false, true])('filters starts below two hours, retaining exact boundary (any staff=%s)', async anyStaff => {
    const result = await fixture(2, 1, anyStaff)();
    expect(result.slots.map(s => s.start)).toEqual(['2026-09-21T04:00:00.000Z', '2026-09-21T04:30:00.000Z']);
  });
  it('accepts exact maximum advance boundary, excludes later starts', async () => {
    const result = await fixture()('2026-09-22');
    expect(result.slots.map(s => s.start)).toEqual(['2026-09-22T02:00:00.000Z']);
  });
  it('returns no slots beyond the maximum booking horizon', async () => {
    expect((await fixture()('2026-09-23')).slots).toEqual([]);
  });
  it('zero lead time still rejects the current instant and past starts', async () => {
    const result = await fixture(0)();
    expect(result.slots[0].start).toBe('2026-09-21T02:30:00.000Z');
  });
  it('authorized counter offers the next slot while retaining strict future and horizon limits', async () => {
    const slots = fixture(2, 1, false, { authorizedCounter: true, source: 'WALK_IN' });
    expect((await slots()).slots[0].start).toBe('2026-09-21T02:01:00.000Z');
    expect((await slots()).slots.some(slot => slot.start === '2026-09-21T02:30:00.000Z')).toBe(true);
    expect((await slots('2026-09-23')).slots).toEqual([]);
  });
  it('counter channel policy still blocks near-now discovery', async () => {
    await expect(fixture(2, 1, false, { authorizedCounter: true, source: 'WALK_IN' }, false)())
      .rejects.toThrow('khách vãng lai');
  });
  it('source alone never grants the counter exception', async () => {
    expect((await fixture(2, 1, false, { authorizedCounter: false, source: 'WALK_IN' })()).slots[0].start)
      .toBe('2026-09-21T04:00:00.000Z');
  });
  it('retains the exact two-hour boundary and rejects it thirty seconds later', async () => {
    const slots = fixture();
    jest.setSystemTime(new Date('2026-09-21T02:00:30.000Z'));
    expect((await slots()).slots[0].start).toBe('2026-09-21T04:30:00.000Z');
  });
  it('returns serverNow for normal and early empty responses', async () => {
    const expectedNow = new Date('2026-09-21T02:00:00Z');
    expect((await fixture()()).serverNow).toEqual(expectedNow);
    expect((await fixture()('2026-09-23')).serverNow).toEqual(expectedNow);
    expect(await fixture(2, 1, true, undefined, true, true)()).toMatchObject({ slots: [], serverNow: expectedNow });
    expect(await fixture(2, 1, true, undefined, true, false, true)()).toMatchObject({ slots: [], serverNow: expectedNow });
  });
  it('authorized counter QUOTE variant produces slots using variant duration and buffers', async () => {
    const result = await fixture(2, 1, false, { authorizedCounter: true, source: 'STAFF_CREATED' })(
      '2026-09-21', { service: 'quote-variant' },
    );
    expect(result.totalDuration).toBe(60);
    expect(result.slots[0]).toEqual({ start: '2026-09-21T02:01:00.000Z', end: '2026-09-21T03:01:00.000Z' });
    expect(validation.validateStaffForService).toHaveBeenCalledWith(expect.anything(), 'staff', 'service',
      new Date('2026-09-21T02:01:00Z'), new Date('2026-09-21T03:01:00Z'), 'branch');
  });
  it.each([undefined, { authorizedCounter: false, source: 'WALK_IN' } as BookingLeadContext])(
    'public or untrusted QUOTE variant discovery still rejects (%#)', async context => {
      await expect(fixture(2, 1, false, context)('2026-09-21', { service: 'quote-variant' }))
        .rejects.toThrow('cần báo giá trước khi đặt trực tuyến');
      expect(validation.validateStaffForService).not.toHaveBeenCalled();
    },
  );
});
