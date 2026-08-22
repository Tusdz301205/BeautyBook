import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { auditLog } from '../common/utils/audit';

type StaffRoleCode = 'BRANCH_MANAGER' | 'RECEPTIONIST' | 'STAFF';

@Injectable()
export class StaffInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async invite(input: {
    staffProfileId: string;
    email: string;
    roleCode: StaffRoleCode;
    businessId: string;
    branchId: string;
    invitedBy: string;
  }) {
    if (!input.email || !input.businessId || !input.branchId || !input.staffProfileId) {
      throw new BadRequestException('staffProfileId, email, businessId và branchId là bắt buộc');
    }
    const email = input.email.trim().toLowerCase();
    const profile = await this.prisma.staffProfile.findFirst({
      where: { id: input.staffProfileId, deletedAt: null },
      select: {
        id: true,
        userId: true,
        branchId: true,
        branch: { select: { businessId: true } },
      },
    });
    if (!profile) throw new NotFoundException('Hồ sơ nhân sự không tồn tại');
    if (profile.userId) throw new ConflictException('Hồ sơ nhân sự đã liên kết tài khoản');
    if (
      profile.branchId !== input.branchId ||
      profile.branch.businessId !== input.businessId
    ) {
      throw new BadRequestException('Hồ sơ nhân sự không thuộc chi nhánh/doanh nghiệp đã chọn');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invitation = await this.prisma.$transaction(async (tx) => {
      await tx.staffInvitation.updateMany({
        where: {
          staffProfileId: profile.id,
          status: 'PENDING',
        },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      const created = await tx.staffInvitation.create({
        data: {
          staffProfileId: profile.id,
          email,
          roleCode: input.roleCode,
          businessId: input.businessId,
          branchId: input.branchId,
          tokenHash: this.hash(token),
          invitedBy: input.invitedBy,
          expiresAt,
        },
      });
      await tx.staffProfile.update({
        where: { id: profile.id },
        data: { status: 'INVITED', publicVisible: false, isBookable: false },
      });
      return created;
    });

    try {
      await this.sendInvitationEmail(email, input.roleCode, token);
    } catch {
      await this.prisma.$transaction([
        this.prisma.staffInvitation.update({
          where: { id: invitation.id },
          data: { status: 'REVOKED', revokedAt: new Date() },
        }),
        this.prisma.staffProfile.update({
          where: { id: profile.id },
          data: { status: 'PROFILE_ONLY' },
        }),
      ]);
      throw new BadRequestException('Không thể gửi email lời mời');
    }

    return {
      id: invitation.id,
      staffProfileId: profile.id,
      email: invitation.email,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    };
  }

  async list(input: { businessId: string; branchId?: string }) {
    await this.expirePending();
    return this.prisma.staffInvitation.findMany({
      where: {
        businessId: input.businessId,
        ...(input.branchId ? { branchId: input.branchId } : {}),
      },
      select: {
        id: true,
        staffProfileId: true,
        email: true,
        roleCode: true,
        businessId: true,
        branchId: true,
        status: true,
        expiresAt: true,
        acceptedAt: true,
        acceptedBy: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
        staffProfile: { select: { id: true, fullName: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getContext(token: string) {
    const invitation = await this.findPendingToken(token);
    const [branch, business, existingAccount] = await Promise.all([
      invitation.branchId
        ? this.prisma.branch.findUnique({
            where: { id: invitation.branchId },
            select: { id: true, name: true },
          })
        : null,
      this.prisma.business.findUnique({
        where: { id: invitation.businessId },
        select: { id: true, name: true },
      }),
      this.prisma.user.findUnique({
        where: { email: invitation.email },
        select: { id: true },
      }),
    ]);
    return {
      invitationId: invitation.id,
      email: invitation.email,
      roleCode: invitation.roleCode,
      expiresAt: invitation.expiresAt,
      existingAccount: Boolean(existingAccount),
      staffProfile: invitation.staffProfile,
      branch,
      business,
    };
  }

  async resend(id: string, actorId: string) {
    const current = await this.prisma.staffInvitation.findUnique({ where: { id } });
    if (!current?.staffProfileId || current.status === 'ACCEPTED') {
      throw new BadRequestException('Lời mời không thể gửi lại');
    }
    return this.invite({
      staffProfileId: current.staffProfileId,
      email: current.email,
      roleCode: current.roleCode as StaffRoleCode,
      businessId: current.businessId,
      branchId: current.branchId!,
      invitedBy: actorId,
    });
  }

  async changeEmail(id: string, email: string, actorId: string) {
    const current = await this.prisma.staffInvitation.findUnique({ where: { id } });
    if (!current?.staffProfileId || current.status !== 'PENDING') {
      throw new BadRequestException('Chỉ lời mời đang chờ mới được đổi email');
    }
    return this.invite({
      staffProfileId: current.staffProfileId,
      email,
      roleCode: current.roleCode as StaffRoleCode,
      businessId: current.businessId,
      branchId: current.branchId!,
      invitedBy: actorId,
    });
  }

  async revoke(id: string, actorId: string) {
    const invitation = await this.prisma.staffInvitation.findUnique({ where: { id } });
    if (!invitation) throw new NotFoundException('Lời mời không tồn tại');
    if (invitation.status !== 'PENDING') throw new BadRequestException('Lời mời không còn ở trạng thái chờ');
    await this.prisma.$transaction(async (tx) => {
      await tx.staffInvitation.update({
        where: { id },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      if (invitation.staffProfileId) {
        await tx.staffProfile.updateMany({
          where: { id: invitation.staffProfileId, userId: null },
          data: { status: 'PROFILE_ONLY' },
        });
      }
    });
    await auditLog(this.prisma, {
      userId: actorId,
      action: 'STATUS_CHANGE',
      entityType: 'StaffInvitation',
      entityId: id,
      reason: 'Thu hồi lời mời nhân sự',
    });
    return { ok: true };
  }

  async accept(input: { token: string; fullName: string; password: string; phone?: string }) {
    if (!input.fullName || input.password.length < 8) {
      throw new BadRequestException('Tên và mật khẩu ít nhất 8 ký tự là bắt buộc');
    }
    const invitation = await this.findPendingToken(input.token);
    const existing = await this.prisma.user.findUnique({ where: { email: invitation.email } });
    if (existing) {
      throw new ConflictException({
        message: 'Email đã có tài khoản; hãy đăng nhập rồi chấp nhận lời mời',
        code: 'EXISTING_ACCOUNT_LOGIN_REQUIRED',
      });
    }
    const user = await this.prisma.user.create({
      data: {
        email: invitation.email,
        passwordHash: await bcrypt.hash(input.password, 12),
        fullName: input.fullName.trim(),
        phone: input.phone,
        isEmailVerified: true,
      },
    });
    try {
      return await this.activateInvitation(invitation.id, user.id);
    } catch (error) {
      await this.prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
      throw error;
    }
  }

  async acceptExisting(token: string, userId: string) {
    const invitation = await this.findPendingToken(token);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.isActive || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenException('Lời mời không dành cho tài khoản đang đăng nhập');
    }
    return this.activateInvitation(invitation.id, user.id);
  }

  private async activateInvitation(invitationId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.staffInvitation.findFirst({
        where: { id: invitationId, status: 'PENDING', expiresAt: { gt: new Date() } },
      });
      if (!invitation?.staffProfileId || !invitation.branchId) {
        throw new NotFoundException('Lời mời không còn hợp lệ');
      }
      const profile = await tx.staffProfile.findUnique({ where: { id: invitation.staffProfileId } });
      if (!profile || (profile.userId && profile.userId !== userId)) {
        throw new ConflictException('Hồ sơ nhân sự đã liên kết tài khoản khác');
      }
      const otherProfile = await tx.staffProfile.findFirst({
        where: { userId, id: { not: profile.id } },
        select: { id: true },
      });
      if (otherProfile) throw new ConflictException('Tài khoản đã liên kết một hồ sơ nhân sự khác');
      const role = await tx.role.findUnique({ where: { code: invitation.roleCode } });
      if (!role) throw new NotFoundException('Role không tồn tại');
      const existingRole = await tx.userRole.findFirst({
        where: {
          userId,
          roleId: role.id,
          businessId: invitation.businessId,
          branchId: invitation.branchId,
        },
      });
      if (!existingRole) {
        await tx.userRole.create({
          data: {
            userId,
            roleId: role.id,
            businessId: invitation.businessId,
            branchId: invitation.branchId,
            grantedBy: invitation.invitedBy,
          },
        });
      }
      await tx.staffProfile.update({
        where: { id: profile.id },
        data: { userId, status: 'ACTIVE' },
      });
      await tx.staffBranchAssignment.updateMany({
        where: { staffId: profile.id, branchId: invitation.branchId },
        data: { status: 'ACTIVE' },
      });
      await tx.staffInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date(), acceptedBy: userId },
      });
      return {
        ok: true,
        userId,
        staffProfileId: profile.id,
        roleCode: invitation.roleCode,
        workspace: 'SALON' as const,
      };
    });
  }

  private async findPendingToken(token: string) {
    const invitation = await this.prisma.staffInvitation.findFirst({
      where: {
        tokenHash: this.hash(token),
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      include: {
        staffProfile: { select: { id: true, fullName: true, position: true } },
      },
    });
    if (!invitation) throw new NotFoundException('Invitation không hợp lệ hoặc đã hết hạn');
    return invitation;
  }

  private async expirePending() {
    const expired = await this.prisma.staffInvitation.findMany({
      where: { status: 'PENDING', expiresAt: { lte: new Date() } },
      select: { id: true, staffProfileId: true },
    });
    if (!expired.length) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.staffInvitation.updateMany({
        where: { id: { in: expired.map((item) => item.id) } },
        data: { status: 'EXPIRED' },
      });
      await tx.staffProfile.updateMany({
        where: {
          id: { in: expired.map((item) => item.staffProfileId).filter(Boolean) as string[] },
          userId: null,
        },
        data: { status: 'PROFILE_ONLY' },
      });
    });
  }

  private async sendInvitationEmail(email: string, roleCode: StaffRoleCode, token: string) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    await this.mail.sendMail(
      email,
      'BeautyBook - Lời mời tham gia cơ sở',
      `<p>Bạn được mời với vai trò <b>${roleCode}</b>.</p><p><a href="${frontendUrl}/accept-invitation?token=${token}">Chấp nhận lời mời</a></p>`,
    );
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
