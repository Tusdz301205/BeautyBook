import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('account-token and session recovery', () => {
  const tokenRecord = { id: 'token-1', userId: 'user-1', usedAt: null };

  function setup() {
    const tx = {
      accountToken: {
        findFirst: jest.fn().mockResolvedValue(tokenRecord),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        update: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      userSession: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
      userSession: { findFirst: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const blacklist = { revokeAllForUser: jest.fn().mockRejectedValue(new Error('Redis down')) };
    const service = new AuthService(
      prisma as any,
      { verifyAsync: jest.fn() } as any,
      { get: jest.fn().mockReturnValue('secret') } as any,
      {} as any,
      blacklist as any,
    );
    return { service, tx, prisma, blacklist };
  }

  it('consumes a reset token and revokes DB sessions in the password transaction even with Redis down', async () => {
    const { service, tx, prisma, blacklist } = setup();
    await expect(service.resetPassword('fixture-token', 'NewPassword123')).resolves.toEqual({ ok: true, requiresLogin: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.accountToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'token-1', type: 'PASSWORD_RESET', usedAt: null }),
    }));
    expect(tx.userSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1', revokedAt: null },
    }));
    expect(blacklist.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('does not write password when another request already consumed the token', async () => {
    const { service, tx } = setup();
    tx.accountToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.resetPassword('fixture-token', 'NewPassword123')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.userSession.updateMany).not.toHaveBeenCalled();
  });

  it('propagates a password write failure through the transaction', async () => {
    const { service, tx } = setup();
    tx.user.update.mockRejectedValue(new Error('DB write failed'));
    await expect(service.resetPassword('fixture-token', 'NewPassword123')).rejects.toThrow('DB write failed');
    expect(tx.userSession.updateMany).not.toHaveBeenCalled();
  });

  it('reports a DB outage during refresh as transient, without claiming the old token', async () => {
    const { service, prisma } = setup();
    (service as any).jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', sessionId: 'session-1' });
    prisma.userSession.findFirst.mockRejectedValue(new Error('DB unavailable'));
    await expect(service.refresh('fixture-refresh')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects sessionless refresh tokens because they cannot be revoked durably', async () => {
    const { service, prisma } = setup();
    (service as any).jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' });
    await expect(service.refresh('fixture-refresh')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.userSession.findFirst).not.toHaveBeenCalled();
  });
});
