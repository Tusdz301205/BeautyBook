import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
function fixture(impact = false) {
  let active = true;
  const tx = {
    user: {
      findUnique: jest.fn(async () => ({ id: 'target', isActive: active })),
      updateMany: jest.fn(async ({ data }) => { active = data.isActive; return { count: 1 }; }),
      findUniqueOrThrow: jest.fn(async () => ({ id: 'target', isActive: active })),
    },
    userSession: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-one' }) },
    notificationOutbox: { create: jest.fn().mockResolvedValue({ id: 'outbox-one' }) },
    booking: { count: jest.fn().mockResolvedValue(impact ? 1 : 0) },
    bookingService: { count: jest.fn().mockResolvedValue(0) },
    staffBranchAssignment: { count: jest.fn().mockResolvedValue(0) },
    business: { count: jest.fn().mockResolvedValue(0) },
  };
  const prisma = { ...tx, $transaction: jest.fn(async (fn) => { const before=active; try { return await fn(tx); } catch (error) { active=before; throw error; } }) };
  const blacklist = { revokeAllForUser: jest.fn().mockResolvedValue(undefined) };
  return { service: new UsersService(prisma as never, blacklist as never), tx, prisma, blacklist };
}
const lock = { isActive: false, expectedIsActive: true, acknowledgeImpact: true, reason: 'Kiểm tra quản trị' };
describe('explicit suspension and committed revocation', () => {
  it('locks once and replay never unlocks or creates duplicate audit/outbox', async () => {
    const { service, tx }=fixture();
    expect(await service.suspend('target','admin',lock)).toMatchObject({ isActive: false, stateChanged: true });
    expect(await service.suspend('target','admin',lock)).toMatchObject({ isActive: false, stateChanged: false });
    expect(tx.user.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.notificationOutbox.create).toHaveBeenCalledTimes(1);
    expect(tx.userSession.updateMany).toHaveBeenCalledWith({ where: { userId: 'target', revokedAt: null }, data: { revokedAt: expect.any(Date), refreshTokenHash: null } });
    expect(tx.user.findUnique).not.toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ passwordHash: true }) }));
    expect(tx.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ id: true, isActive: true }) }));
  });
  it('audit failure rolls back state and never revokes outside the transaction', async () => {
    const { service, tx, blacklist }=fixture(); tx.auditLog.create.mockRejectedValueOnce(new Error('Audit unavailable'));
    await expect(service.suspend('target','admin',lock)).rejects.toThrow('Audit unavailable');
    expect(blacklist.revokeAllForUser).not.toHaveBeenCalled();
    await expect(service.suspend('target','admin',lock)).resolves.toMatchObject({ isActive: false, stateChanged: true });
  });
  it('Redis failure after durable session revocation cannot turn a committed lock into retry toggle', async () => {
    const { service, blacklist, tx }=fixture(); blacklist.revokeAllForUser.mockRejectedValue(new Error('Redis unavailable'));
    await expect(service.suspend('target','admin',lock)).resolves.toMatchObject({ isActive: false });
    await expect(service.suspend('target','admin',lock)).resolves.toMatchObject({ isActive: false, stateChanged: false });
    expect(tx.user.updateMany).toHaveBeenCalledTimes(1);
  });
  it('requires explicit acknowledgement of current impact and does not change bookings', async () => {
    const { service, tx }=fixture(true);
    await expect(service.suspend('target','admin',{ ...lock, acknowledgeImpact: false })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    await expect(service.suspend('target','admin',lock)).resolves.toMatchObject({ isActive: false });
    expect(tx.booking.count).toHaveBeenCalled();
  });
  it('rejects missing desired state, string booleans, blank reasons and self administration', async () => {
    const { service, tx }=fixture();
    for(const input of [{ reason: 'old contract' }, { ...lock,isActive:'false' }, { ...lock,reason:' ' }]) {
      await expect(service.suspend('target','admin',input as never)).rejects.toBeInstanceOf(BadRequestException);
    }
    await expect(service.suspend('admin','admin',lock)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });
  it('reopening keeps old sessions revoked', async () => {
    const { service, tx }=fixture(); await service.suspend('target','admin',lock);
    await expect(service.suspend('target','admin',{...lock,isActive:true,expectedIsActive:false})).resolves.toMatchObject({isActive:true});
    expect(tx.userSession.updateMany).toHaveBeenCalledTimes(1);
  });
  it('a concurrent compare-and-set loss never writes audit or outbox', async () => {
    const { service, tx }=fixture(); tx.user.updateMany.mockResolvedValueOnce({count:0});
    await expect(service.suspend('target','admin',lock)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.auditLog.create).not.toHaveBeenCalled();expect(tx.notificationOutbox.create).not.toHaveBeenCalled();
  });
});
