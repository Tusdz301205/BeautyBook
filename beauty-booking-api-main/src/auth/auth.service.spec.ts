import { ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService registration', () => {
  const customerRole = { id: 'role-customer', code: 'CUSTOMER' };
  const createdUser = {
    id: 'user-new',
    email: 'customer@example.com',
    fullName: 'Nguyễn An',
    userRoles: [{ role: customerRole, businessId: null, branchId: null, expiresAt: null }],
  };

  function setup() {
    const tx = {
      user: { create: jest.fn().mockResolvedValue(createdUser) },
      customerProfile: { create: jest.fn().mockResolvedValue({ userId: createdUser.id }) },
      businessOwnerProfile: { create: jest.fn().mockResolvedValue({ id: 'owner-profile-new', userId: createdUser.id }) },
      business: { create: jest.fn().mockResolvedValue({ id: 'business-draft-new', status: 'DRAFT' }) },
      userRole: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      role: { findUnique: jest.fn().mockResolvedValue(customerRole) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new AuthService(
      prisma as any,
      {} as any,
      { get: jest.fn().mockReturnValue('http://localhost:8080') } as any,
      { sendMail: jest.fn().mockResolvedValue(undefined) } as any,
      {} as any,
    );
    jest.spyOn(service as any, 'issueAccountToken').mockResolvedValue('verify-token');
    jest.spyOn(service as any, 'createSession').mockResolvedValue('session-new');
    jest.spyOn(service as any, 'issueTokens').mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    return { service, prisma, tx };
  }

  it('creates a CUSTOMER role and customer profile by default', async () => {
    const { service, prisma, tx } = setup();

    const result = await service.register({
      email: 'CUSTOMER@example.com',
      password: 'Password123',
      fullName: 'Nguyễn An',
    });

    expect(prisma.role.findUnique).toHaveBeenCalledWith({ where: { code: 'CUSTOMER' } });
    expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: 'customer@example.com',
        userRoles: { create: { roleId: 'role-customer' } },
      }),
    }));
    expect(tx.customerProfile.create).toHaveBeenCalledWith({ data: { userId: 'user-new' } });
    expect(result.user.roles).toEqual(['CUSTOMER']);
  });

  it('creates a BUSINESS_OWNER applicant with a non-public draft business', async () => {
    const { service, prisma, tx } = setup();
    const ownerRole = { id: 'role-owner', code: 'BUSINESS_OWNER' };
    const createdOwner = {
      ...createdUser,
      email: 'owner@example.com',
      userRoles: [{ role: ownerRole, businessId: null, branchId: null, expiresAt: null }],
    };
    prisma.role.findUnique.mockResolvedValueOnce(ownerRole);
    tx.user.create.mockResolvedValueOnce(createdOwner);

    const result = await service.register({
      email: 'owner@example.com',
      password: 'Password123',
      fullName: 'Chủ cơ sở mới',
      accountType: 'BUSINESS_OWNER',
    });

    expect(prisma.role.findUnique).toHaveBeenCalledWith({ where: { code: 'BUSINESS_OWNER' } });
    expect(tx.businessOwnerProfile.create).toHaveBeenCalledWith({ data: { userId: 'user-new' } });
    expect(tx.business.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ownerId: 'owner-profile-new', status: 'DRAFT', onboardingStep: 1 }),
    }));
    expect(tx.userRole.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { businessId: 'business-draft-new' },
    }));
    expect(tx.customerProfile.create).not.toHaveBeenCalled();
    expect(result.user.roles).toEqual(['BUSINESS_OWNER']);
    expect(result.user.scopes[0]).toEqual(expect.objectContaining({ businessId: 'business-draft-new' }));
  });

  it('returns a conflict for an existing email', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'existing-user' });

    await expect(service.register({
      email: 'customer@example.com',
      password: 'Password123',
      fullName: 'Nguyễn An',
    })).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('AuthService logout', () => {
  it('revokes the current persistent session and records a logout event', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const auditCreate = jest.fn().mockResolvedValue({ id: 'audit-1' });
    const service = new AuthService(
      {
        userSession: { updateMany },
        auditLog: { create: auditCreate },
      } as any,
      {} as any,
      { get: jest.fn() } as any,
      {} as any,
      { revokeAllForUser: jest.fn() } as any,
    );

    await expect(service.logout('user-1', 'session-1')).resolves.toEqual({
      ok: true,
      revokedCount: 1,
    });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1', revokedAt: null, id: 'session-1' },
    }));
    expect(auditCreate).toHaveBeenCalled();
  });
});
