import { ConflictException, ForbiddenException } from '@nestjs/common';
import { assertAccountRoleCompatible, assertCustomerPrincipal, isCustomerPrincipal } from './account-separation';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { can } from '../common/utils/policy';
import { SavedServicesService } from '../saved-services/saved-services.service';
import { ReviewsService } from '../reviews/reviews.service';

const customer: AuthUser = { id: 'customer-user', email: 'test@example.test',
  roles: ['CUSTOMER'], scopes: [{ code: 'CUSTOMER' }], sessionType: 'customer', workspace: 'CUSTOMER' };

describe('Customer and operational account separation', () => {
  test('a real Customer retains self-booking and does not gain management permissions', () => {
    expect(isCustomerPrincipal(customer)).toBe(true);
    expect(can(customer, 'booking:create:self', { ownerId: customer.id })).toBe(true);
    expect(can(customer, 'branch:update:tenant', { tenantId: 'business' })).toBe(false);
  });
  test.each(['BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF', 'PLATFORM_ADMIN'])(
    '%s cannot borrow Customer capabilities even through a legacy mixed principal', async (role) => {
      const user: AuthUser = { ...customer, roles: ['CUSTOMER', role],
        scopes: [...customer.scopes, { code: role, businessId: 'business', branchId: 'branch' }] };
      expect(() => assertCustomerPrincipal(user)).toThrow(ForbiddenException);
      for (const code of ['booking:create:self', 'booking:read:self', 'booking:cancel:self',
        'review:create:self', 'voucher:read:self', 'change_request:create:self']) {
        expect(can(user, code, { ownerId: user.id })).toBe(false);
      }
      // Shared profile and notifications are not Customer-only workflows.
      expect(can(user, 'notification:read:self', { ownerId: user.id })).toBe(true);
      const saved = new SavedServicesService({} as never);
      await expect(saved.list(user)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(saved.save(user, 'service')).rejects.toBeInstanceOf(ForbiddenException);
      await expect(saved.remove(user, 'service')).rejects.toBeInstanceOf(ForbiddenException);
      await expect(new ReviewsService({} as never, {} as never).create({
        bookingId: 'booking', customerId: 'customer', overallRating: 5,
      }, user)).rejects.toBeInstanceOf(ForbiddenException);
    },
  );
  test('a forged customer role does not override a salon-bound session', () => {
    expect(isCustomerPrincipal({ ...customer, sessionType: 'salon' })).toBe(false);
    expect(isCustomerPrincipal({ ...customer, workspace: 'SALON' })).toBe(false);
  });
  test.each(['CUSTOMER', 'BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF', 'PLATFORM_ADMIN'])(
    'granting %s checks for the opposite active account domain', async (role) => {
      const findFirst = jest.fn().mockResolvedValue({ id: 'conflict' });
      await expect(assertAccountRoleCompatible({ userRole: { findFirst } } as never, 'user', role))
        .rejects.toBeInstanceOf(ConflictException);
      expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: 'user' }) }));
    },
  );
});
