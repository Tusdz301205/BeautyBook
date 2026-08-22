import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Restrict a route to one or more role codes.
 * Usage: @Roles(RoleCode.ADMIN, RoleCode.BUSINESS_OWNER)
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);