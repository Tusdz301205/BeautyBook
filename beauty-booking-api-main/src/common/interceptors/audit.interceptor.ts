import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, catchError, tap } from 'rxjs';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AUDIT_KEY,
  AuditSpec,
} from '../decorators/audit.decorator';
import {
  AuthUser,
} from '../decorators/current-user.decorator';

/**
 * AuditInterceptor — appends to `audit_logs` for any controller method
 * marked with `@Audited({...})`. Logs the actor, action, entity type, and
 * the IP from the request. Failed actions are still logged so we keep
 * visibility on rejected attempts (security).
 *
 * Per project convention (existing `audit.ts` util), failures in the
 * interceptor are swallowed — never break a business action because the
 * audit table is unavailable.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const spec = this.reflector.getAllAndOverride<AuditSpec>(AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!spec) return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as AuthUser | undefined;
    const idKey = spec.idParam ?? 'id';
    const entityId =
      (req.params?.[idKey] as string | undefined) ??
      ((req.body as Record<string, unknown> | undefined)?.[idKey] as string | undefined) ??
      null;
    const ip = this.extractIp(req);
    const requestId = String(req.headers['x-request-id'] ?? '');
    const auditReason =
      typeof (req.body as Record<string, unknown> | undefined)?.reason === 'string'
        ? String((req.body as Record<string, unknown>).reason).trim()
        : '';

    return next.handle().pipe(
      tap(() => this.write(user, spec, entityId, ip, requestId, 'success', undefined, auditReason)),
      catchError((err) => {
        // log + rethrow so caller still handles the error
        this.write(user, spec, entityId, ip, requestId, 'error', err, auditReason);
        throw err;
      }),
    );
  }

  private extractIp(req: Request): string {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
    return req.ip ?? req.socket?.remoteAddress ?? '0.0.0.0';
  }

  private async write(
    user: AuthUser | undefined,
    spec: AuditSpec,
    entityId: string | null,
    ip: string,
    requestId: string,
    outcome: string,
    err?: unknown,
    auditReason?: string,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: user?.id ?? null,
          action: spec.action as any,
          entityType: spec.entityType,
          entityId,
          reason:
            outcome +
            (spec.note ? ` | ${spec.note}` : '') +
            (auditReason ? ` | ${auditReason.slice(0, 500)}` : ''),
          // project schema uses oldData/newData JSON columns instead of
          // plain before/after — we surface outcome in `reason` and stash
          // the entity id in `oldData` for traceability.
          // Do not persist exception messages: validation/database errors can
          // contain request values or other sensitive record fragments.
          oldData: err
            ? ({
                errorType: (err as Error)?.name ?? 'Error',
                status:
                  typeof (err as { getStatus?: unknown })?.getStatus === 'function'
                    ? (err as { getStatus: () => number }).getStatus()
                    : 500,
              } as any)
            : ({} as any),
          newData: {
            result: outcome === 'error' ? 'error' : 'success',
            actorRoles: user?.roles ?? [],
            scopes: (user?.scopes ?? []).map((scope) => ({
              code: scope.code,
              businessId: scope.businessId ?? null,
              branchId: scope.branchId ?? null,
            })),
            requestId: requestId || null,
            ip,
          } as any,
        },
      });
    } catch (e) {
      this.logger.error(`audit write failed: ${(e as Error).message}`);
    }
  }
}
