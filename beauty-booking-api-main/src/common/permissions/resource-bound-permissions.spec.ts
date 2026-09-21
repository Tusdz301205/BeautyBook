import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../decorators/current-user.decorator';
import { BookingsAccessService } from '../../bookings/bookings-access.service';
import { BookingsController } from '../../bookings/bookings.controller';
import { BranchesController } from '../../branches/branches.controller';
import { BusinessController } from '../../business/business.controller';

const receptionist: AuthUser = {
  id: 'receptionist', email: 'receptionist@example.test', roles: ['RECEPTIONIST', 'STAFF'], sessionType: 'salon',
  scopes: [
    { code: 'RECEPTIONIST', businessId: 'business-1', branchId: 'branch-1' },
    { code: 'STAFF', businessId: 'business-1', branchId: 'branch-2' },
  ],
};
const owner: AuthUser = {
  id: 'owner', email: 'owner@example.test', roles: ['BUSINESS_OWNER'], sessionType: 'salon',
  scopes: [{ code: 'BUSINESS_OWNER', businessId: 'business-1' }],
};

function prismaFixture() {
  return {
    branch: {
      findUnique: jest.fn().mockResolvedValue({ businessId: 'business-1' }),
      findMany: jest.fn().mockResolvedValue([{ id: 'branch-1' }, { id: 'branch-2' }]),
    },
    userRole: { findMany: jest.fn().mockResolvedValue([]) },
    salonMember: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

describe('Resource-bound controller permissions', () => {
  test('receptionist sees their branch but cannot combine a receptionist role with staff membership elsewhere', async () => {
    const access = new BookingsAccessService(prismaFixture() as never);
    await expect(access.assertReadBranch(receptionist, 'branch-1')).resolves.toBeUndefined();
    await expect(access.assertReadBranch(receptionist, 'branch-2')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(access.assertReadBranch(owner, 'branch-2')).resolves.toBeUndefined();
    await expect(access.assertReadBranch({ ...owner, scopes: [{ code: 'BUSINESS_OWNER', businessId: 'other' }] }, 'branch-2'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  test('expired receptionist grants cannot read the branch-wide list', async () => {
    const access = new BookingsAccessService(prismaFixture() as never);
    await expect(access.assertReadBranch({
      ...receptionist, scopes: [{ ...receptionist.scopes[0], expiresAt: new Date(0).toISOString() }],
    }, 'branch-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('the list controller checks access before reading any appointment rows', async () => {
    const getByBranch = jest.fn();
    const assertReadBranch = jest.fn().mockRejectedValue(new ForbiddenException());
    const controller = new BookingsController(
      { getByBranch } as never, { assertReadBranch } as never, {} as never,
      {} as never, {} as never, {} as never, {} as never,
    );
    await expect(controller.getByBranch('branch-2', receptionist)).rejects.toBeInstanceOf(ForbiddenException);
    expect(assertReadBranch).toHaveBeenCalledWith(receptionist, 'branch-2');
    expect(getByBranch).not.toHaveBeenCalled();
  });

  test('branch edit checks the update permission at the target branch, not just membership', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'branch-1' });
    const controller = new BranchesController({ update } as never, {} as never, prismaFixture() as never);
    await expect(controller.update('branch-2', {}, receptionist)).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
    await expect(controller.update('branch-1', {}, receptionist)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.update('branch-2', {}, owner)).resolves.toBeDefined();
  });

  test('ordinary staff cannot read the business-wide membership/contact directory', async () => {
    const listByBusiness = jest.fn().mockResolvedValue([]);
    const controller = new BusinessController({} as never, { listByBusiness } as never, prismaFixture() as never, {} as never);
    await expect(controller.listMembers('business-1', receptionist)).rejects.toBeInstanceOf(ForbiddenException);
    expect(listByBusiness).not.toHaveBeenCalled();
    await expect(controller.listMembers('business-1', owner)).resolves.toEqual([]);
  });
});
