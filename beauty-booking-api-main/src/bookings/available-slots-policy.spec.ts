import { BookingsService } from './bookings.service';
import * as validation from './bookings.validation';

describe('Available slots respect the same advance policy as booking creation', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-21T02:00:00.000Z'));
    jest.spyOn(validation, 'validateStaffForService').mockResolvedValue(undefined as never);
  });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
  function fixture(min = 2, max = 1, anyStaff = false) {
    const staff = { id: 'staff', branchId: 'branch', status: 'ACTIVE', isBookable: true, userId: null, staffServices: [{ serviceId: 'service' }] };
    const prisma = {
      branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch' }) },
      branchServiceOffering: { findMany: jest.fn().mockResolvedValue([{ id: 'service', durationMinutes: 30 }]) },
      branchHoliday: { findUnique: jest.fn().mockResolvedValue(null) },
      specialWorkingDay: { findFirst: jest.fn().mockResolvedValue(null) },
      branchWorkingHour: { findUnique: jest.fn().mockResolvedValue({ openTime: new Date('1970-01-01T09:00:00Z'), closeTime: new Date('1970-01-01T12:00:00Z'), isClosed: false }) },
      staffProfile: { findUnique: jest.fn().mockResolvedValue(staff), findMany: jest.fn().mockResolvedValue([staff]) },
      bookingService: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new BookingsService(prisma as never, {} as never, {} as never, { getEffective: jest.fn().mockResolvedValue({ minBookingLeadTimeHours: min, maxAdvanceBookingDays: max }) } as never, {} as never, {} as never);
    jest.spyOn(service, 'expirePendingHolds').mockResolvedValue(0);
    return (date = '2026-09-21') => service.getAvailableSlots({ branchId: 'branch', staffId: anyStaff ? null : 'staff', serviceIds: ['service'], date });
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
});
