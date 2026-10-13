import { ForbiddenException } from '@nestjs/common';
import { ChangeRequestsService } from './change-requests.service';
import { notifySalonMembers } from '../common/utils/notify';

jest.mock('../common/utils/notify', () => ({ notifySalonMembers: jest.fn().mockResolvedValue(undefined) }));
const deadline = new Date('2026-10-13T06:00:00Z');
function setup() {
  const booking = { id: 'booking', status: 'PENDING', pendingExpiresAt: deadline,
    deletedAt: null, customerId: 'customer', customer: { userId: 'customer-user' },
    branchId: 'branch', branch: { businessId: 'business' }, updatedAt: deadline,
    appointmentDate: new Date('2026-10-17T00:00:00Z'), appointmentStartTime: new Date('1970-01-01T09:00:00Z'),
    bookingServices: [{ status: 'SCHEDULED' }] };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    booking: { findUnique: jest.fn().mockImplementation(async () => ({ ...booking, bookingServices: [...booking.bookingServices] })), updateMany: jest.fn() },
    appointmentChangeRequest: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }), create: jest.fn().mockResolvedValue({ id: 'new-request' }) },
  };
  const prisma = { ...tx, $transaction: jest.fn(async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx)) };
  const settings = { getEffective: jest.fn().mockResolvedValue({ allowRescheduleRequests: true, maxRescheduleCountPerBooking: 2 }) };
  const scheduler = { notifyBookingUpdated: jest.fn() };
  const service = new ChangeRequestsService(prisma as never, settings as never, {} as never, scheduler as never);
  const run = (requestType: 'RESCHEDULE' | 'STAFF_CHANGE' | 'CANCEL', actor = 'customer-user') => service.create('booking', actor, 'CUSTOMER', {
    requestType, proposedStartTime: '2026-10-17T04:00:00Z', proposedEndTime: '2026-10-17T04:30:00Z', proposedStaffId: 'staff', reason: 'QA request',
  });
  const noWrites = () => { expect(tx.appointmentChangeRequest.updateMany).not.toHaveBeenCalled(); expect(tx.appointmentChangeRequest.create).not.toHaveBeenCalled();
    expect(tx.booking.updateMany).not.toHaveBeenCalled(); expect(notifySalonMembers).not.toHaveBeenCalled(); expect(scheduler.notifyBookingUpdated).not.toHaveBeenCalled(); };
  return { booking, tx, run, noWrites };
}

describe('expired unserved hold cannot receive a new scheduling request', () => {
  beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers().setSystemTime(deadline); });
  afterEach(() => jest.useRealTimers());
  for (const requestType of ['RESCHEDULE', 'STAFF_CHANGE'] as const) {
    test.each([-1, 0, 1])(`${requestType} respects deadline offset %s`, async offset => {
      jest.setSystemTime(deadline.getTime() + offset); const f = setup();
      if (offset < 0) await expect(f.run(requestType)).resolves.toEqual({ id: 'new-request' });
      else { await expect(f.run(requestType)).rejects.toMatchObject({ response: { code: 'PENDING_HOLD_EXPIRED' } }); f.noWrites(); }
    });
    test(`${requestType} checks the clock after the parent lock`, async () => {
      jest.setSystemTime(deadline.getTime() - 1); const f = setup();
      f.tx.$queryRaw.mockImplementation(async () => { jest.setSystemTime(deadline); return []; });
      await expect(f.run(requestType)).rejects.toMatchObject({ response: { code: 'PENDING_HOLD_EXPIRED' } }); f.noWrites();
    });
    test.each(['IN_PROGRESS', 'COMPLETED'])(`${requestType} preserves current sibling %s evidence`, async status => {
      const f = setup(); f.booking.bookingServices.push({ status });
      await expect(f.run(requestType)).resolves.toEqual({ id: 'new-request' });
    });
    test(`${requestType} does not invent a legacy deadline`, async () => {
      const f = setup(); Object.assign(f.booking, { pendingExpiresAt: null });
      await expect(f.run(requestType)).resolves.toEqual({ id: 'new-request' });
    });
  }
  test('ordinary cancellation request remains available for the future booking', async () => {
    await expect(setup().run('CANCEL')).resolves.toEqual({ id: 'new-request' });
  });
  test('foreign customer still receives the authorization error before deadline details', async () => {
    const f = setup(); await expect(f.run('RESCHEDULE', 'foreign-user')).rejects.toBeInstanceOf(ForbiddenException); f.noWrites();
  });
});
