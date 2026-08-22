import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MediaService } from './media.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';

const OWNER: AuthUser = {
  id: 'owner-1',
  email: 'owner@example.com',
  roles: ['BUSINESS_OWNER'],
  scopes: [{ code: 'BUSINESS_OWNER', businessId: 'biz-1' }],
  sessionType: 'salon',
  permissions: ['legal_document:read:tenant', 'legal_document:delete:tenant'],
};

function serviceWith() {
  const prisma = {
    business: { findFirst: jest.fn() },
    branch: { findFirst: jest.fn(), findUnique: jest.fn() },
    branchServiceOffering: { findFirst: jest.fn() },
    combo: { findFirst: jest.fn() },
    staffProfile: { findFirst: jest.fn() },
    salonMember: { findMany: jest.fn().mockResolvedValue([]) },
    businessOwnerProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    user: { findUnique: jest.fn() },
  };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  return { media: new MediaService(prisma as never, config as never), prisma };
}

describe('MediaService entity-derived tenant scope', () => {
  it('rejects a client business id that does not match the target service', async () => {
    const { media, prisma } = serviceWith();
    prisma.branchServiceOffering.findFirst.mockResolvedValue({
      branchId: 'branch-2',
      branch: { businessId: 'biz-2' },
    });

    await expect((media as any).resolveScope(OWNER, {
      entityType: 'SERVICE_IMAGE',
      entityId: 'service-of-biz-2',
      businessId: 'biz-1',
      branchId: 'branch-2',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a cross-tenant target even when no scope ids are supplied', async () => {
    const { media, prisma } = serviceWith();
    prisma.branch.findFirst.mockResolvedValue({ id: 'branch-2', businessId: 'biz-2' });
    prisma.branch.findUnique.mockResolvedValue({ businessId: 'biz-2' });

    await expect((media as any).resolveScope(OWNER, {
      entityType: 'BRANCH_IMAGE',
      entityId: 'branch-2',
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('derives the legal-document tenant from entityId', async () => {
    const { media, prisma } = serviceWith();
    prisma.business.findFirst.mockResolvedValue({ id: 'biz-1' });

    await expect((media as any).resolveScope(OWNER, {
      entityType: 'LEGAL_DOCUMENT',
      entityId: 'biz-1',
    })).resolves.toEqual({ businessId: 'biz-1', branchId: null });
  });
});
