import { ForbiddenException } from '@nestjs/common';
import { BookingsAccessService } from './bookings-access.service';
import { BookingsController } from './bookings.controller';
import { bookingLeadMilliseconds } from './booking-lead-policy';
import type { AuthUser } from '../common/decorators/current-user.decorator';

describe('Counter lead authorization', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-10-06T12:00:00Z')));
  afterEach(() => jest.useRealTimers());
  const customer = { id: 'customer', roles: ['CUSTOMER'], scopes: [{ code: 'CUSTOMER' }], sessionType: 'customer' } as AuthUser;
  const receptionist = { id: 'receptionist', roles: ['RECEPTIONIST'],
    scopes: [{ code: 'RECEPTIONIST', businessId: 'business', branchId: 'branch' }], sessionType: 'salon' } as AuthUser;
  function fixture() {
    const prisma = {
      branch: { findUnique: jest.fn().mockResolvedValue({ businessId: 'business' }) },
      branchBookingPolicy: { findUnique: jest.fn().mockResolvedValue({ allowWalkIn: true, allowCounterBooking: true }) },
      customerProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'customer-profile' }), findFirst: jest.fn().mockResolvedValue({ id: 'customer-profile' }) },
    };
    const service = { getAvailableSlots: jest.fn().mockResolvedValue({ slots: [] }), create: jest.fn().mockResolvedValue({ id: 'booking' }) };
    const access = new BookingsAccessService(prisma as never);
    const controller = new BookingsController(service as never, access, prisma as never,
      {} as never, {} as never, {} as never, {} as never);
    return { controller, service };
  }
  it('19:00 to 21:00 equals the online lead; 19:00:30 is below it', () => {
    const start = new Date('2026-10-06T14:00:00Z').getTime();
    expect(start - Date.now()).toBe(bookingLeadMilliseconds(2));
    jest.setSystemTime(new Date('2026-10-06T12:00:30Z'));
    expect(start - Date.now()).toBeLessThan(bookingLeadMilliseconds(2));
  });
  it('source and DTO flags cannot independently waive online lead', async () => {
    expect(bookingLeadMilliseconds(2, 'WALK_IN')).toBe(7200000);
    expect(bookingLeadMilliseconds(2, 'ONLINE_APP', { authorizedCounter: true })).toBe(7200000);
    const { controller, service } = fixture();
    await controller.create({ branchId: 'branch', customerId: 'other', serviceIds: ['service'],
      appointmentDate: '2026-10-06T14:00:00Z', source: 'WALK_IN', authorizedCounter: true } as any, customer);
    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ source: 'ONLINE_WEB', customerId: 'customer-profile' }), { authorizedCounter: false });
  });
  it('scoped receptionist gets an internal counter context for discovery and creation', async () => {
    const { controller, service } = fixture();
    await controller.getCounterSlots('branch', '', 'service', '2026-10-06', receptionist, undefined, 'WALK_IN');
    expect(service.getAvailableSlots).toHaveBeenCalledWith(expect.anything(), { authorizedCounter: true, source: 'WALK_IN' });
    await controller.create({ branchId: 'branch', customerId: 'customer-profile', serviceIds: ['service'],
      appointmentDate: '2026-10-06T12:01:00Z', source: 'WALK_IN' }, receptionist);
    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ source: 'WALK_IN' }), { authorizedCounter: true });
  });
  it.each([
    customer,
    { ...receptionist, roles: ['STAFF'], scopes: [{ code: 'STAFF', businessId: 'business', branchId: 'branch' }] },
    { ...receptionist, scopes: [{ code: 'RECEPTIONIST', businessId: 'business', branchId: 'foreign' }] },
    { ...receptionist, scopes: [{ code: 'RECEPTIONIST', businessId: 'foreign', branchId: 'branch' }] },
  ] as AuthUser[])('denies counter discovery for unauthorized principal %#', async user => {
    const { controller, service } = fixture();
    await expect(controller.getCounterSlots('branch', '', 'service', '2026-10-06', user))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(service.getAvailableSlots).not.toHaveBeenCalled();
  });
  it('public slots never receive a counter context', async () => {
    const { controller, service } = fixture();
    await controller.getAvailableSlots('branch', '', 'service', '2026-10-06');
    expect(service.getAvailableSlots).toHaveBeenCalledWith(expect.anything());
  });
  it('forwards includeUnresolved to the assigned work-item service', async () => {
    const staffWorkItems = { list: jest.fn().mockResolvedValue({ data: [] }) };
    const controller = new BookingsController({} as never, {} as never, {} as never,
      {} as never, {} as never, {} as never, {} as never, staffWorkItems as never);
    await controller.myWorkItems(receptionist, '2026-10-06', undefined, 'branch', undefined, '1', '20', 'true');
    expect(staffWorkItems.list).toHaveBeenCalledWith(receptionist, expect.objectContaining({ includeUnresolved: 'true' }));
  });
});
