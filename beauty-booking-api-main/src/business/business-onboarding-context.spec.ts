import { BusinessOnboardingService } from './business-onboarding.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';

describe('owner onboarding respects the authenticated business context', () => {
  test('active selected business is not replaced by a newer draft of the same owner', async () => {
    const active = { id: 'selected-active', ownerId: 'owner', status: 'ACTIVE', documents: [], branches: [] };
    const latest = { ...active, id: 'newer-draft', status: 'DRAFT' };
    const prisma: any = { businessOwnerProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'owner' }) }, business: { findFirst: jest.fn(async ({ where }) => where.id === active.id ? active : latest) } };
    const service = new BusinessOnboardingService(prisma, {} as never);
    jest.spyOn(service, 'checklist').mockResolvedValue([] as never);
    const result = await service.findMine({ id: 'user', businessId: active.id } as AuthUser);
    expect(result).toMatchObject({ id: active.id, status: 'ACTIVE' });
    expect(prisma.business.findFirst.mock.calls[0][0].where).toEqual({ ownerId: 'owner', deletedAt: null, id: active.id });
  });
  test('selected business must still belong to the current owner', async () => {
    const prisma: any = { businessOwnerProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'owner' }) }, business: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new BusinessOnboardingService(prisma, {} as never);
    expect(await service.findMine({ id: 'user', businessId: 'foreign' } as AuthUser)).toBeNull();
    expect(prisma.business.findFirst.mock.calls[0][0].where).toEqual({ ownerId: 'owner', deletedAt: null, id: 'foreign' });
  });
  test('new owner without a selected business retains the draft onboarding path', async () => {
    const prisma: any = { businessOwnerProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'owner' }) }, business: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new BusinessOnboardingService(prisma, {} as never);
    expect(await service.findMine({ id: 'user' } as AuthUser)).toBeNull();
    expect(prisma.business.findFirst.mock.calls[0][0]).toMatchObject({ where: { ownerId: 'owner', deletedAt: null }, orderBy: { createdAt: 'desc' } });
  });
});
