import {
  BadRequestException,
  ConflictException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { isPlatformRole } from '../common/utils/scope-helpers';
import { canOnResource } from '../common/utils/policy';
import { TokenBlacklistService } from '../auth/token-blacklist.service';
import { assertBusinessAccess, resolveBusinessIdByBranch } from '../common/utils/multi-tenancy';
import { auditLog } from '../common/utils/audit';

const RETIRED_PLATFORM_ROLES = new Set([
  'ADMIN',
  'COMPLIANCE',
  'SUPPORT',
  'MARKETING',
  'FINANCE',
]);

const NON_GRANTABLE_PLATFORM_OPERATIONS = new Set([
  'booking:create:platform',
  'booking:update:platform',
  'branch:create:platform',
  'service:create:platform',
  'service:update:platform',
  'change_request:approve:platform',
]);

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenBlacklist: TokenBlacklistService,
  ) {}

  async getSelf(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, fullName: true, phone: true, address: true, gender: true,
        dateOfBirth: true, avatarMediaId: true, avatarMedia: { select: { id: true, url: true, originalName: true } }, isEmailVerified: true,
        createdAt: true, customerProfile: true, ownerProfile: true,
        staffProfile: { include: { branch: { select: { id: true, name: true } } } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateSelf(
    userId: string,
    input: {
      fullName?: string; phone?: string; gender?: 'MALE' | 'FEMALE' | 'OTHER';
      dateOfBirth?: string; avatarMediaId?: string; address?: string;
      staffBio?: string; experienceYears?: number; emergencyContactName?: string; emergencyContactPhone?: string;
    },
  ) {
    if (input.fullName !== undefined && input.fullName.trim().length < 2) {
      throw new BadRequestException('Họ tên phải có ít nhất 2 ký tự');
    }
    if (input.experienceYears !== undefined && (input.experienceYears < 0 || input.experienceYears > 80)) {
      throw new BadRequestException('Số năm kinh nghiệm phải từ 0 đến 80');
    }
    if (input.avatarMediaId) {
      const media = await this.prisma.mediaFile.findFirst({ where: { id: input.avatarMediaId, uploadedBy: userId, fileType: 'IMAGE', visibility: 'PUBLIC' } });
      if (!media) throw new BadRequestException('Ảnh đại diện không hợp lệ hoặc không thuộc tài khoản này');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          fullName: input.fullName?.trim(), phone: input.phone, address: input.address?.trim(), gender: input.gender,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined, avatarMediaId: input.avatarMediaId,
        },
        select: { id: true, email: true, fullName: true, phone: true, address: true, gender: true, dateOfBirth: true, avatarMediaId: true },
      });
      const hasStaffFields = [input.staffBio, input.experienceYears, input.emergencyContactName, input.emergencyContactPhone].some((value) => value !== undefined);
      if (hasStaffFields) {
        await tx.staffProfile.updateMany({
          where: { userId },
          data: {
            bio: input.staffBio?.trim(), experienceYears: input.experienceYears,
            emergencyContactName: input.emergencyContactName?.trim(), emergencyContactPhone: input.emergencyContactPhone?.trim(),
          },
        });
      }
      return user;
    });
    await auditLog(this.prisma, { userId, action: 'UPDATE', entityType: 'UserProfile', entityId: userId, newData: { fields: Object.keys(input).filter((key) => key !== 'avatarMediaId' || Boolean(input.avatarMediaId)) } });
    return updated;
  }

  /**
   * Lấy danh sách người dùng (Admin)
   */
  async findAll(query?: { search?: string; page?: number; limit?: number; role?: string; status?: string }) {
    const { search, page = 1, limit = 50, role, status } = query || {};

    const where: any = { deletedAt: null };
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.userRoles = { some: { role: { code: role } } };
    if (status === 'ACTIVE') where.isActive = true;
    if (status === 'SUSPENDED') where.isActive = false;

    const baseWhere = { deletedAt: null };
    const [users, total, all, active, suspended, customers, teamMembers] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          userRoles: { include: { role: true } },
          customerProfile: {
            include: {
              bookings: {
                where: { deletedAt: null },
                select: { id: true, status: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
      this.prisma.user.count({ where: baseWhere }),
      this.prisma.user.count({ where: { ...baseWhere, isActive: true } }),
      this.prisma.user.count({ where: { ...baseWhere, isActive: false } }),
      this.prisma.user.count({ where: { ...baseWhere, userRoles: { some: { role: { code: 'CUSTOMER' } } } } }),
      this.prisma.user.count({ where: { ...baseWhere, userRoles: { some: { role: { code: { in: ['BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST', 'STAFF'] } } } } } }),
    ]);

    return {
      data: users.map((u) => ({
        id: u.id,
        name: u.fullName,
        email: u.email,
        phone: u.phone || '',
        joined: u.createdAt,
        roles: u.userRoles.map((ur) => ur.role.code),
        bookings: u.customerProfile?.bookings?.length || 0,
        isActive: u.isActive,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        summary: { total: all, active, suspended, customers, teamMembers },
      },
    };
  }

  /**
   * Lấy chi tiết user theo ID — enforces self-or-platform visibility.
   */
  async findOne(id: string, caller?: AuthUser) {
    if (caller && caller.id !== id && !isPlatformRole(caller)) {
      const probe = canOnResource(caller, 'user:read:self', { ownerUserId: id });
      if (!probe) {
        throw new ForbiddenException('Bạn chỉ xem được thông tin của chính mình');
      }
    }
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        avatarMediaId: true,
        gender: true,
        dateOfBirth: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          include: { role: true, business: true, branch: true },
        },
        customerProfile: {
          include: {
            bookings: {
              select: { id: true, bookingCode: true, appointmentDate: true, status: true, totalAmount: true, branchId: true },
              orderBy: { appointmentDate: 'desc' },
              take: 50,
            },
          },
        },
        ownerProfile: {
          include: {
            businesses: { select: { id: true, name: true, status: true, createdAt: true } },
          },
        },
        staffProfile: {
          include: {
            branch: { select: { id: true, name: true, businessId: true } },
            branchAssignments: { include: { branch: { select: { id: true, name: true } } } },
          },
        },
        sessions: {
          select: { id: true, workspace: true, businessId: true, branchId: true, lastActiveAt: true, expiresAt: true, revokedAt: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        userPermissions: {
          where: { revokedAt: null },
          include: { permission: { select: { code: true, description: true } } },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const auditTrail = await this.prisma.auditLog.findMany({
      where: { OR: [{ userId: id }, { entityId: id }] },
      select: { id: true, action: true, entityType: true, entityId: true, reason: true, oldData: true, newData: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { ...user, auditTrail };
  }

  /** Platform-side suspension toggle. Writes an audit row. */
  async suspend(id: string, actorUserId: string, reason?: string) {
    const before = await this.prisma.user.findUnique({
      where: { id },
      select: { isActive: true },
    });
    if (!before) throw new NotFoundException('User not found');
    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: !before.isActive },
    });

    // Security Rule 9 — khi KHÓA tài khoản, thu hồi ngay mọi JWT đang sống
    // (Redis blacklist). Mở khóa thì không cần revoke.
    if (!updated.isActive) {
      await this.tokenBlacklist.revokeAllForUser(id);
    }

    await this.prisma.auditLog.create({
      data: {
        userId: actorUserId,
        action: 'STATUS_CHANGE',
        entityType: 'User',
        entityId: id,
        oldData: { isActive: before.isActive } as any,
        newData: { isActive: updated.isActive } as any,
        reason: reason ?? 'suspend toggle',
      },
    });
    return updated;
  }

  async assignRole(
    userId: string,
    input: {
      roleCode: string;
      businessId?: string;
      branchId?: string;
      expiresAt?: string;
    },
    actor: AuthUser,
  ) {
    if (RETIRED_PLATFORM_ROLES.has(input.roleCode)) {
      throw new BadRequestException(
        'Role nền tảng cũ đã ngừng cấp. Hãy dùng PLATFORM_ADMIN và gán quyền trực tiếp.',
      );
    }
    const [target, role] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
      this.prisma.role.findUnique({ where: { code: input.roleCode as any } }),
    ]);
    if (!target) throw new NotFoundException('User not found');
    if (!role) throw new BadRequestException('Role không tồn tại');

    await this.assertRoleAssignmentScope(actor, input.roleCode, input.businessId, input.branchId);
    const existing = await this.prisma.userRole.findFirst({
      where: {
        userId,
        roleId: role.id,
        businessId: input.businessId ?? null,
        branchId: input.branchId ?? null,
      },
    });
    if (existing) throw new ConflictException('Role đã được gán trong scope này');

    const assigned = await this.prisma.userRole.create({
      data: {
        userId,
        roleId: role.id,
        businessId: input.businessId ?? null,
        branchId: input.branchId ?? null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        grantedBy: actor.id,
      },
      include: { role: true, business: true, branch: true },
    });
    await this.tokenBlacklist.revokeAllForUser(userId);
    return assigned;
  }

  async listDirectPermissions(userId: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        userRoles: {
          where: { role: { code: 'PLATFORM_ADMIN' } },
          select: { id: true },
        },
        userPermissions: {
          include: {
            permission: {
              select: {
                code: true,
                description: true,
                resource: true,
                action: true,
                scope: true,
              },
            },
          },
          orderBy: { grantedAt: 'desc' },
        },
      },
    });
    if (!target) throw new NotFoundException('User not found');
    return {
      userId: target.id,
      email: target.email,
      isPlatformAdmin: target.userRoles.length > 0,
      grants: target.userPermissions,
    };
  }

  async grantDirectPermission(
    userId: string,
    input: { permissionCode: string; bundleCode?: string; expiresAt?: string },
    actor: AuthUser,
  ) {
    const [target, permission] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          userRoles: {
            where: { role: { code: 'PLATFORM_ADMIN' } },
            select: { id: true },
          },
        },
      }),
      this.prisma.permission.findUnique({
        where: { code: input.permissionCode },
      }),
    ]);
    if (!target) throw new NotFoundException('User not found');
    if (target.userRoles.length === 0) {
      throw new BadRequestException(
        'Quyền trực tiếp chỉ được cấp cho PLATFORM_ADMIN',
      );
    }
    if (!permission) throw new BadRequestException('Permission không tồn tại');
    if (permission.scope !== 'PLATFORM') {
      throw new BadRequestException(
        'Chỉ permission cấp PLATFORM mới được gán trực tiếp',
      );
    }
    if (NON_GRANTABLE_PLATFORM_OPERATIONS.has(permission.code)) {
      throw new BadRequestException(
        'Permission vận hành doanh nghiệp không được cấp cho PLATFORM_ADMIN',
      );
    }
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('expiresAt không hợp lệ');
    }
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('expiresAt phải ở tương lai');
    }
    const grant = await this.prisma.userPermission.upsert({
      where: {
        userId_permissionId: {
          userId,
          permissionId: permission.id,
        },
      },
      create: {
        userId,
        permissionId: permission.id,
        bundleCode: input.bundleCode?.trim() || null,
        expiresAt,
        grantedBy: actor.id,
      },
      update: {
        bundleCode: input.bundleCode?.trim() || null,
        expiresAt,
        revokedAt: null,
        grantedAt: new Date(),
        grantedBy: actor.id,
      },
      include: { permission: true },
    });
    await this.tokenBlacklist.revokeAllForUser(userId);
    await auditLog(this.prisma, {
      userId: actor.id,
      action: 'UPDATE',
      entityType: 'UserPermission',
      entityId: grant.id,
      newData: {
        targetUserId: userId,
        permissionCode: input.permissionCode,
        bundleCode: grant.bundleCode,
        expiresAt: grant.expiresAt?.toISOString() ?? null,
      },
    });
    return grant;
  }

  async revokeDirectPermission(
    userId: string,
    permissionCode: string,
    actor: AuthUser,
  ) {
    const grant = await this.prisma.userPermission.findFirst({
      where: {
        userId,
        permission: { code: permissionCode },
        revokedAt: null,
      },
      include: { permission: { select: { code: true } } },
    });
    if (!grant) throw new NotFoundException('Direct permission grant not found');
    const revokedAt = new Date();
    await this.prisma.userPermission.update({
      where: { id: grant.id },
      data: { revokedAt },
    });
    await this.tokenBlacklist.revokeAllForUser(userId);
    await auditLog(this.prisma, {
      userId: actor.id,
      action: 'UPDATE',
      entityType: 'UserPermission',
      entityId: grant.id,
      oldData: { permissionCode: grant.permission.code, revokedAt: null },
      newData: { permissionCode: grant.permission.code, revokedAt: revokedAt.toISOString() },
    });
    return { ok: true, revokedGrantId: grant.id };
  }

  async revokeRole(
    userId: string,
    input: { roleCode: string; businessId?: string; branchId?: string },
    actor: AuthUser,
  ) {
    await this.assertRoleAssignmentScope(actor, input.roleCode, input.businessId, input.branchId);
    const assignment = await this.prisma.userRole.findFirst({
      where: {
        userId,
        role: { code: input.roleCode as any },
        businessId: input.businessId ?? null,
        branchId: input.branchId ?? null,
      },
    });
    if (!assignment) throw new NotFoundException('Role assignment not found');
    await this.prisma.userRole.delete({ where: { id: assignment.id } });
    await this.tokenBlacklist.revokeAllForUser(userId);
    return { ok: true, revokedAssignmentId: assignment.id };
  }

  private async assertRoleAssignmentScope(
    actor: AuthUser,
    roleCode: string,
    businessId?: string,
    branchId?: string,
  ): Promise<void> {
    const branchRoles = ['BRANCH_MANAGER', 'RECEPTIONIST', 'STAFF'];
    if (branchRoles.includes(roleCode) && !branchId) {
      throw new BadRequestException('Role nhân sự chi nhánh bắt buộc có branchId');
    }
    if (branchId && !businessId) {
      throw new BadRequestException('Role có branchId bắt buộc có businessId');
    }
    if (branchId && businessId) {
      const branchBusinessId = await resolveBusinessIdByBranch(this.prisma, branchId);
      if (branchBusinessId !== businessId) {
        throw new ForbiddenException('Branch không thuộc business đã chọn');
      }
    }
    if (actor.roles.includes('PLATFORM_ADMIN')) {
      return;
    }
    if (!actor.roles.includes('BUSINESS_OWNER') || !businessId) {
      throw new ForbiddenException('Tenant role assignment requires BUSINESS_OWNER scope');
    }
    if (!branchRoles.includes(roleCode)) {
      throw new ForbiddenException('Owner chỉ được gán role nhân sự chi nhánh');
    }
    await assertBusinessAccess(this.prisma, actor, businessId);
  }
}
