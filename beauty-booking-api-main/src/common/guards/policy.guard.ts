import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from '../decorators/current-user.decorator';
import { can, CannotError } from '../utils/policy';
import { REQUIRES_PERMISSION_KEY, ACTUAL_TIME_DELEGATION_KEY } from '../decorators/permission.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ACTUAL_TIME_CORRECT_PERMISSION, assertActualTimeCorrectionPermission, assertActualTimeGrantOwner } from '../permissions/actual-time-correction-permission';

/**
 * Optional: a path that, when present, supplies the resource id for
 * OWN-scope checks. Sets metadata via `@PermissionContext({ ownerIdParam: 'userId' })`.
 */
export const PERMISSION_CONTEXT_KEY = 'rbac:permission:context';

export interface PermissionContextSpec {
  tenantIdParam?: string;
  branchIdParam?: string;
  ownerIdParam?: string;
}

export const PermissionContext = (spec: PermissionContextSpec) =>
  // Reuse the PERMISSION_KEY metadata slot; the guard merges it with the
  // base permission codes.
  (target: any, key?: any, descriptor?: any) => {
    Reflect.defineMetadata(PERMISSION_CONTEXT_KEY, spec, descriptor?.value ?? target);
  };

/**
 * Guard that invokes `policy.can(user, code, context)`. Runs after
 * JwtAuthGuard so `req.user` is populated.
 *
 * The list of required permission codes is read from `@RequirePermission(...)`
 * (variadic). For OWN-scope checks, additionally decorate with
 * `@PermissionContext({ ownerIdParam: 'userId' })` to specify where to
 * resolve the owner.
 */
@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, @Optional() private readonly prisma?: PrismaService) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const codes = this.reflector.getAllAndOverride<string[]>(
      REQUIRES_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!codes || codes.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    if (!user) throw new ForbiddenException('Không xác định được người dùng');

    // Dedicated resource-aware delegation path; never expand unscoped direct grants.
    if (codes.length === 1 && codes[0] === ACTUAL_TIME_CORRECT_PERMISSION) {
      if (this.reflector.getAllAndOverride<boolean>(ACTUAL_TIME_DELEGATION_KEY, [context.getHandler(), context.getClass()])) {
        return this.actualTimeDelegation(user, request.params?.grantId, request.body?.businessId);
      }
      return this.actualTimeCorrection(user, request.params?.bookingId ?? request.params?.id, request.params?.itemId);
    }

    const spec = this.reflector.getAllAndOverride<PermissionContextSpec>(
      PERMISSION_CONTEXT_KEY,
      [context.getHandler(), context.getClass()],
    ) ?? {};

    const ctx = {
      tenantId: spec.tenantIdParam
        ? request.params?.[spec.tenantIdParam] ??
          (request.body?.[spec.tenantIdParam] as string | undefined)
        : undefined,
      branchId: spec.branchIdParam
        ? request.params?.[spec.branchIdParam] ??
          (request.body?.[spec.branchIdParam] as string | undefined)
        : undefined,
      ownerId: spec.ownerIdParam
        ? request.params?.[spec.ownerIdParam] ??
          (request.body?.[spec.ownerIdParam] as string | undefined)
        : undefined,
    };

    // Allow if ANY of the codes resolves to true.
    let ok = false;
    for (const code of codes) {
      try {
        if (can(user, code, ctx)) {
          ok = true;
          break;
        }
      } catch (err) {
        if (err instanceof CannotError) {
          continue;
        }
        throw err;
      }
    }
    if (!ok) {
      throw new ForbiddenException(`Yêu cầu một trong các quyền: ${codes.join(', ')}`);
    }
    return true;
  }

  private async actualTimeCorrection(user: AuthUser, bookingId?: string, itemId?: string) {
    if (!this.prisma || !bookingId || !itemId) throw new ForbiddenException('Thiếu phạm vi dịch vụ đính chính');
    const item = await this.prisma.bookingService.findFirst({ where: { id: itemId, bookingId,
      booking: { deletedAt: null, branch: { deletedAt: null, business: { deletedAt: null } } } },
      select: { staff: { select: { userId: true } }, booking: { select: {
        branchId: true, branch: { select: { businessId: true } },
      } } } });
    if (!item) throw new ForbiddenException('Không có quyền đính chính dịch vụ này');
    await assertActualTimeCorrectionPermission(this.prisma, user, { businessId: item.booking.branch.businessId,
      branchId: item.booking.branchId, staffUserId: item.staff?.userId });
    return true;
  }

  private async actualTimeDelegation(user: AuthUser, grantId?: string, requestedBusinessId?: unknown) {
    if (!this.prisma) throw new ForbiddenException('Thiếu dữ liệu quyền đính chính');
    const grant = grantId ? await this.prisma.bookingActualTimeGrant.findUnique({ where: { id: grantId } }) : null;
    const businessId = grantId ? grant?.businessId : requestedBusinessId;
    if (typeof businessId !== 'string' || !businessId) throw new ForbiddenException('Thiếu phạm vi cấp quyền');
    await assertActualTimeGrantOwner(this.prisma, user, businessId);
    return true;
  }
}
