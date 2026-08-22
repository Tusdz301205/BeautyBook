import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { ALL_TENANTS, assertBusinessAccess, resolveBusinessIdsForUser } from '../common/utils/multi-tenancy';
import { isPlatformRole } from '../common/utils/scope-helpers';

@Injectable()
export class VouchersAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async findMine(userId: string) {
    const profile = await this.prisma.customerProfile.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    if (!profile) return [];

    const assignments = await this.prisma.customerVoucher.findMany({
      where: { customerId: profile.id },
      include: {
        voucher: {
          include: {
            business: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      orderBy: { acquiredAt: 'desc' },
    });
    const now = new Date();

    return assignments.map((assignment) => {
      const voucher = assignment.voucher;
      const expiresAt = assignment.expiresAt && assignment.expiresAt < voucher.endDate
        ? assignment.expiresAt
        : voucher.endDate;
      const isExpired = expiresAt < now || voucher.status === 'EXPIRED';
      const isUsed = assignment.status === 'USED' || Boolean(assignment.usedAt);
      const isRevoked = assignment.status === 'REVOKED' || voucher.status === 'REVOKED' || Boolean(voucher.deletedAt);
      const displayStatus = isUsed ? 'USED' : isRevoked ? 'REVOKED' : isExpired ? 'EXPIRED' : assignment.status;
      return {
        id: assignment.id,
        status: displayStatus,
        acquiredAt: assignment.acquiredAt,
        usedAt: assignment.usedAt,
        expiresAt,
        usedBookingId: assignment.usedBookingId,
        isUsable: displayStatus === 'ACTIVE' && voucher.status === 'ACTIVE' && voucher.startDate <= now,
        voucher: {
          id: voucher.id,
          code: voucher.code,
          name: voucher.name,
          description: voucher.description,
          discountType: voucher.discountType,
          discountValue: Number(voucher.discountValue),
          minOrderValue: Number(voucher.minOrderValue),
          maxDiscount: voucher.maxDiscount ? Number(voucher.maxDiscount) : null,
          startDate: voucher.startDate,
          endDate: voucher.endDate,
          scope: voucher.scope,
          business: voucher.business,
        },
      };
    });
  }

  /**
   * Lấy danh sách voucher.
   */
  async findAll(user: AuthUser, filters?: { status?: string }) {
    const where: any = { deletedAt: null };
    if (filters?.status) where.status = filters.status;
    const allowedIds = await resolveBusinessIdsForUser(this.prisma, user);
    if (!allowedIds.includes(ALL_TENANTS)) where.businessId = { in: allowedIds };

    const vouchers = await this.prisma.voucher.findMany({
      where,
      include: {
        _count: { select: { customerVouchers: true, bookings: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return vouchers.map((v) => ({
      id: v.id,
      code: v.code,
      name: v.name,
      description: v.description,
      discountType: v.discountType,
      discountValue: Number(v.discountValue),
      minOrderValue: Number(v.minOrderValue),
      maxDiscount: v.maxDiscount ? Number(v.maxDiscount) : null,
      totalQuantity: v.totalQuantity,
      usedQuantity: v.usedQuantity,
      remaining: v.totalQuantity - v.usedQuantity,
      startDate: v.startDate,
      endDate: v.endDate,
      status: v.status,
      claimedCount: v._count.customerVouchers,
      usedInBookings: v._count.bookings,
      audience: v.audience,
      autoIssue: v.autoIssue,
    }));
  }

  /**
   * Tạo voucher mới.
   */
  async create(data: {
    code: string;
    name: string;
    description?: string;
    discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
    discountValue: number;
    minOrderValue?: number;
    maxDiscount?: number;
    totalQuantity: number;
    startDate: string;
      endDate: string;
      scope?: 'PLATFORM' | 'TENANT' | 'CUSTOMER' | 'COMPENSATION' | 'CAMPAIGN';
      audience?: 'ALL' | 'NEW_CUSTOMER' | 'RETURNING_CUSTOMER' | 'BIRTHDAY' | 'VIP' | 'SELECTED';
      autoIssue?: boolean;
    }, businessId: string | null, createdByPlatform: boolean, user: AuthUser) {
    const platformActor = isPlatformRole(user);
    if (platformActor !== createdByPlatform) {
      throw new ForbiddenException('Nguồn sở hữu voucher không khớp với không gian làm việc');
    }
    if (platformActor) {
      if (businessId || data.scope === 'TENANT') {
        throw new ForbiddenException('Platform không được tạo voucher thuộc doanh nghiệp');
      }
    } else {
      if (!businessId) {
        throw new BadRequestException('Voucher doanh nghiệp phải có businessId');
      }
      if (data.scope === 'PLATFORM') {
        throw new ForbiddenException('Doanh nghiệp không được tạo voucher Platform');
      }
    }
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate >= endDate) {
      throw new BadRequestException('Thời gian voucher không hợp lệ');
    }
    if (!Number.isInteger(data.totalQuantity) || data.totalQuantity <= 0 ||
        !Number.isFinite(data.discountValue) || data.discountValue <= 0 ||
        (data.discountType === 'PERCENTAGE' && data.discountValue > 100)) {
      throw new BadRequestException('Giá trị giảm và số lượng voucher không hợp lệ');
    }
    if (businessId) await assertBusinessAccess(this.prisma, user, businessId);
    const code = data.code.trim().toUpperCase();
    // Check unique code
    const existing = await this.prisma.voucher.findUnique({
      where: { code },
    });
    if (existing) {
      throw new BadRequestException(`Mã voucher "${data.code}" đã tồn tại`);
    }

    return this.prisma.voucher.create({
      data: {
        code,
        name: data.name,
        description: data.description ?? null,
        discountType: data.discountType,
        discountValue: data.discountValue as any,
        minOrderValue: (data.minOrderValue ?? 0) as any,
        maxDiscount: data.maxDiscount ? (data.maxDiscount as any) : null,
        totalQuantity: data.totalQuantity,
        startDate,
        endDate,
        businessId,
        createdByPlatform,
        scope: (createdByPlatform ? (data.scope ?? 'PLATFORM') : (data.scope ?? 'TENANT')) as any,
        audience: data.audience ?? 'ALL',
        autoIssue: data.autoIssue ?? false,
      },
    });
  }

  /**
   * Cập nhật voucher.
   */
  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      totalQuantity?: number;
      endDate?: string;
      status?: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
      audience?: 'ALL' | 'NEW_CUSTOMER' | 'RETURNING_CUSTOMER' | 'BIRTHDAY' | 'VIP' | 'SELECTED';
      autoIssue?: boolean;
    },
    user: AuthUser,
  ) {
    await this.assertOwnership(id, user);
    const current = await this.prisma.voucher.findUnique({
      where: { id },
      select: { usedQuantity: true, startDate: true },
    });
    if (!current) throw new NotFoundException('Voucher không tồn tại');
    if (data.totalQuantity !== undefined && data.totalQuantity < current.usedQuantity) {
      throw new BadRequestException('Số lượng tổng không thể nhỏ hơn số lượt đã dùng');
    }
    if (data.endDate && new Date(data.endDate) <= current.startDate) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }
    return this.prisma.voucher.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.totalQuantity !== undefined && { totalQuantity: data.totalQuantity }),
        ...(data.endDate !== undefined && { endDate: new Date(data.endDate) }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.audience !== undefined && { audience: data.audience }),
        ...(data.autoIssue !== undefined && { autoIssue: data.autoIssue }),
      },
    });
  }

  /**
   * Phát voucher cho khách hàng cụ thể.
   */
  async grantToCustomer(voucherId: string, customerId: string, user: AuthUser) {
    const customerReference = customerId.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(customerReference)) {
      const matches = await this.prisma.customerProfile.findMany({
        where: {
          deletedAt: null,
          user: {
            OR: [
              { email: { equals: customerReference, mode: 'insensitive' } },
              { phone: { equals: customerReference } },
              { fullName: { equals: customerReference, mode: 'insensitive' } },
            ],
          },
        },
        select: { id: true },
        take: 2,
      });
      if (matches.length !== 1) {
        throw new BadRequestException(matches.length ? 'Có nhiều khách hàng trùng tên; hãy dùng email hoặc số điện thoại' : 'Không tìm thấy khách hàng');
      }
      customerId = matches[0].id;
    }
    const voucher = await this.prisma.voucher.findUnique({
      where: { id: voucherId },
    });
    if (!voucher) throw new NotFoundException('Voucher không tồn tại');
    await this.assertOwnership(voucherId, user);
    if (voucher.status !== 'ACTIVE') {
      throw new BadRequestException('Voucher không còn hoạt động');
    }
    if (voucher.businessId) {
      const branchIds = user.roles.includes('BRANCH_MANAGER')
        ? (user.scopes ?? []).map((scope) => scope.branchId).filter((id): id is string => Boolean(id))
        : null;
      const related = await this.prisma.booking.findFirst({
        where: {
          customerId,
          branch: { businessId: voucher.businessId },
          ...(branchIds ? { branchId: { in: branchIds } } : {}),
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!related) {
        throw new ForbiddenException('Khách hàng chưa có quan hệ với tenant của voucher');
      }
    }

    // Check if already granted
    const existing = await this.prisma.customerVoucher.findUnique({
      where: {
        voucherId_customerId: { voucherId, customerId },
      },
    });
    if (existing) {
      throw new BadRequestException('Khách hàng đã có voucher này');
    }

    return this.prisma.customerVoucher.create({
      data: {
        voucherId,
        customerId,
        expiresAt: voucher.endDate,
      },
    });
  }

  /**
   * Xóa mềm voucher.
   */
  async softDelete(id: string, user: AuthUser) {
    await this.assertOwnership(id, user);
    return this.prisma.voucher.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'REVOKED' },
    });
  }

  private async assertExists(id: string) {
    const v = await this.prisma.voucher.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!v) throw new NotFoundException('Voucher không tồn tại');
  }

  private async assertOwnership(id: string, user: AuthUser) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id },
      select: { businessId: true, createdByPlatform: true },
    });
    if (!voucher) throw new NotFoundException('Voucher không tồn tại');
    if (isPlatformRole(user)) {
      if (voucher.businessId || !voucher.createdByPlatform) {
        throw new ForbiddenException('Platform không được quản lý voucher thuộc doanh nghiệp');
      }
      return;
    }
    const allowedIds = await resolveBusinessIdsForUser(this.prisma, user);
    if (!voucher.businessId || voucher.createdByPlatform || !allowedIds.includes(voucher.businessId)) {
      throw new ForbiddenException('Không có quyền quản lý voucher này');
    }
    await assertBusinessAccess(this.prisma, user, voucher.businessId);
  }
}
