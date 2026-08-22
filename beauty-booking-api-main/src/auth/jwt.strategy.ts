import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { TokenBlacklistService } from './token-blacklist.service';
import { expandRolePermissions } from '../common/utils/policy';
import {
  AuthWorkspaceName,
  resolveWorkspaceAssignments,
  sessionTypeForWorkspace,
} from './auth-workspace';

export interface ScopedRole {
  code: string;
  businessId?: string | null;
  branchId?: string | null;
  expiresAt?: string | null;
}

export interface JwtPayload {
  sub: string;
  email: string;
  /** Plain role codes — used by JwtAuthGuard for fast allow/deny. */
  roles: string[];
  /**
   * RBAC+Scope shape: each role carries the tenant (business) / branch
   * scope it was granted at. Missing scope means "platform-wide" /
   * "tenant-wide".
   */
  scopes: ScopedRole[];
  sessionType: 'admin' | 'salon' | 'customer';
  workspace?: AuthWorkspaceName;
  businessId?: string | null;
  branchId?: string | null;
  sessionId?: string;
  jti?: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tokenBlacklist: TokenBlacklistService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not set in environment variables');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * Returned object is attached to request.user.
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    // Security Rule 9 — Token Revocation: token phát hành trước thời điểm
    // revoke (Admin khóa tài khoản / nhân viên nghỉ việc) bị từ chối ngay,
    // kể cả khi chữ ký và hạn dùng vẫn hợp lệ.
    if (await this.tokenBlacklist.isRevoked(payload.sub, payload.iat)) {
      throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi');
    }

    if (payload.sessionId) {
      const session = await this.prisma.userSession.findUnique({
        where: { id: payload.sessionId },
        select: {
          userId: true,
          revokedAt: true,
          expiresAt: true,
          lastActiveAt: true,
          workspace: true,
          businessId: true,
          branchId: true,
        },
      });
      if (
        !session ||
        session.userId !== payload.sub ||
        session.revokedAt ||
        session.expiresAt.getTime() <= Date.now()
      ) {
        throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi');
      }
      payload.workspace = session.workspace as AuthWorkspaceName;
      payload.businessId = session.businessId;
      payload.branchId = session.branchId;
      const now = new Date();
      const activityCutoff = new Date(now.getTime() - 5 * 60 * 1000);
      if (session.lastActiveAt < activityCutoff) {
        await this.prisma.userSession.updateMany({
          where: { id: payload.sessionId, lastActiveAt: { lt: activityCutoff } },
          data: { lastActiveAt: now },
        });
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        userRoles: {
          where: {
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          include: { role: true },
        },
        customerProfile: { select: { id: true } },
        userPermissions: {
          where: {
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          include: { permission: { select: { code: true } } },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khoá');
    }

    const workspace = payload.workspace ?? (
      payload.sessionType === 'admin' ? 'PLATFORM' : payload.sessionType === 'salon' ? 'SALON' : 'CUSTOMER'
    );
    const resolved = resolveWorkspaceAssignments(
      user.userRoles,
      { workspace, businessId: payload.businessId ?? undefined, branchId: payload.branchId ?? undefined },
      Boolean(user.customerProfile),
    );
    const roles = resolved.assignments.map((ur) => ur.role.code);
    const scopes: ScopedRole[] = resolved.assignments.map((ur) => ({
      code: ur.role.code,
      businessId: ur.businessId,
      branchId: ur.branchId,
      expiresAt: ur.expiresAt ? ur.expiresAt.toISOString() : null,
    }));
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles,
      scopes,
      sessionType: sessionTypeForWorkspace(resolved.workspace),
      workspace: resolved.workspace,
      businessId: resolved.businessId,
      branchId: resolved.branchId,
      permissions: [
        ...new Set([
          ...expandRolePermissions(roles),
          ...(resolved.workspace === 'PLATFORM'
            ? user.userPermissions.map((grant) => grant.permission.code)
            : []),
        ]),
      ],
      sessionId: payload.sessionId,
    };
  }
}
