import { BadRequestException, Injectable, Logger, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './jwt.strategy';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { expandRolePermissions } from '../common/utils/policy';
import { MailService } from '../mail/mail.service';
import { createHash, randomBytes } from 'node:crypto';
import { TokenBlacklistService } from './token-blacklist.service';
import { auditLog } from '../common/utils/audit';
import { Prisma } from '@prisma/client';
import {
  AuthWorkspaceName,
  resolveWorkspaceAssignments,
  sessionTypeForWorkspace,
  WorkspaceRequest,
} from './auth-workspace';

const BCRYPT_COST = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly tokenBlacklist: TokenBlacklistService,
  ) {}

  private permissionsFor(
    roles: readonly string[],
    directPermissions: readonly string[] = [],
  ) {
    return [...new Set([...expandRolePermissions(roles), ...directPermissions])];
  }

  /**
   * Đăng nhập — verify bcrypt + cấp access/refresh token.
   */
  async login(
    email: string,
    password: string,
    workspaceRequest: WorkspaceRequest | { userAgent?: string; ipAddress?: string } = {},
    metadata: { userAgent?: string; ipAddress?: string } = {},
  ) {
    if ('userAgent' in workspaceRequest || 'ipAddress' in workspaceRequest) {
      metadata = workspaceRequest;
      workspaceRequest = {};
    }
    email = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
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
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const resolved = resolveWorkspaceAssignments(
      user.userRoles,
      workspaceRequest as WorkspaceRequest,
      Boolean(user.customerProfile),
    );
    const roles = resolved.assignments.map((ur) => ur.role.code);
    const scopes = resolved.assignments
      .map((ur) => ({
        code: ur.role.code as unknown as string,
        businessId: ur.businessId,
        branchId: ur.branchId,
        expiresAt: ur.expiresAt ? ur.expiresAt.toISOString() : null,
      }));
    const sessionType = sessionTypeForWorkspace(resolved.workspace);
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles,
      scopes,
      sessionType,
      workspace: resolved.workspace,
      businessId: resolved.businessId,
      branchId: resolved.branchId,
      permissions: this.permissionsFor(
        roles,
        resolved.workspace === 'PLATFORM'
          ? (user.userPermissions ?? []).map((grant) => grant.permission.code)
          : [],
      ),
    };
    const sessionId = await this.createSession(user.id, resolved, metadata);
    authUser.sessionId = sessionId;
    const tokens = await this.issueTokens(authUser, sessionId);

    await auditLog(this.prisma, {
      userId: user.id, action: 'LOGIN', entityType: 'AuthSession', entityId: sessionId,
      newData: {
        workspace: resolved.workspace,
        businessId: resolved.businessId,
        branchId: resolved.branchId,
        ipAddress: metadata.ipAddress?.slice(0, 100),
        userAgent: metadata.userAgent?.slice(0, 250),
      },
    });

    return {
      user: authUser,
      ...tokens,
    };
  }

  /**
   * Đăng ký tài khoản mới — hash bcrypt cost 12 theo NFR-011.
   */
  async register(data: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    accountType?: 'CUSTOMER' | 'BUSINESS_OWNER';
  }, metadata: { userAgent?: string; ipAddress?: string } = {}) {
    const email = data.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }
    if (data.phone) {
      const phoneOwner = await this.prisma.user.findUnique({
        where: { phone: data.phone },
        select: { id: true },
      });
      if (phoneOwner) throw new ConflictException('Số điện thoại đã được sử dụng');
    }

    // Public registration supports customers and business-owner applicants.
    // An owner account does not activate a business: the business is created
    // as DRAFT and still has to pass the reviewed onboarding flow.
    const roleCode = data.accountType === 'BUSINESS_OWNER' ? 'BUSINESS_OWNER' : 'CUSTOMER';
    const role = await this.prisma.role.findUnique({
      where: { code: roleCode as any },
    });
    if (!role) throw new ConflictException('Hệ thống chưa được seed role cần thiết');

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_COST);

    let user;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email,
            passwordHash,
            fullName: data.fullName.trim(),
            phone: data.phone,
            userRoles: { create: { roleId: role.id } },
          },
          include: { userRoles: { include: { role: true } } },
        });
        if (roleCode === 'BUSINESS_OWNER') {
          const owner = await tx.businessOwnerProfile.create({ data: { userId: created.id } });
          const business = await tx.business.create({
            data: {
              ownerId: owner.id,
              name: `Hồ sơ cơ sở của ${created.fullName}`,
              slug: `draft-${created.id}`,
              contactEmail: created.email,
              contactPhone: created.phone,
              status: 'DRAFT',
              onboardingStep: 1,
              onboardingData: {},
            },
          });
          await tx.userRole.updateMany({
            where: { userId: created.id, roleId: role.id },
            data: { businessId: business.id },
          });
          return {
            ...created,
            userRoles: created.userRoles.map((assignment) => ({
              ...assignment,
              businessId: business.id,
            })),
          };
        } else {
          await tx.customerProfile.create({ data: { userId: created.id } });
        }
        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = Array.isArray(error.meta?.target)
          ? error.meta.target.join(',')
          : String(error.meta?.target ?? '');
        throw new ConflictException(
          target.includes('phone') ? 'Số điện thoại đã được sử dụng' : 'Email đã được sử dụng',
        );
      }
      throw error;
    }

    const verificationToken = await this.issueAccountToken(
      user.id,
      'EMAIL_VERIFICATION',
      24 * 60 * 60 * 1000,
    );
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    try {
      await this.mail.sendMail(
        user.email,
        'GlowBook - Xác minh email',
        `<p>Nhấn vào liên kết để xác minh email:</p><p><a href="${frontendUrl}/verify-email?token=${verificationToken}">Xác minh email</a></p>`,
      );
    } catch (error) {
      this.logger.error(`Không thể gửi email xác minh cho user ${user.id}`, error instanceof Error ? error.stack : String(error));
    }

    const roles = user.userRoles.map((ur) => ur.role.code);
    const scopes = user.userRoles
      .filter((ur) => !ur.expiresAt || ur.expiresAt.getTime() > Date.now())
      .map((ur) => ({
        code: ur.role.code as unknown as string,
        businessId: ur.businessId,
        branchId: ur.branchId,
        expiresAt: ur.expiresAt ? ur.expiresAt.toISOString() : null,
      }));
    const workspace: AuthWorkspaceName = roleCode === 'BUSINESS_OWNER' ? 'SALON' : 'CUSTOMER';
    const sessionType = sessionTypeForWorkspace(workspace);
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles,
      scopes,
      sessionType,
      workspace,
      businessId: scopes[0]?.businessId ?? null,
      branchId: null,
      permissions: expandRolePermissions(roles),
    };
    const sessionId = await this.createSession(
      user.id,
      { workspace, businessId: scopes[0]?.businessId ?? null, branchId: null },
      metadata,
    );
    authUser.sessionId = sessionId;
    const tokens = await this.issueTokens(authUser, sessionId);

    return {
      user: authUser,
      ...tokens,
    };
  }

  /**
   * Refresh access token bằng refresh token hợp lệ.
   */
  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
      let sessionId = payload.sessionId;
      let sessionContext: {
        workspace: AuthWorkspaceName;
        businessId: string | null;
        branchId: string | null;
      } | null = null;
      if (sessionId) {
        const session = await this.prisma.userSession.findFirst({
          where: {
            id: sessionId,
            userId: payload.sub,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
        });
        if (!session) throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi');
        sessionContext = {
          workspace: session.workspace as AuthWorkspaceName,
          businessId: session.businessId,
          branchId: session.branchId,
        };
        const presentedHash = createHash('sha256').update(refreshToken).digest('hex');
        if (session.refreshTokenHash && session.refreshTokenHash !== presentedHash) {
          throw new UnauthorizedException('Refresh token đã được sử dụng hoặc thay thế');
        }
        const claimed = await this.prisma.userSession.updateMany({
          where: { id: session.id, userId: payload.sub, revokedAt: null, refreshTokenHash: session.refreshTokenHash },
          data: { refreshTokenHash: `rotating:${randomBytes(16).toString('hex')}`, lastActiveAt: new Date() },
        });
        if (claimed.count !== 1) throw new UnauthorizedException('Refresh token đã được sử dụng');
      } else {
        sessionContext = {
          workspace: payload.workspace ?? this.workspaceFromSessionType(payload.sessionType),
          businessId: payload.businessId ?? null,
          branchId: payload.branchId ?? null,
        };
        sessionId = await this.createSession(payload.sub, sessionContext, {});
      }
      const current = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          userRoles: {
            where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
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
      if (!current?.isActive) throw new UnauthorizedException('Tài khoản đã bị khóa');
      const resolved = resolveWorkspaceAssignments(
        current.userRoles,
        sessionContext
          ? {
              workspace: sessionContext.workspace,
              businessId: sessionContext.businessId ?? undefined,
              branchId: sessionContext.branchId ?? undefined,
            }
          : { workspace: payload.workspace ?? this.workspaceFromSessionType(payload.sessionType) },
        Boolean(current.customerProfile),
      );
      const currentRoles = resolved.assignments.map((assignment) => assignment.role.code);
      const currentScopes = resolved.assignments.map((assignment) => ({
        code: assignment.role.code as unknown as string,
        businessId: assignment.businessId,
        branchId: assignment.branchId,
        expiresAt: assignment.expiresAt?.toISOString() ?? null,
      }));
      const authUser: AuthUser = {
        id: current.id,
        email: current.email,
        fullName: current.fullName,
        roles: currentRoles,
        scopes: currentScopes,
        sessionType: sessionTypeForWorkspace(resolved.workspace),
        workspace: resolved.workspace,
        businessId: resolved.businessId,
        branchId: resolved.branchId,
        permissions: this.permissionsFor(
          currentRoles,
          resolved.workspace === 'PLATFORM'
            ? current.userPermissions.map((grant) => grant.permission.code)
            : [],
        ),
        sessionId,
      };
      return {
        user: authUser,
        ...(await this.issueTokens(authUser, sessionId)),
      };
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }
  }

  async verifyEmail(token: string) {
    const accountToken = await this.consumeAccountToken(
      token,
      'EMAIL_VERIFICATION',
    );
    await this.prisma.user.update({
      where: { id: accountToken.userId },
      data: { isEmailVerified: true },
    });
    return { ok: true };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (user?.isActive) {
      const token = await this.issueAccountToken(
        user.id,
        'PASSWORD_RESET',
        30 * 60 * 1000,
      );
      const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
      try {
        await this.mail.sendMail(
          user.email,
          'GlowBook - Đặt lại mật khẩu',
          `<p>Liên kết đặt lại mật khẩu có hiệu lực trong 30 phút:</p><p><a href="${frontendUrl}/reset-password?token=${token}">Đặt lại mật khẩu</a></p>`,
        );
      } catch (error) {
        this.logger.error(`Không thể gửi email reset cho user ${user.id}`, error instanceof Error ? error.stack : String(error));
      }
    }
    return { ok: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const accountToken = await this.consumeAccountToken(token, 'PASSWORD_RESET');
    await this.prisma.user.update({
      where: { id: accountToken.userId },
      data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_COST) },
    });
    await this.tokenBlacklist.revokeAllForUser(accountToken.userId);
    await this.prisma.userSession.updateMany({ where: { userId: accountToken.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await auditLog(this.prisma, { userId: accountToken.userId, action: 'UPDATE', entityType: 'Password', entityId: accountToken.userId, reason: 'Đặt lại mật khẩu bằng token' });
    return { ok: true, requiresLogin: true };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string, currentSessionId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_COST) },
    });
    await this.tokenBlacklist.revokeAllForUser(userId);
    await this.prisma.userSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await auditLog(this.prisma, {
      userId, action: 'UPDATE', entityType: 'Password', entityId: userId,
      newData: { previousSessionId: currentSessionId ?? null }, reason: 'Người dùng đổi mật khẩu',
    });
    return { ok: true, requiresLogin: true };
  }

  async logout(userId: string, sessionId?: string) {
    const result = await this.prisma.userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(sessionId ? { id: sessionId } : {}),
      },
      data: { revokedAt: new Date() },
    });
    if (!sessionId) {
      await this.tokenBlacklist.revokeAllForUser(userId);
    }
    await auditLog(this.prisma, {
      userId,
      action: 'LOGOUT',
      entityType: 'AuthSession',
      entityId: sessionId ?? null,
      newData: { revokedCount: result.count },
      reason: sessionId ? 'Đăng xuất phiên hiện tại' : 'Đăng xuất và thu hồi toàn bộ phiên',
    });
    return { ok: true, revokedCount: result.count };
  }

  async listSessions(userId: string, currentSessionId?: string) {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastActiveAt: 'desc' },
    });
    return sessions.map((session) => ({
      ...session,
      current: session.id === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string, actorId?: string) {
    const session = await this.prisma.userSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new UnauthorizedException('Session không tồn tại');
    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    await auditLog(this.prisma, { userId: actorId ?? userId, action: 'LOGOUT', entityType: 'AuthSession', entityId: sessionId, reason: 'Thu hồi phiên đăng nhập từ trang bảo mật' });
    return { ok: true };
  }

  async revokeOtherSessions(userId: string, currentSessionId?: string) {
    const result = await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null, ...(currentSessionId ? { id: { not: currentSessionId } } : {}) },
      data: { revokedAt: new Date() },
    });
    await auditLog(this.prisma, {
      userId, action: 'LOGOUT', entityType: 'AuthSession', entityId: currentSessionId ?? null,
      newData: { revokedCount: result.count }, reason: 'Thu hồi tất cả phiên khác',
    });
    return { ok: true, revokedCount: result.count };
  }

  async securityHistory(userId: string) {
    const [events, sessions] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { userId, entityType: { in: ['AuthSession', 'Password', 'UserProfile'] } },
        orderBy: { createdAt: 'desc' }, take: 50,
        select: { id: true, action: true, entityType: true, entityId: true, reason: true, newData: true, createdAt: true },
      }),
      this.prisma.userSession.findMany({
        where: { userId }, orderBy: { createdAt: 'desc' }, take: 20,
        select: { id: true, ipAddress: true, userAgent: true, createdAt: true, lastActiveAt: true, revokedAt: true },
      }),
    ]);
    return { events, sessions };
  }

  // ---------- private helpers ----------

  private workspaceFromSessionType(sessionType: 'admin' | 'salon' | 'customer'): AuthWorkspaceName {
    return sessionType === 'admin' ? 'PLATFORM' : sessionType === 'salon' ? 'SALON' : 'CUSTOMER';
  }

  private async issueTokens(user: AuthUser, sessionId?: string) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      scopes: user.scopes,
      sessionType: user.sessionType,
      workspace: user.workspace,
      businessId: user.businessId,
      branchId: user.branchId,
      sessionId,
    };

    const accessExpiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
    const refreshExpiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d';

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: accessExpiresIn as any,
    });
    const refreshToken = await this.jwtService.signAsync({ ...payload, jti: randomBytes(16).toString('hex') }, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshExpiresIn as any,
    });
    if (sessionId) {
      await this.prisma.userSession.update({
        where: { id: sessionId },
        data: { refreshTokenHash: createHash('sha256').update(refreshToken).digest('hex'), lastActiveAt: new Date() },
      });
    }

    return {
      accessToken,
      refreshToken,
      accessExpiresIn,
      refreshExpiresIn,
    };
  }

  private async createSession(
    userId: string,
    context: { workspace: AuthWorkspaceName; businessId?: string | null; branchId?: string | null },
    metadata: { userAgent?: string; ipAddress?: string },
  ): Promise<string> {
    const session = await this.prisma.userSession.create({
      data: {
        userId,
        workspace: context.workspace,
        businessId: context.businessId ?? null,
        branchId: context.branchId ?? null,
        userAgent: metadata.userAgent?.slice(0, 500),
        ipAddress: metadata.ipAddress?.slice(0, 100),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    return session.id;
  }

  private async issueAccountToken(
    userId: string,
    type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET',
    ttlMs: number,
  ): Promise<string> {
    await this.prisma.accountToken.updateMany({
      where: { userId, type: type as any, usedAt: null },
      data: { usedAt: new Date() },
    });
    const token = randomBytes(32).toString('hex');
    await this.prisma.accountToken.create({
      data: {
        userId,
        type: type as any,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
    return token;
  }

  private async consumeAccountToken(
    token: string,
    type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET',
  ) {
    const record = await this.prisma.accountToken.findFirst({
      where: {
        tokenHash: this.hashToken(token),
        type: type as any,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!record) throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    await this.prisma.accountToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    return record;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
