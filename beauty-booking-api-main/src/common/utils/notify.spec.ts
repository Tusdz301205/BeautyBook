import { businessOwnerRecipientIds, notifySalonMembers } from './notify';

describe('business governance notification recipients', () => {
  it('selects active unexpired tenant owner grants and deduplicates recipients', async () => {
    const db = { userRole: { findMany: jest.fn().mockResolvedValue([{ userId: 'owner' }, { userId: 'owner' }]) } };
    await expect(businessOwnerRecipientIds(db as never, 'business-a')).resolves.toEqual(['owner']);
    expect(db.userRole.findMany).toHaveBeenCalledWith({
      where: {
        businessId: 'business-a', branchId: null, role: { code: 'BUSINESS_OWNER' },
        user: { isActive: true, deletedAt: null },
        OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) as unknown } }],
      }, select: { userId: true },
    });
  });

  it('does not fall back to old membership metadata when there is no active owner grant', async () => {
    const db = {
      userRole: { findMany: jest.fn().mockResolvedValue([]) },
      salonMember: { findMany: jest.fn().mockResolvedValue([{ userId: 'former-owner' }]) },
    };
    await expect(businessOwnerRecipientIds(db as never, 'business-a')).resolves.toEqual([]);
    expect(db.salonMember.findMany).not.toHaveBeenCalled();
  });
});

describe('booking notification recipient scopes', () => {
  it('uses current role assignments, affected branch and deduplicated users', async () => {
    const db = {
      booking: { findUnique: jest.fn().mockResolvedValue({ branchId: 'branch-a', branch: { businessId: 'business-a' } }) },
      userRole: { findMany: jest.fn().mockResolvedValue([{ userId: 'owner' }, { userId: 'owner' }, { userId: 'receptionist-a' }]) },
      salonMember: { findMany: jest.fn() }, notification: { createMany: jest.fn() },
    };
    await notifySalonMembers(db as never, 'business-a', 'BOOKING_UPDATED' as never, 'Booking changed', '', 'booking-a');
    expect(db.userRole.findMany).toHaveBeenCalledWith({
      where: {
        businessId: 'business-a', user: { isActive: true, deletedAt: null },
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) as unknown } }] },
          { OR: [
            { role: { code: 'BUSINESS_OWNER' }, branchId: null },
            { role: { code: 'RECEPTIONIST' }, branchId: 'branch-a' },
          ] },
        ],
      }, select: { userId: true },
    });
    expect(db.salonMember.findMany).not.toHaveBeenCalled();
    expect(db.notification.createMany).toHaveBeenCalledWith({ data: [
      expect.objectContaining({ userId: 'owner' }),
      expect.objectContaining({ userId: 'receptionist-a' }),
    ] });
  });

  it('never leaks a booking through a mismatched business notification', async () => {
    const db = {
      booking: { findUnique: jest.fn().mockResolvedValue({ branchId: 'other', branch: { businessId: 'other' } }) },
      userRole: { findMany: jest.fn() }, notification: { createMany: jest.fn() },
    };
    await notifySalonMembers(db as never, 'business-a', 'BOOKING_UPDATED' as never, '', '', 'booking-other');
    expect(db.userRole.findMany).not.toHaveBeenCalled();
    expect(db.notification.createMany).not.toHaveBeenCalled();
  });
});
