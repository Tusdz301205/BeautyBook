import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
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

describe('media reference protection', () => {
  it.each(['legal', 'shared'])('rejects %s references before detaching or deleting the file', async (kind) => {
    const tx: Record<string, { count?: jest.Mock; delete?: jest.Mock; updateMany?: jest.Mock }> = {};
    for (const table of ['businessDocumentVersion','branchDocumentVersion','user','business','businessImage','branchImage','serviceImage','comboImage','staffImage']) tx[table] = { count: jest.fn().mockResolvedValue(0), updateMany: jest.fn() };
    if (kind === 'legal') tx.businessDocumentVersion.count!.mockResolvedValue(1);
    else tx.serviceImage.count!.mockResolvedValue(2);
    tx.mediaFile={delete:jest.fn()};
    const prisma = { mediaFile:{findUnique:jest.fn().mockResolvedValue({id:'media',visibility:'PUBLIC',businessId:'biz'})}, $transaction:jest.fn((fn)=>fn(tx)) };
    const service=new MediaService(prisma as never,{get:jest.fn()} as never);
    await expect(service.remove('media',{roles:['PLATFORM_ADMIN']} as AuthUser)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.mediaFile.delete).not.toHaveBeenCalled();
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });
});
