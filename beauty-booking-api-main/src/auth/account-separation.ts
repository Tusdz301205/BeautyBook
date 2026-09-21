import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';

export const OPERATIONAL_ROLES: ReadonlySet<string> = new Set([
  'BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF', 'PLATFORM_ADMIN',
]);
export const CUSTOMER_ACCOUNT_REQUIRED =
  'Tài khoản vận hành không thể thực hiện thao tác của khách hàng. Vui lòng dùng tài khoản CUSTOMER riêng.';

export function isCustomerPrincipal(user: AuthUser): boolean {
  if (!user || user.sessionType !== 'customer' ||
    (user.workspace && user.workspace !== 'CUSTOMER')) return false;
  if (user.roles.some((role) => OPERATIONAL_ROLES.has(role))) return false;
  const active = (user.scopes ?? []).filter((scope) =>
    !scope.expiresAt || new Date(scope.expiresAt).getTime() > Date.now());
  return user.roles.includes('CUSTOMER') && active.some((scope) => scope.code === 'CUSTOMER') &&
    !active.some((scope) => OPERATIONAL_ROLES.has(scope.code));
}

export function assertCustomerPrincipal(user: AuthUser): void {
  if (!isCustomerPrincipal(user)) throw new ForbiddenException({
    code: 'CUSTOMER_ACCOUNT_REQUIRED', message: CUSTOMER_ACCOUNT_REQUIRED,
  });
}

/** Grant writers call this inside their transaction; the DB guard also protects
 * concurrent and non-API writes. A profile is history, never proof of a role. */
export async function assertAccountRoleCompatible(
  db: Pick<Prisma.TransactionClient, 'userRole'>,
  userId: string,
  incomingRole: string,
): Promise<void> {
  const opposite = incomingRole === 'CUSTOMER' ? [...OPERATIONAL_ROLES]
    : OPERATIONAL_ROLES.has(incomingRole) ? ['CUSTOMER'] : [];
  if (!opposite.length) return;
  const conflict = await db.userRole.findFirst({
    where: { userId, role: { code: { in: opposite as Prisma.EnumRoleCodeFilter['in'] } },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    select: { id: true },
  });
  if (conflict) throw new ConflictException({ code: 'ACCOUNT_ROLE_CONFLICT',
    message: 'Tài khoản khách hàng và tài khoản vận hành phải tách riêng; không thể cấp kết hợp các vai trò này.' });
}
