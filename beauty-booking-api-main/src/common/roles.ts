import { RoleCode } from '@prisma/client';

export { RoleCode };

/**
 * Helper: owner of a booking can act on it; admin can always.
 * Used inside services (after the guard has passed) for row-level checks.
 */
export const isAdmin = (roles: string[]): boolean => roles.includes(RoleCode.PLATFORM_ADMIN);

export const isSalon = (roles: string[]): boolean =>
  roles.includes(RoleCode.BUSINESS_OWNER) || roles.includes(RoleCode.STAFF);

export const isCustomer = (roles: string[]): boolean =>
  roles.includes(RoleCode.CUSTOMER);