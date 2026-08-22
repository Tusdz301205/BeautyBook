import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { ALL_TENANTS, assertBranchAccess, resolveBusinessIdsForUser } from '../common/utils/multi-tenancy';
import type { CreateComboDto } from './dto/combos.dto';

const includeCombo = {
  branch: { select: { id: true, name: true, businessId: true } },
  comboServices: {
    orderBy: { sortOrder: 'asc' as const },
    include: { service: { include: { images: { include: { media: true } } } } },
  },
  images: { include: { media: true }, orderBy: { sortOrder: 'asc' as const } },
};

@Injectable()
export class CombosService {
  constructor(private readonly prisma: PrismaService) {}

  async publicList(branchId?: string) {
    const now = new Date();
    const rows = await this.prisma.combo.findMany({
      where: {
        branchId: branchId || undefined,
        deletedAt: null,
        status: 'ACTIVE',
        OR: [{ validFrom: null }, { validFrom: { lte: now } }],
        AND: [
          { OR: [{ validTo: null }, { validTo: { gte: now } }] },
        ],
        branch: {
          status: 'ACTIVE',
          reviewStatus: 'APPROVED',
          operationalStatus: 'ACTIVE',
          deletedAt: null,
          business: { status: { in: ['APPROVED', 'ACTIVE'] }, deletedAt: null },
        },
        comboServices: {
          every: { service: { status: 'ACTIVE', deletedAt: null } },
        },
      } as any,
      include: includeCombo,
      orderBy: { createdAt: 'desc' },
    });
    return rows
      .filter((row) => row.maxUsage === null || row.usedCount < row.maxUsage)
      .map((row) => this.present(row));
  }

