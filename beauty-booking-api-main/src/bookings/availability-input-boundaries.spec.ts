import { BadRequestException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

function harness() {
  const service = Object.create(BookingsService.prototype) as BookingsService;
  const expire = jest.fn().mockResolvedValue(undefined);
  const holiday = jest.fn().mockResolvedValue(null);
  const prisma = {
    branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch' }) },
    branchServiceOffering: { findMany: jest.fn().mockResolvedValue([{ id: 'service', durationMinutes: 30 }]) },
    serviceVariant: { findMany: jest.fn().mockResolvedValue([]) },
    branchHoliday: { findUnique: holiday },
    specialWorkingDay: { findFirst: jest.fn().mockResolvedValue(null) },
    branchWorkingHour: { findUnique: jest.fn().mockResolvedValue({ isClosed: true }) },
  };
  Object.assign(service, { prisma, expirePendingHolds: expire });
  return { service, expire, prisma, holiday };
}
const base = { branchId: 'branch', staffId: null, serviceIds: ['service'], date: '2028-02-29' };

describe('availability input boundaries before hold expiry or queries', () => {
  test.each(['2026-02-29', '2026-02-30', '2026-13-01', '2026-00-01', '2026-10-00', '2026-10-32', '2026-2-01', '0000-01-01'])('%s is not a calendar date', async date => {
    const h = harness();
    await expect(h.service.getAvailableSlots({ ...base, date })).rejects.toBeInstanceOf(BadRequestException);
    expect(h.expire).not.toHaveBeenCalled();
    expect(h.prisma.branch.findFirst).not.toHaveBeenCalled();
  });

  test('a real leap day retains its exact calendar day', async () => {
    const h = harness();
    const result = await h.service.getAvailableSlots(base);
    expect(result.slots).toEqual([]);
    expect(h.holiday).toHaveBeenCalledWith({ where: { branchId_date: { branchId: 'branch', date: new Date('2028-02-29T00:00:00.000Z') } } });
  });

  test.each([[], 'invalid', 1, { service: 7 }, { service: {} }, { other: 'variant' }])('rejects malformed variant selection %p before queries', async variantSelections => {
    const h = harness();
    await expect(h.service.getAvailableSlots({ ...base, variantSelections: variantSelections as never })).rejects.toBeInstanceOf(BadRequestException);
    expect(h.expire).not.toHaveBeenCalled();
    expect(h.prisma.branch.findFirst).not.toHaveBeenCalled();
  });

  test('empty variant selection remains the base-service path', async () => {
    const h = harness();
    await expect(h.service.getAvailableSlots({ ...base, variantSelections: {} })).resolves.toMatchObject({ slots: [] });
  });
});
