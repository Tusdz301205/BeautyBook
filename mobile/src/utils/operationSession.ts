import type { ApiAuthUser } from '../types/api';

export type MobileShell = 'CUSTOMER' | 'STAFF' | 'OWNER' | 'UNSUPPORTED';

export function usableRole(user: ApiAuthUser | null, code: string, now = Date.now()): boolean {
  if (!user?.roles.includes(code)) return false;
  return Boolean(user.scopes?.some(scope => scope.code === code &&
    (!scope.expiresAt || Date.parse(scope.expiresAt) > now) &&
    scope.businessId === (user.businessId ?? null) &&
    (!user.branchId || scope.branchId === null || scope.branchId === user.branchId) &&
    (code !== 'STAFF' || Boolean(scope.businessId && scope.branchId))));
}

export function mobileShell(user: ApiAuthUser | null, now = Date.now()): MobileShell {
  if (!user) return 'CUSTOMER';
  const operational = user.roles.some(role => ['STAFF', 'BUSINESS_OWNER', 'RECEPTIONIST', 'PLATFORM_ADMIN'].includes(role));
  if (!operational && user.roles.includes('CUSTOMER') && (!user.workspace || user.workspace === 'CUSTOMER')) return 'CUSTOMER';
  if (user.workspace !== 'SALON') return 'UNSUPPORTED';
  if (usableRole(user, 'BUSINESS_OWNER', now)) return 'OWNER';
  if (usableRole(user, 'STAFF', now)) return 'STAFF';
  return 'UNSUPPORTED';
}

export function operationContextKey(user: ApiAuthUser | null, branchId: string | null, mode: string): string {
  return JSON.stringify([user?.id, user?.workspace, user?.businessId, user?.branchId, user?.scopes, branchId, mode]);
}

export function dateInZone(zone = 'Asia/Ho_Chi_Minh', instant = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const part = (name: string) => parts.find(value => value.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
