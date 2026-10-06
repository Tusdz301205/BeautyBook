import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type { PrismaService } from '../prisma/prisma.service';
import { assertBusinessAccess } from '../common/utils/multi-tenancy';
import { readMobileBusinessContext } from './business-mobile-context';
jest.mock('../common/utils/multi-tenancy', () => ({
  assertBusinessAccess: jest.fn(),
  restrictToRoles: (user: AuthUser, roles: string[]) => ({ ...user, roles: user.roles.filter(role => roles.includes(role)), scopes: user.scopes?.filter(scope => roles.includes(scope.code)) }),
}));
const owner = { id: 'owner', workspace: 'SALON', sessionType: 'salon', businessId: 'A', roles: ['BUSINESS_OWNER', 'STAFF'],
  scopes: [{ code: 'BUSINESS_OWNER', businessId: 'A', branchId: null }, { code: 'STAFF', businessId: 'B', branchId: 'branchB' }] } as AuthUser;
afterEach(() => jest.resetAllMocks());
test('selected tenant uses only Owner authority and a minimal real status projection', async () => {
  const findFirst = jest.fn().mockResolvedValue({ id: 'A', name: 'Business A', status: 'SUSPENDED', bookingRestrictedAt: new Date(), taxCode: 'private', documents: ['private'] });
  const db = { business: { findFirst } } as unknown as PrismaService;
  const result = await readMobileBusinessContext(db, owner);
  expect(assertBusinessAccess).toHaveBeenCalledWith(db, expect.objectContaining({ roles: ['BUSINESS_OWNER'], scopes: [owner.scopes![0]] }), 'A');
  expect(result).toEqual({ id: 'A', name: 'Business A', status: 'SUSPENDED', bookingRestricted: true });
  expect(Object.keys(findFirst.mock.calls[0][0].select).sort()).toEqual(['bookingRestrictedAt', 'id', 'name', 'status']);
});
test('wrong workspace, pure Staff or denied tenant cannot query business metadata', async () => {
  const findFirst = jest.fn(); const db = { business: { findFirst } } as unknown as PrismaService;
  for (const user of [{ ...owner, workspace: 'CUSTOMER' }, { ...owner, roles: ['STAFF'] }]) await expect(readMobileBusinessContext(db, user as AuthUser)).rejects.toThrow(ForbiddenException);
  jest.mocked(assertBusinessAccess).mockRejectedValue(new ForbiddenException());
  await expect(readMobileBusinessContext(db, owner)).rejects.toThrow(ForbiddenException);
  expect(findFirst).not.toHaveBeenCalled();
});
test('unscoped onboarding reads only own profile; missing profile is explicit null', async () => {
  const findUnique = jest.fn().mockResolvedValue(null);
  const db = { businessOwnerProfile: { findUnique }, business: { findFirst: jest.fn() } } as unknown as PrismaService;
  const self = { ...owner, businessId: null, scopes: [{ code: 'BUSINESS_OWNER', businessId: null, branchId: null }] };
  expect(await readMobileBusinessContext(db, self)).toBeNull();
  expect(findUnique).toHaveBeenCalledWith({ where: { userId: 'owner' }, select: { id: true } });
  await expect(readMobileBusinessContext(db, { ...self, scopes: [{ ...self.scopes[0], expiresAt: '2000-01-01' }] })).rejects.toThrow(ForbiddenException);
});
