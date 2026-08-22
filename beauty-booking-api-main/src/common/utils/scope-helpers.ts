import { AuthUser } from '../decorators/current-user.decorator';

export const PLATFORM_ROLE_CODES = new Set([
  'PLATFORM_ADMIN',
]);

/**
 * Returns true only for the final platform-governance role.
 */
export function isPlatformRole(user: AuthUser | undefined): boolean {
  if (!user) return false;
  return user.scopes?.some((s) => PLATFORM_ROLE_CODES.has(s.code)) ?? false;
}

/**
 * Convenience: returns true when caller is the data subject (customer) of a
 * customer-scoped resource.
 */
export function isSelf(user: AuthUser | undefined, ownerUserId: string | null): boolean {
  return !!user && !!ownerUserId && user.id === ownerUserId;
}
