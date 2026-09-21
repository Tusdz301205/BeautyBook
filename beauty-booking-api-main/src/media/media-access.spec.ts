import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { canAccessStoredMedia, MediaAccessRecord } from './media-access';
import { MediaService } from './media.service';

const receptionist: AuthUser = {
  id: 'receptionist', email: 'receptionist@example.test', roles: ['RECEPTIONIST'],
  scopes: [{ code: 'RECEPTIONIST', businessId: 'biz', branchId: 'branch-a' }], sessionType: 'salon',
};
const file: MediaAccessRecord = { uploadedBy: 'receptionist', businessId: 'biz', branchId: 'branch-b', visibility: 'PUBLIC' };

describe('Current media scope after membership changes', () => {
  it('denies deleting an image in another branch even when the caller originally uploaded it', () => {
    expect(canAccessStoredMedia(receptionist, file, 'delete')).toBe(false);
    expect(canAccessStoredMedia(receptionist, { ...file, uploadedBy: 'other' }, 'delete')).toBe(false);
  });
  it('allows an active member to delete branch media in their current branch', () => {
    expect(canAccessStoredMedia(receptionist, { ...file, branchId: 'branch-a' }, 'delete')).toBe(true);
  });
  it('denies a retired Manager grant even in its former branch', () => {
    const retired: AuthUser = {
      ...receptionist,
      roles: ['BRANCH_MANAGER'],
      scopes: [{ code: 'BRANCH_MANAGER', businessId: 'biz', branchId: 'branch-a' }],
    };
    expect(canAccessStoredMedia(retired, { ...file, branchId: 'branch-a' }, 'delete')).toBe(false);
    expect(canAccessStoredMedia(retired, { ...file, branchId: 'branch-a', visibility: 'PRIVATE' }, 'read')).toBe(false);
  });
  it('denies former/expired membership, even for an uploader', () => {
    expect(canAccessStoredMedia({ ...receptionist, roles: ['CUSTOMER'], scopes: [{ code: 'CUSTOMER' }] }, file, 'delete')).toBe(false);
    expect(canAccessStoredMedia({ ...receptionist, scopes: [{ ...receptionist.scopes[0], expiresAt: '2000-01-01T00:00:00Z' }] }, { ...file, branchId: 'branch-a' }, 'delete')).toBe(false);
  });
  it.each(['read', 'delete'] as const)('denies %s of a private document by a former branch uploader', (action) => {
    expect(canAccessStoredMedia(receptionist, { ...file, visibility: 'PRIVATE' }, action)).toBe(false);
  });
  it('preserves private document access for its currently assigned uploader', () => {
    expect(canAccessStoredMedia(receptionist, { ...file, visibility: 'PRIVATE', branchId: 'branch-a' }, 'read')).toBe(true);
  });
  it('allows the current owner across branches but denies an owner of another business', () => {
    const owner = { ...receptionist, roles: ['BUSINESS_OWNER'], scopes: [{ code: 'BUSINESS_OWNER', businessId: 'biz' }] };
    expect(canAccessStoredMedia(owner, file, 'delete')).toBe(true);
    expect(canAccessStoredMedia(owner, { ...file, visibility: 'PRIVATE', uploadedBy: 'other' }, 'delete')).toBe(true);
    expect(canAccessStoredMedia({ ...owner, scopes: [{ code: 'BUSINESS_OWNER', businessId: 'other-biz' }] }, file, 'delete')).toBe(false);
  });
  it('requires tenant-wide authority for a business logo, not just a branch assignment', () => {
    expect(canAccessStoredMedia(receptionist, { ...file, branchId: null }, 'delete')).toBe(false);
  });
  it('preserves self-owned avatar deletion without granting access to another avatar', () => {
    const avatar = { ...file, businessId: null, branchId: null };
    expect(canAccessStoredMedia(receptionist, avatar, 'delete')).toBe(true);
    expect(canAccessStoredMedia(receptionist, { ...avatar, uploadedBy: 'other' }, 'delete')).toBe(false);
  });
  it.each(['PUBLIC', 'PRIVATE'])('rejects unauthorized %s deletion before detach/delete transaction', async (visibility) => {
    const prisma = { mediaFile: { findUnique: jest.fn().mockResolvedValue({ ...file, id: 'media', visibility }) }, $transaction: jest.fn() };
    const service = new MediaService(prisma as never, { get: () => undefined } as never);
    await expect(service.remove('media', receptionist)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects the former uploader before reading private bytes', async () => {
    const prisma = { mediaFile: { findUnique: jest.fn().mockResolvedValue({ ...file, id: 'media', visibility: 'PRIVATE' }) } };
    const service = new MediaService(prisma as never, { get: () => undefined } as never);
    const read = jest.spyOn(service, 'read');
    await expect(service.readForUser('media', receptionist)).rejects.toBeInstanceOf(ForbiddenException);
    expect(read).not.toHaveBeenCalled();
  });
});
