import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  resolveBusinessIdsForUser,
  restrictToRoles,
  assertBranchAccess,
  ALL_TENANTS,
} from '../common/utils/multi-tenancy';
import { can } from '../common/utils/policy';
import { isPlatformRole } from '../common/utils/scope-helpers';
import { withSerializableTransaction } from '../common/utils/serializable-transaction';

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy danh sách khuyến mãi (scoped theo tenant).
   */
  async findAll(user: AuthUser, filters?: { businessId?: string; branchId?: string; status?: string }) {
    const allowedIds = await resolveBusinessIdsForUser(this.prisma, restrictToRoles(user, ['BUSINESS_OWNER', 'PLATFORM_ADMIN']));
    const where: any = { deletedAt: null };

    if (filters?.status) where.status = filters.status;

    // Scope filtering
    if (!allowedIds.includes(ALL_TENANTS)) {
      where.businessLinks = { some: { businessId: { in: allowedIds } } };
    }

    if (filters?.businessId) {
      if (!allowedIds.includes(ALL_TENANTS) && !allowedIds.includes(filters.businessId)) {
        throw new ForbiddenException('Không có quyền xem campaign của tenant này');
      }
      where.businessLinks = {
        some: { businessId: filters.businessId },
      };
    }
    if (filters?.branchId) {
      await assertBranchAccess(this.prisma, restrictToRoles(user, ['BUSINESS_OWNER', 'PLATFORM_ADMIN']), filters.branchId);
      where.branchLinks = { some: { branchId: filters.branchId } };
    }

    const promotions = await this.prisma.promotion.findMany({
      where,
      include: {
        businessLinks: {
          include: {
            business: { select: { id: true, name: true } },
          },
        },
        branchLinks: {
          include: {
            branch: { select: { id: true, name: true } },
          },
        },
        serviceLinks: {
          include: {
            service: { select: { id: true, name: true } },
          },
        },
        comboLinks: { include: { combo: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return promotions.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      discountType: p.discountType,
      discountValue: Number(p.discountValue),
      startDate: p.startDate,
      endDate: p.endDate,
      status: p.status,
      businesses: p.businessLinks.map((bl) => ({
        id: bl.business.id,
        name: bl.business.name,
      })),
      branches: p.branchLinks.map((bl) => ({
        id: bl.branch.id,
        name: bl.branch.name,
      })),
      services: p.serviceLinks.map((sl) => ({
        id: sl.service.id,
        name: sl.service.name,
      })),
      combos: p.comboLinks.map((link) => ({ id: link.combo.id, name: link.combo.name })),
      audience: p.audience,
      totalQuantity: p.totalQuantity,
      maxUsagePerCustomer: p.maxUsagePerCustomer,
      autoApply: p.autoApply,
      stackingAllowed: p.stackingAllowed,
      version: p.version,
    }));
  }

  /**
   * Tạo khuyến mãi.
   */
  async create(data: {
    name: string;
    description?: string;
    discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
    discountValue: number;
    startDate: string;
    endDate: string;
    businessIds?: string[];
    branchIds?: string[];
    serviceIds?: string[];
    comboIds?: string[];
    audience?: 'ALL' | 'NEW_CUSTOMER' | 'RETURNING_CUSTOMER' | 'BIRTHDAY' | 'VIP' | 'SELECTED';
    totalQuantity?: number;
    maxUsagePerCustomer?: number;
    autoApply?: boolean;
    stackingAllowed?: boolean;
  }, ownerBusinessId: string | null, createdByPlatform: boolean, user: AuthUser) {
    const platformActor = isPlatformRole(user);
    if (platformActor !== createdByPlatform) {
      throw new ForbiddenException('Nguồn sở hữu campaign không khớp với không gian làm việc');
    }
    const tenantTargets = [
      ...(data.businessIds ?? []),
      ...(data.branchIds ?? []),
      ...(data.serviceIds ?? []),
      ...(data.comboIds ?? []),
    ];
    if (platformActor) {
      if (ownerBusinessId || tenantTargets.length > 0) {
        throw new ForbiddenException('Platform không được tạo campaign vận hành cho doanh nghiệp');
      }
    } else {
      if (!ownerBusinessId) {
        throw new BadRequestException('Campaign doanh nghiệp phải có businessId sở hữu');
      }
      this.assertTenantTargets(ownerBusinessId, data.businessIds ?? []);
      await this.validateTargets(ownerBusinessId, data.branchIds ?? [], data.serviceIds ?? [], data.comboIds ?? []);
    }
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
      throw new BadRequestException('endDate phải sau startDate');
    }
    if (!Number.isFinite(data.discountValue) || data.discountValue <= 0 ||
        (data.discountType === 'PERCENTAGE' && data.discountValue > 100)) {
      throw new BadRequestException('Giá trị khuyến mãi không hợp lệ');
    }
    return this.prisma.promotion.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        discountType: data.discountType,
        discountValue: data.discountValue as any,
        startDate,
        endDate,
        businessId: ownerBusinessId,
        createdByPlatform,
        audience: data.audience ?? 'ALL',
        totalQuantity: data.totalQuantity ?? null,
        maxUsagePerCustomer: data.maxUsagePerCustomer ?? 1,
        autoApply: data.autoApply ?? true,
        stackingAllowed: data.stackingAllowed ?? false,
        businessLinks: data.businessIds?.length
          ? {
              createMany: {
                data: data.businessIds.map((id) => ({ businessId: id })),
              },
            }
          : undefined,
        branchLinks: data.branchIds?.length
          ? {
              createMany: {
                data: data.branchIds.map((id) => ({ branchId: id })),
              },
            }
          : undefined,
        serviceLinks: data.serviceIds?.length
          ? {
              createMany: {
                data: data.serviceIds.map((id) => ({ serviceId: id })),
              },
            }
          : undefined,
        comboLinks: data.comboIds?.length
          ? { createMany: { data: data.comboIds.map((comboId) => ({ comboId })) } }
          : undefined,
      },
      include: {
        businessLinks: true,
        branchLinks: true,
        serviceLinks: true,
      },
    });
  }

  /**
   * Cập nhật khuyến mãi.
   */
  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      discountType?: 'PERCENTAGE' | 'FIXED_AMOUNT';
      discountValue?: number;
      startDate?: string;
      endDate?: string;
      status?: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
      audience?: 'ALL' | 'NEW_CUSTOMER' | 'RETURNING_CUSTOMER' | 'BIRTHDAY' | 'VIP' | 'SELECTED';
      totalQuantity?: number;
      maxUsagePerCustomer?: number;
      autoApply?: boolean;
      stackingAllowed?: boolean;
      branchIds?: string[];
      serviceIds?: string[];
      comboIds?: string[];
    },
    user: AuthUser,
  ) {
    await this.assertOwnership(id, user);
    const current = await this.prisma.promotion.findUnique({
      where: { id },
      select: { startDate: true, endDate: true, discountType: true, businessId: true, createdByPlatform: true },
    });
    if (!current) throw new NotFoundException('Khuyến mãi không tồn tại');
    const startDate = data.startDate ? new Date(data.startDate) : current.startDate;
    const endDate = data.endDate ? new Date(data.endDate) : current.endDate;
    if (endDate <= startDate) throw new BadRequestException('endDate phải sau startDate');
    if (data.discountValue !== undefined &&
        ((data.discountType ?? current.discountType) === 'PERCENTAGE' && data.discountValue > 100)) {
      throw new BadRequestException('Giảm theo phần trăm không được vượt quá 100');
    }
    if (data.totalQuantity !== undefined && (!Number.isInteger(data.totalQuantity) || data.totalQuantity < 1)) {
      throw new BadRequestException('Tổng lượt khuyến mãi phải là số nguyên dương');
    }
    if (data.maxUsagePerCustomer !== undefined && (!Number.isInteger(data.maxUsagePerCustomer) || data.maxUsagePerCustomer < 1)) {
      throw new BadRequestException('Giới hạn mỗi khách phải là số nguyên dương');
    }
    const scopesChanged = data.branchIds !== undefined || data.serviceIds !== undefined || data.comboIds !== undefined;
    if (scopesChanged) {
      if (current.createdByPlatform || !current.businessId) {
        if ((data.branchIds?.length ?? 0) + (data.serviceIds?.length ?? 0) + (data.comboIds?.length ?? 0) > 0) {
          throw new ForbiddenException('Campaign platform khong duoc gan pham vi van hanh doanh nghiep');
        }
      } else {
        await this.validateTargets(current.businessId, data.branchIds ?? [], data.serviceIds ?? [], data.comboIds ?? []);
      }
    }
    return withSerializableTransaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM promotions WHERE id = ${id} FOR UPDATE`;
      const [activeCount, perCustomer] = await Promise.all([
        tx.promotionRedemption.count({ where: { promotionId: id, status: { in: ['RESERVED', 'APPLIED'] } } }),
        tx.promotionRedemption.groupBy({
          by: ['customerId'],
          where: { promotionId: id, status: { in: ['RESERVED', 'APPLIED'] } },
          _count: { _all: true },
        }),
      ]);
      if (data.totalQuantity !== undefined && data.totalQuantity < activeCount) {
        throw new ConflictException(`Không thể giảm quota dưới ${activeCount} lượt đã reserve/sử dụng`);
      }
      const highestCustomerUsage = perCustomer.reduce((max, row) => Math.max(max, row._count._all), 0);
      if (data.maxUsagePerCustomer !== undefined && data.maxUsagePerCustomer < highestCustomerUsage) {
        throw new ConflictException(`Không thể giảm giới hạn mỗi khách dưới ${highestCustomerUsage} lượt đã reserve/sử dụng`);
      }
      const updated = await tx.promotion.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.discountType !== undefined && { discountType: data.discountType }),
          ...(data.discountValue !== undefined && { discountValue: data.discountValue as any }),
          ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
          ...(data.endDate !== undefined && { endDate: new Date(data.endDate) }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.audience !== undefined && { audience: data.audience }),
          ...(data.totalQuantity !== undefined && { totalQuantity: data.totalQuantity }),
          ...(data.maxUsagePerCustomer !== undefined && { maxUsagePerCustomer: data.maxUsagePerCustomer }),
          ...(data.autoApply !== undefined && { autoApply: data.autoApply }),
          ...(data.stackingAllowed !== undefined && { stackingAllowed: data.stackingAllowed }),
          version: { increment: 1 },
        },
      });
      if (scopesChanged) {
        if (data.branchIds !== undefined) {
          await tx.promotionBranch.deleteMany({ where: { promotionId: id } });
          if (data.branchIds.length) await tx.promotionBranch.createMany({ data: data.branchIds.map((branchId) => ({ promotionId: id, branchId })) });
        }
        if (data.serviceIds !== undefined) {
          await tx.promotionService.deleteMany({ where: { promotionId: id } });
          if (data.serviceIds.length) await tx.promotionService.createMany({ data: data.serviceIds.map((serviceId) => ({ promotionId: id, serviceId })) });
        }
        if (data.comboIds !== undefined) {
          await tx.promotionCombo.deleteMany({ where: { promotionId: id } });
          if (data.comboIds.length) await tx.promotionCombo.createMany({ data: data.comboIds.map((comboId) => ({ promotionId: id, comboId })) });
        }
      }
      return updated;
    }, { conflictMessage: 'Khuyến mãi vừa thay đổi hoặc có lượt sử dụng mới' });
  }

  /**
   * Xóa mềm khuyến mãi.
   */
  async softDelete(id: string, user: AuthUser) {
    await this.assertOwnership(id, user);
    return this.prisma.promotion.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
  }

  /**
   * Lấy khuyến mãi đang áp dụng cho 1 dịch vụ cụ thể (public — cho booking flow).
   */
  async getActiveForService(serviceId: string) {
    const now = new Date();
    return this.prisma.promotion.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        startDate: { lte: now },
        endDate: { gte: now },
        serviceLinks: { some: { serviceId } },
      },
      select: {
        id: true,
        name: true,
        discountType: true,
        discountValue: true,
        endDate: true,
      },
    });
  }

  private async assertExists(id: string) {
    const promo = await this.prisma.promotion.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!promo) throw new NotFoundException('Khuyến mãi không tồn tại');
  }

  private async assertOwnership(id: string, user: AuthUser) {
    const promotion = await this.prisma.promotion.findUnique({
      where: { id },
      select: {
        businessId: true,
        createdByPlatform: true,
        businessLinks: { select: { businessId: true } },
        branchLinks: { select: { branch: { select: { id: true, businessId: true } } } },
        serviceLinks: { select: { service: { select: { branch: { select: { businessId: true } } } } } },
      },
    });
    if (!promotion) throw new NotFoundException('Khuyến mãi không tồn tại');
    if (isPlatformRole(user)) {
      const hasTenantTarget = Boolean(
        promotion.businessId ||
        promotion.businessLinks.length ||
        promotion.branchLinks.length ||
        promotion.serviceLinks.length
      );
      if (!promotion.createdByPlatform || hasTenantTarget) {
        throw new ForbiddenException('Platform không được quản lý campaign vận hành của doanh nghiệp');
      }
      return;
    }
    const ownerIds = new Set([
      ...(promotion.businessId ? [promotion.businessId] : []),
      ...promotion.businessLinks.map((link) => link.businessId),
    ]);
    if (promotion.createdByPlatform) throw new ForbiddenException('Không có quyền sửa campaign platform');
    if ([...ownerIds].some((id) => can(user, 'promotion:manage:tenant', { tenantId: id }))) return;
    throw new ForbiddenException('Không có quyền sửa campaign này');
  }

  private async validateTargets(businessId: string, branchIds: string[], serviceIds: string[], comboIds: string[] = []) {
    const [branchCount, serviceCount, comboCount] = await Promise.all([
      this.prisma.branch.count({ where: { id: { in: branchIds }, businessId } }),
      this.prisma.branchServiceOffering.count({ where: { id: { in: serviceIds }, branch: { businessId } } }),
      this.prisma.combo.count({ where: { id: { in: comboIds }, businessId } }),
    ]);
    if (branchCount !== branchIds.length || serviceCount !== serviceIds.length || comboCount !== comboIds.length) {
      throw new ForbiddenException('Campaign chứa branch/service ngoài tenant');
    }
  }

  private assertTenantTargets(ownerBusinessId: string, businessIds: string[]) {
    if (businessIds.some((businessId) => businessId !== ownerBusinessId)) {
      throw new ForbiddenException('Campaign không được liên kết sang doanh nghiệp khác');
    }
  }
}
