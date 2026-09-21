import { ForbiddenException } from '@nestjs/common';
import { BranchesService } from './branches.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';

const owner: AuthUser = { id: 'owner', email: 'owner@example.test', sessionType: 'salon',
  roles: ['BUSINESS_OWNER'], scopes: [{ code: 'BUSINESS_OWNER', businessId: 'business' }] };

describe('Public/preview branch projection', () => {
  function fixture() {
    const findFirst = jest.fn().mockResolvedValue(null);
    const db = { branch: { findFirst, findMany: jest.fn().mockResolvedValue([{ id: 'branch' }]), findUnique: jest.fn().mockResolvedValue({ id: 'branch', businessId: 'business' }) } };
    return { db, service: new BranchesService(db as never, {} as never, {} as never) };
  }
  test('public projection requires publication and never returns management/private data', async () => {
    const { db, service } = fixture();
    await service.findPublic('branch');
    const query = db.branch.findFirst.mock.calls[0][0];
    expect(query.where).toMatchObject({ status: 'ACTIVE', reviewStatus: 'APPROVED', operationalStatus: 'ACTIVE' });
    expect(query.select.documents).toBeUndefined();
    expect(query.select.onboardingProgress).toBeUndefined();
    expect(query.select.images.where.media.visibility).toBe('PUBLIC');
  });
  test('owner preview reuses the projection without live-only filters or publishing writes', async () => {
    const { db, service } = fixture();
    await service.findPublic('branch');
    const live = db.branch.findFirst.mock.calls[0][0];
    db.branch.findFirst.mockClear();
    await service.previewPublic('branch', owner);
    const preview = db.branch.findFirst.mock.calls.at(-1)?.[0];
    expect(preview.where).toEqual({ id: 'branch', deletedAt: null, business: { deletedAt: null } });
    expect(Object.keys(preview.select)).toEqual(Object.keys(live.select));
    expect(preview.select.services.where).toEqual({ deletedAt: null });
    expect(preview.select.images).toEqual(live.select.images);
  });
  test.each(['CUSTOMER', 'STAFF', 'RECEPTIONIST', 'PLATFORM_ADMIN'])(
    'denies %s preview even though public content remains available', async (role) => {
      const { db, service } = fixture();
      await expect(service.previewPublic('branch', { ...owner, roles: [role], scopes: [{ code: role, businessId: 'business', branchId: 'branch' }] }))
        .rejects.toBeInstanceOf(ForbiddenException);
      expect(db.branch.findFirst).not.toHaveBeenCalled();
      await expect(service.findPublic('branch')).resolves.toBeNull();
    },
  );
  test('an owner cannot preview a foreign business through a Staff scope', async () => {
    const { service } = fixture();
    await expect(service.previewPublic('branch', { ...owner, roles: ['BUSINESS_OWNER', 'STAFF'], scopes: [
      { code: 'BUSINESS_OWNER', businessId: 'other-business' }, { code: 'STAFF', businessId: 'business', branchId: 'branch' },
    ] })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
