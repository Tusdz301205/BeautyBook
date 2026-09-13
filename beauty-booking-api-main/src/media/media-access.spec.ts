import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { canAccessStoredMedia, MediaAccessRecord } from './media-access';
import { MediaService } from './media.service';

const manager: AuthUser = {
  id: 'manager', email: 'manager@example.test', roles: ['BRANCH_MANAGER'],
  scopes: [{ code: 'BRANCH_MANAGER', businessId: 'biz', branchId: 'branch-a' }], sessionType: 'salon',
};
const file: MediaAccessRecord = { uploadedBy: 'manager', businessId: 'biz', branchId: 'branch-b', visibility: 'PUBLIC' };

describe('Current media scope after membership changes', () => {
  it('denies deleting an image in another branch even when the caller originally uploaded it', () => {
    expect(canAccessStoredMedia(manager, file, 'delete')).toBe(false);
    expect(canAccessStoredMedia(manager, { ...file, uploadedBy: 'other' }, 'delete')).toBe(false);
  });
  it('allows an active member to delete branch media in their current branch', () => {
    expect(canAccessStoredMedia(manager, { ...file, branchId: 'branch-a' }, 'delete')).toBe(true);
  });
  it('denies former/expired membership, even for an uploader', () => {
    expect(canAccessStoredMedia({ ...manager, roles: ['CUSTOMER'], scopes: [{ code: 'CUSTOMER' }] }, file, 'delete')).toBe(false);
    expect(canAccessStoredMedia({ ...manager, scopes: [{ ...manager.scopes[0], expiresAt: '2000-01-01T00:00:00Z' }] }, { ...file, branchId: 'branch-a' }, 'delete')).toBe(false);
  });
  it.each(['read', 'delete'] as const)('denies %s of a private document by a former branch uploader', (action) => {
    expect(canAccessStoredMedia(manager, { ...file, visibility: 'PRIVATE' }, action)).toBe(false);
  });
  it('preserves private document access for its currently assigned uploader', () => {
    expect(canAccessStoredMedia(manager, { ...file, visibility: 'PRIVATE', branchId: 'branch-a' }, 'read')).toBe(true);
  });
  it('allows the current owner across branches but denies an owner of another business', () => {
    const owner = { ...manager, roles: ['BUSINESS_OWNER'], scopes: [{ code: 'BUSINESS_OWNER', businessId: 'biz' }] };
    expect(canAccessStoredMedia(owner, file, 'delete')).toBe(true);
    expect(canAccessStoredMedia(owner, { ...file, visibility: 'PRIVATE', uploadedBy: 'other' }, 'delete')).toBe(true);
    expect(canAccessStoredMedia({ ...owner, scopes: [{ code: 'BUSINESS_OWNER', businessId: 'other-biz' }] }, file, 'delete')).toBe(false);
  });
  it('requires tenant-wide authority for a business logo, not just a branch assignment', () => {
    expect(canAccessStoredMedia(manager, { ...file, branchId: null }, 'delete')).toBe(false);
  });
  it('preserves self-owned avatar deletion without granting access to another avatar', () => {
    const avatar = { ...file, businessId: null, branchId: null };
    expect(canAccessStoredMedia(manager, avatar, 'delete')).toBe(true);
    expect(canAccessStoredMedia(manager, { ...avatar, uploadedBy: 'other' }, 'delete')).toBe(false);
  });
  it.each(['PUBLIC', 'PRIVATE'])('rejects unauthorized %s deletion before detach/delete transaction', async (visibility) => {
    const prisma = { mediaFile: { findUnique: jest.fn().mockResolvedValue({ ...file, id: 'media', visibility }) }, $transaction: jest.fn() };
    const service = new MediaService(prisma as never, { get: () => undefined } as never);
    await expect(service.remove('media', manager)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects the former uploader before reading private bytes', async () => {
    const prisma = { mediaFile: { findUnique: jest.fn().mockResolvedValue({ ...file, id: 'media', visibility: 'PRIVATE' }) } };
    const service = new MediaService(prisma as never, { get: () => undefined } as never);
    const read = jest.spyOn(service, 'read');
    await expect(service.readForUser('media', manager)).rejects.toBeInstanceOf(ForbiddenException);
    expect(read).not.toHaveBeenCalled();
  });
});
