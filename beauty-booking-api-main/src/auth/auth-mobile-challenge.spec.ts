import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

describe('mobile business challenge labels', () => {
  const roles = ['A', 'B'].map((businessId) => ({ businessId, branchId: null, expiresAt: null,
    role: { code: 'BUSINESS_OWNER' } }));
  function setup() {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ id: 'owner', isActive: true,
      passwordHash: bcrypt.hashSync('correct', 4), userRoles: roles }), update: jest.fn() },
      business: { findMany: jest.fn().mockResolvedValue([{ id: 'A', name: 'Business A' }, { id: 'B', name: 'Business B' }]) } };
    return { prisma, service: new AuthService(prisma as any, {} as any, {} as any, {} as any, {} as any) };
  }
  it('adds only authorized id/name labels after verified credentials while retaining businessIds', async () => {
    const { service, prisma } = setup();
    await expect(service.login('owner@test', 'correct', { workspace: 'SALON' })).rejects.toMatchObject({ status: 400,
      response: { code: 'BUSINESS_REQUIRED', businessIds: ['A', 'B'], businesses: [
        { id: 'A', name: 'Business A' }, { id: 'B', name: 'Business B' },
      ] } });
    expect(prisma.business.findMany).toHaveBeenCalledWith({ where: { id: { in: ['A', 'B'] }, deletedAt: null },
      select: { id: true, name: true } });
  });
  it('never loads/discloses labels for an incorrect password', async () => {
    const { service, prisma } = setup();
    await expect(service.login('owner@test', 'incorrect', { workspace: 'SALON' })).rejects.toMatchObject({ status: 401 });
    expect(prisma.business.findMany).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
