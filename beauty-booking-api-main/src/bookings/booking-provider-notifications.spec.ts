import { queueProviderReassignment } from './booking-provider-notifications';

const change = { bookingId: 'booking', itemId: 'item', eventId: 'event', previousStaffId: 'old', nextStaffId: 'new' };
function fixture(profiles = [{ id: 'old', userId: 'old-user' }, { id: 'new', userId: 'new-user' }], grants = [{ userId: 'old-user' }, { userId: 'new-user' }, { userId: 'new-user' }]) {
  const tx = {
    booking: { findUniqueOrThrow: jest.fn().mockResolvedValue({ branchId: 'branch', branch: { businessId: 'business' } }) },
    staffProfile: { findMany: jest.fn().mockResolvedValue(profiles) },
    userRole: { findMany: jest.fn().mockResolvedValue(grants) },
    notificationOutbox: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
  };
  return tx;
}
describe('provider reassignment durable notices', () => {
  test('notifies old/new current scoped users once without exposing customer or reason', async () => {
    const tx = fixture();
    await queueProviderReassignment(tx as never, change);
    const payload = tx.notificationOutbox.createMany.mock.calls[0][0];
    expect(payload).toMatchObject({ skipDuplicates: true, data: [
      { userId: 'old-user', title: 'Phân công dịch vụ đã thay đổi', dedupeKey: 'provider-reassignment:event:old-user', targetId: 'booking' },
      { userId: 'new-user', title: 'Bạn được phân công dịch vụ', dedupeKey: 'provider-reassignment:event:new-user', metadata: { bookingServiceId: 'item' } },
    ] });
    expect(JSON.stringify(payload)).not.toMatch(/customer|phone|email|reason/);
    expect(payload.data.every(row => !('relatedBookingId' in row))).toBe(true);
    expect(tx.staffProfile.findMany.mock.calls[0][0].where).toMatchObject({ status: 'ACTIVE', deletedAt: null, user: { isActive: true, deletedAt: null } });
    expect(tx.userRole.findMany.mock.calls[0][0].where).toMatchObject({ businessId: 'business', userId: { in: ['old-user', 'new-user'] }, AND: [
      { OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }] },
      { OR: [{ role: { code: 'STAFF' }, branchId: 'branch' }, { role: { code: 'BUSINESS_OWNER' }, branchId: null }] },
    ] });
  });
  test('no permission grants means no notice, not a fallback to legacy membership', async () => {
    const tx = fixture(undefined, []);
    await queueProviderReassignment(tx as never, change);
    expect(tx.notificationOutbox.createMany).not.toHaveBeenCalled();
  });
  test('unlinked or inactive profiles produce no recipient', async () => {
    const tx = fixture([]);
    await queueProviderReassignment(tx as never, change);
    expect(tx.userRole.findMany).not.toHaveBeenCalled(); expect(tx.notificationOutbox.createMany).not.toHaveBeenCalled();
  });
  test('same provider is not a reassignment event', async () => {
    const tx = fixture();
    await queueProviderReassignment(tx as never, { ...change, nextStaffId: 'old' });
    expect(tx.booking.findUniqueOrThrow).not.toHaveBeenCalled();
  });
  test('first assignment only notifies current new staff and uses its event key', async () => {
    const tx = fixture([{ id: 'new', userId: 'new-user' }], [{ userId: 'new-user' }]);
    await queueProviderReassignment(tx as never, { ...change, previousStaffId: null });
    expect(tx.staffProfile.findMany.mock.calls[0][0].where.id).toEqual({ in: ['new'] });
    expect(tx.notificationOutbox.createMany.mock.calls[0][0].data).toHaveLength(1);
  });
  test('outbox failure remains inside the caller transaction', async () => {
    const tx = fixture(), fault = new Error('QA outbox fault');
    tx.notificationOutbox.createMany.mockRejectedValue(fault);
    await expect(queueProviderReassignment(tx as never, change)).rejects.toBe(fault);
  });
});
