import { auditProviderReassignment } from './booking-provider-audit';
import { BadRequestException } from '@nestjs/common';

describe('Immutable provider identity snapshots', () => {
  it('records old/new provider users under the authenticated operator, independent of later profile links', async () => {
    const tx = { staffProfile: { findMany: jest.fn().mockResolvedValue([{ id: 'old', userId: 'old-user' }, { id: 'new', userId: 'new-user' }]) },
      bookingServiceAdjustment: { count: jest.fn().mockResolvedValue(2), create: jest.fn().mockResolvedValue({}) } };
    await auditProviderReassignment(tx as never, { id: 'item', bookingId: 'booking', staffId: 'old', status: 'SCHEDULED', revision: 4 }, 'new', 'operator', 'Approved reassignment');
    expect(tx.bookingServiceAdjustment.create).toHaveBeenCalledTimes(1);
    const created: unknown = (tx.bookingServiceAdjustment.create.mock.calls as readonly (readonly unknown[])[])[0][0];
    expect(created).toMatchObject({ data: { actorId: 'operator', action: 'REASSIGN', version: 3,
      beforeSnapshot: { status: 'SCHEDULED', staffId: 'old', staffUserId: 'old-user', revision: 4 },
      afterSnapshot: { status: 'SCHEDULED', staffId: 'new', staffUserId: 'new-user', revision: 5 }, amountDelta: 0 } });
  });
  it('does not invent a provider change and rejects changes without operator attribution', async () => {
    const tx = { staffProfile: { findMany: jest.fn() }, bookingServiceAdjustment: { create: jest.fn() } };
    const item = { id: 'item', bookingId: 'booking', staffId: 'same', status: 'SCHEDULED', revision: 1 };
    await auditProviderReassignment(tx as never, item, 'same', undefined, 'No change');expect(tx.staffProfile.findMany).not.toHaveBeenCalled();
    await expect(auditProviderReassignment(tx as never, item, 'new', undefined, 'Missing actor')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.bookingServiceAdjustment.create).not.toHaveBeenCalled();
  });
});
