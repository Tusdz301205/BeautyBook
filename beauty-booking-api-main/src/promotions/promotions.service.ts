import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  resolveBusinessIdsForUser,
  ALL_TENANTS,
} from '../common/utils/multi-tenancy';
import { can } from '../common/utils/policy';
import { isPlatformRole } from '../common/utils/scope-helpers';

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy danh sách khuyến mãi (scoped theo tenant).
   */
  async findAll(user: AuthUser, filters?: { businessId?: string; branchId?: string; status?: string }) {
    const allowedIds = await resolveBusinessIdsForUser(this.prisma, user);
    const where: any = { deletedAt: null };

    if (filters?.status) where.status = filters.status;

    // Scope filtering
    if (!allowedIds.includes(ALL_TENANTS)) {
      const branchIds = (user.scopes ?? []).map((scope) => scope.branchId).filter((id): id is string => Boolean(id));
      if (user.roles.includes('BRANCH_MANAGER')) {
        where.branchLinks = { some: { branchId: { in: branchIds } } };
      } else {
        where.businessLinks = { some: { businessId: { in: allowedIds } } };
      }
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
      const allowedBranchIds = (user.scopes ?? []).map((scope) => scope.branchId).filter(Boolean);
      if (!allowedIds.includes(ALL_TENANTS) && user.roles.includes('BRANCH_MANAGER') &&
          !allowedBranchIds.includes(filters.branchId)) {
        throw new ForbiddenException('Không có quyền xem campaign của chi nhánh này');
      }
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
  }, ownerBusinessId: string | null, createdByPlatform: boolean, user: AuthUser) {
    const platformActor = isPlatformRole(user);
    if (platformActor !== createdByPlatform) {
      throw new ForbiddenException('Nguồn sở hữu campaign không khớp với không gian làm việc');
    }
    const tenantTargets = [
      ...(data.businessIds ?? []),
      ...(data.branchIds ?? []),
      ...(data.serviceIds ?? []),
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
      await this.validateTargets(ownerBusinessId, data.branchIds ?? [], data.serviceIds ?? []);
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
    },
    user: AuthUser,
  ) {
    await this.assertOwnership(id, user);
    const current = await this.prisma.promotion.findUnique({
      where: { id },
      select: { startDate: true, endDate: true, discountType: true },
    });
    if (!current) throw new NotFoundException('Khuyến mãi không tồn tại');
    const startDate = data.startDate ? new Date(data.startDate) : current.startDate;
    const endDate = data.endDate ? new Date(data.endDate) : current.endDate;
    if (endDate <= startDate) throw new BadRequestException('endDate phải sau startDate');
    if (data.discountValue !== undefined &&
        ((data.discountType ?? current.discountType) === 'PERCENTAGE' && data.discountValue > 100)) {
      throw new BadRequestException('Giảm theo phần trăm không được vượt quá 100');
    }
    return this.prisma.promotion.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.discountType !== undefined && { discountType: data.discountType }),
        ...(data.discountValue !== undefined && { discountValue: data.discountValue as any }),
        ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
        ...(data.endDate !== undefined && { endDate: new Date(data.endDate) }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });
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

  private async validateTargets(businessId: string, branchIds: string[], serviceIds: string[]) {
    const [branchCount, serviceCount] = await Promise.all([
      this.prisma.branch.count({ where: { id: { in: branchIds }, businessId } }),
      this.prisma.branchServiceOffering.count({ where: { id: { in: serviceIds }, branch: { businessId } } }),
    ]);
    if (branchCount !== branchIds.length || serviceCount !== serviceIds.length) {
      throw new ForbiddenException('Campaign chứa branch/service ngoài tenant');
    }
  }

  private assertTenantTargets(ownerBusinessId: string, businessIds: string[]) {
    if (businessIds.some((businessId) => businessId !== ownerBusinessId)) {
      throw new ForbiddenException('Campaign không được liên kết sang doanh nghiệp khác');
    }
  }
}