  async list(user: AuthUser, filter: { branchId?: string; businessId?: string }) {
    const allowed = await resolveBusinessIdsForUser(this.prisma, user);
    if (filter.branchId) await assertBranchAccess(this.prisma, user, filter.branchId);
    const rows = await this.prisma.combo.findMany({
      where: {
        deletedAt: null,
        branchId: filter.branchId,
        branch: allowed.includes(ALL_TENANTS)
          ? { businessId: filter.businessId }
          : { businessId: { in: filter.businessId ? allowed.filter((id) => id === filter.businessId) : allowed } },
      },
      include: includeCombo,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.present(row));
  }

  async detail(id: string, user: AuthUser) {
    const combo = await this.prisma.combo.findFirst({ where: { id, deletedAt: null }, include: includeCombo });
    if (!combo) throw new NotFoundException('Combo không tồn tại');
    const customerOnly = user.roles.includes('CUSTOMER') && !user.roles.some((role) => ['PLATFORM_ADMIN', 'BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST'].includes(role));
    if (!customerOnly) await assertBranchAccess(this.prisma, user, combo.branchId);
    if (customerOnly && combo.status !== 'ACTIVE') throw new NotFoundException('Combo không tồn tại');
    return this.present(combo);
  }

  async create(input: CreateComboDto, user: AuthUser) {
    await assertBranchAccess(this.prisma, user, input.branchId);
    const validated = await this.validate(input);
    const combo = await this.prisma.combo.create({
      data: {
        businessId: validated.businessId,
        branchId: input.branchId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        comboPrice: input.comboPrice,
        pricingMode: input.pricingMode ?? 'FIXED_PRICE',
        staffAssignmentMode: input.staffAssignmentMode ?? 'SINGLE_PROVIDER',
        validFrom: input.validFrom ? new Date(input.validFrom) : null,
        validTo: input.validTo ? new Date(input.validTo) : null,
        maxUsage: input.maxUsage,
        status: input.status ?? 'ACTIVE',
        comboServices: { create: validated.items },
      },
      include: includeCombo,
    });
    return this.present(combo);
  }

  async update(id: string, input: CreateComboDto, user: AuthUser) {
    const existing = await this.prisma.combo.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Combo không tồn tại');
    await assertBranchAccess(this.prisma, user, existing.branchId);
    if (input.branchId !== existing.branchId) throw new BadRequestException('Không thể chuyển combo sang chi nhánh khác');
    const validated = await this.validate(input);
    if (validated.businessId !== existing.businessId) {
      throw new BadRequestException('Không thể chuyển combo sang doanh nghiệp khác');
    }
    const combo = await this.prisma.$transaction(async (tx) => {
      await tx.comboService.deleteMany({ where: { comboId: id } });
      return tx.combo.update({
        where: { id },
        data: {
          name: input.name.trim(), description: input.description?.trim() || null,
          comboPrice: input.comboPrice, validFrom: input.validFrom ? new Date(input.validFrom) : null,
          validTo: input.validTo ? new Date(input.validTo) : null, maxUsage: input.maxUsage ?? null,
          pricingMode: input.pricingMode ?? 'FIXED_PRICE',
          staffAssignmentMode: input.staffAssignmentMode ?? existing.staffAssignmentMode,
          status: input.status ?? existing.status,
          version: { increment: 1 },
          comboServices: { create: validated.items },
        },
        include: includeCombo,
      });
    });
    return this.present(combo);
  }

  async remove(id: string, user: AuthUser) {
    const combo = await this.prisma.combo.findFirst({ where: { id, deletedAt: null } });
    if (!combo) throw new NotFoundException('Combo không tồn tại');
    await assertBranchAccess(this.prisma, user, combo.branchId);
    await this.prisma.combo.update({ where: { id }, data: { deletedAt: new Date(), status: 'INACTIVE' } });
    return { ok: true };
  }

  async resolveForBooking(comboId: string, branchId: string) {
    const now = new Date();
    const combo = await this.prisma.combo.findFirst({
      where: { id: comboId, branchId, status: 'ACTIVE', deletedAt: null },
      include: {
        comboServices: {
          orderBy: { sortOrder: 'asc' },
          include: { service: true },
        },
      },
    });
    if (!combo || (combo.validFrom && combo.validFrom > now) || (combo.validTo && combo.validTo < now)) {
      throw new BadRequestException('Combo không tồn tại hoặc chưa trong thời gian áp dụng');
    }
    if (combo.maxUsage !== null && combo.usedCount >= combo.maxUsage) throw new BadRequestException('Combo đã hết lượt sử dụng');
    if (combo.comboServices.length < 2 || combo.comboServices.some((item) =>
      item.service.branchId !== branchId ||
      item.service.status !== 'ACTIVE' ||
      item.service.deletedAt !== null
    )) {
      throw new BadRequestException('Combo cần được cập nhật trước khi nhận booking mới');
    }
    return combo;
  }

  private async validate(input: CreateComboDto) {
    if (input.validFrom && input.validTo && new Date(input.validFrom) >= new Date(input.validTo)) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }
    const unique = new Map(input.services.map((item) => [item.serviceId, item]));
    if (unique.size !== input.services.length) throw new BadRequestException('Một dịch vụ không được lặp lại trong combo');
    if (unique.size < 2) throw new BadRequestException('Combo phải có ít nhất hai dịch vụ');
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: input.branchId,
        deletedAt: null,
        business: {
          status: { in: ['APPROVED', 'ACTIVE'] },
          deletedAt: null,
        },
      },
      select: {
        businessId: true,
        reviewStatus: true,
        operationalStatus: true,
      },
    });
    if (!branch) {
      throw new BadRequestException('Chi nhánh không tồn tại hoặc doanh nghiệp chưa được duyệt');
    }
    if ((input.status ?? 'ACTIVE') === 'ACTIVE' && branch.reviewStatus !== 'APPROVED') {
      throw new BadRequestException('Combo chỉ được kích hoạt sau khi chi nhánh được duyệt; hãy lưu ở trạng thái chưa kích hoạt');
    }
    const records = await this.prisma.branchServiceOffering.findMany({
      where: { id: { in: [...unique.keys()] }, branchId: input.branchId, status: 'ACTIVE', deletedAt: null },
      select: {
        id: true,
        name: true,
        price: true,
        durationMinutes: true,
        staffServices: {
          where: {
            staff: {
              status: 'ACTIVE',
              deletedAt: null,
              isBookable: true,
              OR: [
                { workingHours: { some: { isOff: false } } },
                { scheduleVersions: { some: { status: 'PUBLISHED' } } },
              ],
            },
          },
          select: { staffId: true },
        },
      },
    });
    if (records.length !== unique.size) throw new BadRequestException('Combo có dịch vụ không hợp lệ hoặc khác chi nhánh');
    if ((input.status ?? 'ACTIVE') === 'ACTIVE') {
      const unavailable = records.find((service) => service.staffServices.length === 0);
      if (unavailable) {
        throw new BadRequestException(
          `Combo chưa thể kích hoạt vì dịch vụ ${unavailable.name} chưa có nhân viên phù hợp tại chi nhánh này.`,
        );
      }
    }
    const byId = new Map(records.map((record) => [record.id, record]));
    const orders = input.services.map((item, index) => item.sortOrder ?? index);
    if (new Set(orders).size !== orders.length) throw new BadRequestException('Thứ tự dịch vụ trong combo không được trùng');
    const items = input.services
      .map((item, index) => {
        const service = byId.get(item.serviceId)!;
        return {
          serviceId: item.serviceId,
          quantity: item.quantity,
          sortOrder: item.sortOrder ?? index,
          transitionMinutes: item.transitionMinutes ?? 0,
          priceSnapshot: service.price,
          durationSnapshot: service.durationMinutes,
        };
      })
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((item, index) => ({ ...item, sortOrder: index }));
    return { businessId: branch.businessId, items };
  }

  private present(row: any) {
    const originalPrice = row.comboServices.reduce(
      (sum: number, item: any) => sum + Number(item.priceSnapshot ?? item.service.price) * item.quantity,
      0,
    );
    const durationMinutes = row.comboServices.reduce(
      (sum: number, item: any) =>
        sum + Number(item.durationSnapshot ?? item.service.durationMinutes) * item.quantity + Number(item.transitionMinutes || 0),
      0,
    );
    const savingAmount = Math.max(0, originalPrice - Number(row.comboPrice));
    return {
      ...row,
      originalPrice,
      durationMinutes,
      savingAmount,
      discountPercentage: originalPrice > 0 ? Math.round((savingAmount / originalPrice) * 10000) / 100 : 0,
    };
  }
}
