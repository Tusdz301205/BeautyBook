import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { MailService } from '../mail/mail.service';
import type { PrismaService } from '../prisma/prisma.service';
import { StaffInvitationsService } from './staff-invitations.service';

describe('StaffInvitationsService', () => {
  const mail = { sendMail: jest.fn().mockResolvedValue(undefined) } as unknown as MailService;
  const config = { get: jest.fn().mockReturnValue('https://app.example.test') } as unknown as ConfigService;

  beforeEach(() => jest.clearAllMocks());

  it('rejects a branch from another business', async () => {
    const prisma = {
      staffProfile: { findFirst: jest.fn().mockResolvedValue({
        id: 'staff-1', userId: null, branchId: 'branch-b', branch: { businessId: 'business-b' },
      }) },
    } as unknown as PrismaService;
    const service = new StaffInvitationsService(prisma, mail, config);

    await expect(service.invite({
      staffProfileId: 'staff-1', email: 'staff@example.com', roleCode: 'STAFF', businessId: 'business-a',
      branchId: 'branch-b', invitedBy: 'owner-1',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes email and revokes an older pending invitation', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const create = jest.fn().mockResolvedValue({
      id: 'invite-1', email: 'staff@example.com', expiresAt: new Date(),
    });
    const tx = {
      staffInvitation: { updateMany, create },
      staffProfile: { update: jest.fn().mockResolvedValue({ id: 'staff-1' }) },
    };
    const prisma = {
      staffProfile: { findFirst: jest.fn().mockResolvedValue({
        id: 'staff-1', userId: null, branchId: 'branch-a', branch: { businessId: 'business-a' },
      }) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new StaffInvitationsService(prisma, mail, config);

    await service.invite({
      staffProfileId: 'staff-1', email: ' Staff@Example.COM ', roleCode: 'RECEPTIONIST', businessId: 'business-a',
      branchId: 'branch-a', invitedBy: 'owner-1',
    });

    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ staffProfileId: 'staff-1' }),
    }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ staffProfileId: 'staff-1', email: 'staff@example.com', branchId: 'branch-a' }),
    }));
    expect(mail.sendMail).toHaveBeenCalledWith(
      'staff@example.com', expect.any(String), expect.stringContaining('/accept-invitation?token='),
    );
  });

  it('does not accept an invalid or expired token', async () => {
    const prisma = {
      staffInvitation: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new StaffInvitationsService(prisma, mail, config);

    await expect(service.accept({
      token: 'x'.repeat(64), fullName: 'Test Staff', password: 'Password123!',
    })).rejects.toBeInstanceOf(NotFoundException);
  });
});
