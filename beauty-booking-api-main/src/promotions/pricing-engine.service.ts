import { BadRequestException, Injectable } from '@nestjs/common';
import { DiscountType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { applyVoucher, VoucherApplication } from '../common/utils/voucher';

export interface PricingPromotionResult {
  id: string;
  name: string;
  version: number;
  amount: number;
  stackingAllowed: boolean;
  snapshot: Record<string, unknown>;
}

export interface BookingPricingQuote {
  subtotal: number;
  discountAmount: number;
  finalAmount: number;
  promotion: PricingPromotionResult | null;
  voucher: VoucherApplication | null;
  explanations: string[];
}

@Injectable()
export class PricingEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async quote(input: {
    customerId: string;
    branchId: string;
    serviceIds: string[];
    lineItems?: Array<{ serviceId: string; amount: number }>;
    comboId?: string;
    subtotal: number;
    voucherCode?: string;
    at?: Date;
  }): Promise<BookingPricingQuote> {
    const at = input.at ?? new Date();
    const branch = await this.prisma.branch.findUnique({
      where: { id: input.branchId },
      select: { businessId: true },
    });
    if (!branch) throw new BadRequestException('Chi nhánh không tồn tại');

    const promotions = await this.prisma.promotion.findMany({
      where: {
        status: 'ACTIVE', deletedAt: null, autoApply: true,
        startDate: { lte: at }, endDate: { gte: at },
        OR: [
          { createdByPlatform: true },
          { businessId: branch.businessId },
          { businessLinks: { some: { businessId: branch.businessId } } },
        ],
      },
      include: { branchLinks: true, serviceLinks: true, comboLinks: true },
    });

    const customer = await this.prisma.customerProfile.findUnique({
      where: { id: input.customerId },
      select: {
        user: { select: { dateOfBirth: true } },
        bookings: {
          where: { branch: { businessId: branch.businessId }, status: 'COMPLETED', deletedAt: null },
          select: { id: true }, take: 1,
        },
      },
    });
    if (!customer) throw new BadRequestException('Khách hàng không tồn tại');
    const segments = await this.prisma.customerBusinessSegment.findMany({
      where: { businessId: branch.businessId, customerId: input.customerId },
      select: { segment: true },
    });
    const segmentSet = new Set(segments.map((item) => item.segment));
    const explanations: string[] = [];
    const eligible: PricingPromotionResult[] = [];

    for (const promotion of promotions) {
      if (promotion.branchLinks.length && !promotion.branchLinks.some((item) => item.branchId === input.branchId)) {
        explanations.push(`${promotion.name}: không áp dụng tại chi nhánh này`);
        continue;
      }
      if (promotion.serviceLinks.length && !input.serviceIds.some((id) => promotion.serviceLinks.some((item) => item.serviceId === id))) {
        explanations.push(`${promotion.name}: không áp dụng cho dịch vụ đã chọn`);
        continue;
      }
      if (promotion.comboLinks.length && (!input.comboId || !promotion.comboLinks.some((item) => item.comboId === input.comboId))) {
        explanations.push(`${promotion.name}: không áp dụng cho combo đã chọn`);
        continue;
      }
      if (!(await this.audienceEligible(promotion.audience, customer, segmentSet, at))) {
        explanations.push(`${promotion.name}: khách hàng không thuộc đối tượng áp dụng`);
        continue;
      }
      const [totalUsed, customerUsed] = await Promise.all([
        this.prisma.promotionRedemption.count({ where: { promotionId: promotion.id, status: { in: ['RESERVED', 'APPLIED'] } } }),
        this.prisma.promotionRedemption.count({ where: { promotionId: promotion.id, customerId: input.customerId, status: { in: ['RESERVED', 'APPLIED'] } } }),
      ]);
      if (promotion.totalQuantity !== null && totalUsed >= promotion.totalQuantity) {
        explanations.push(`${promotion.name}: đã hết lượt`);
        continue;
      }
      if (customerUsed >= promotion.maxUsagePerCustomer) {
        explanations.push(`${promotion.name}: đã đạt giới hạn mỗi khách`);
        continue;
      }
      const eligibleSubtotal = promotion.serviceLinks.length
        ? (input.lineItems ?? [])
            .filter((item) => promotion.serviceLinks.some((scope) => scope.serviceId === item.serviceId))
            .reduce((sum, item) => sum + Math.max(0, Number(item.amount)), 0)
        : input.subtotal;
      if (eligibleSubtotal <= 0) {
        explanations.push(`${promotion.name}: không xác định được giá trị dịch vụ thuộc phạm vi`);
        continue;
      }
      const amount = promotion.discountType === DiscountType.PERCENTAGE
        ? Math.min(eligibleSubtotal, Math.round(eligibleSubtotal * Number(promotion.discountValue) / 100))
        : Math.min(eligibleSubtotal, Number(promotion.discountValue));
      if (amount <= 0) continue;
      eligible.push({
        id: promotion.id,
        name: promotion.name,
        version: promotion.version,
        amount,
        stackingAllowed: promotion.stackingAllowed,
        snapshot: {
          promotionId: promotion.id, name: promotion.name, version: promotion.version,
          discountType: promotion.discountType, discountValue: Number(promotion.discountValue),
          audience: promotion.audience, startDate: promotion.startDate, endDate: promotion.endDate,
          branchId: input.branchId, serviceIds: input.serviceIds, comboId: input.comboId ?? null,
          eligibleSubtotal,
        },
      });
    }
    const promotion = eligible.sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id))[0] ?? null;
    let voucher: VoucherApplication | null = null;
    if (input.voucherCode) {
      voucher = await applyVoucher(this.prisma, {
        customerId: input.customerId,
        voucherCode: input.voucherCode,
        branchId: input.branchId,
        subtotal: promotion?.stackingAllowed ? input.subtotal - promotion.amount : input.subtotal,
        serviceIds: input.serviceIds,
        lineItems: input.lineItems,
        comboId: input.comboId,
      });
    }

    if (promotion && voucher && !promotion.stackingAllowed) {
      if (voucher.discountAmount >= promotion.amount) {
        explanations.push(`${promotion.name}: voucher có giá trị tốt hơn; không cộng dồn`);
        return {
          subtotal: input.subtotal,
          discountAmount: voucher.discountAmount,
          finalAmount: input.subtotal - voucher.discountAmount,
          promotion: null,
          voucher,
          explanations,
        };
      }
      explanations.push(`Voucher không được cộng dồn và có giá trị thấp hơn ${promotion.name}`);
      voucher = null;
    }
    const discountAmount = (promotion?.amount ?? 0) + (voucher?.discountAmount ?? 0);
    return {
      subtotal: input.subtotal,
      discountAmount,
      finalAmount: Math.max(0, input.subtotal - discountAmount),
      promotion,
      voucher,
      explanations,
    };
  }

  async reserve(
    tx: Prisma.TransactionClient,
    bookingId: string,
    input: { customerId: string; branchId: string; quote: BookingPricingQuote; applied?: boolean },
  ) {
    const createdAt = new Date();
    const redemptionStatus = input.applied ? 'APPLIED' : 'RESERVED';
    const adjustmentStatus = input.applied ? 'APPLIED' : 'RESERVED';
    if (input.quote.promotion) {
      const promotion = input.quote.promotion;
      await tx.$queryRaw`SELECT id FROM promotions WHERE id = ${promotion.id} FOR UPDATE`;
      const current = await tx.promotion.findUnique({ where: { id: promotion.id } });
      if (!current || current.status !== 'ACTIVE' || current.version !== promotion.version) {
        throw new BadRequestException('Khuyến mãi vừa thay đổi; vui lòng tính giá lại');
      }
      if (current.totalQuantity !== null) {
        const used = await tx.promotionRedemption.count({ where: { promotionId: promotion.id, status: { in: ['RESERVED', 'APPLIED'] } } });
        if (used >= current.totalQuantity) throw new BadRequestException('Khuyến mãi vừa hết lượt');
      }
      const customerUsed = await tx.promotionRedemption.count({
        where: { promotionId: promotion.id, customerId: input.customerId, status: { in: ['RESERVED', 'APPLIED'] } },
      });
      if (customerUsed >= current.maxUsagePerCustomer) {
        throw new BadRequestException('Bạn đã đạt giới hạn sử dụng khuyến mãi này');
      }
      await tx.promotionRedemption.create({ data: {
        promotionId: promotion.id, bookingId, customerId: input.customerId,
        branchId: input.branchId, amount: promotion.amount, ruleSnapshot: promotion.snapshot as Prisma.InputJsonValue,
        status: redemptionStatus,
        appliedAt: input.applied ? createdAt : null,
      } });
      await tx.priceAdjustment.create({ data: {
        bookingId, branchId: input.branchId, customerId: input.customerId,
        type: 'PROMOTION', sourceId: promotion.id, sourceVersion: promotion.version,
        label: promotion.name, amount: -promotion.amount,
        ruleSnapshot: promotion.snapshot as Prisma.InputJsonValue,
        status: adjustmentStatus,
        appliedAt: input.applied ? createdAt : null,
      } });
    }
    if (input.quote.voucher) {
      const voucher = input.quote.voucher;
      await tx.$queryRaw`SELECT id FROM vouchers WHERE id = ${voucher.voucherId} FOR UPDATE`;
      const current = await tx.voucher.findUnique({ where: { id: voucher.voucherId } });
      if (!current || current.status !== 'ACTIVE' || current.version !== voucher.version || current.usedQuantity >= current.totalQuantity) {
        throw new BadRequestException('Voucher vừa thay đổi hoặc hết lượt sử dụng; vui lòng tính giá lại');
      }
      const customerUsed = await tx.voucherRedemption.count({
        where: { voucherId: voucher.voucherId, customerId: input.customerId, status: { in: ['RESERVED', 'APPLIED'] } },
      });
      if (customerUsed >= current.maxUsagePerCustomer) {
        throw new BadRequestException('Bạn đã đạt giới hạn sử dụng voucher này');
      }
      const entitlement = await tx.customerVoucher.findUnique({
        where: { voucherId_customerId: { voucherId: voucher.voucherId, customerId: input.customerId } },
        select: { id: true },
      });
      if (!entitlement) throw new BadRequestException('Bạn chưa sở hữu voucher này');
      await tx.voucherRedemption.create({ data: {
        voucherId: voucher.voucherId, customerVoucherId: entitlement.id,
        customerId: input.customerId, bookingId,
        branchId: input.branchId, amount: voucher.discountAmount,
        ruleSnapshot: { ...voucher.snapshot, capturedAt: createdAt } as Prisma.InputJsonValue,
        status: redemptionStatus,
        appliedAt: input.applied ? createdAt : null,
      } });
      await tx.priceAdjustment.create({ data: {
        bookingId, branchId: input.branchId, customerId: input.customerId,
        type: 'VOUCHER', sourceId: voucher.voucherId, sourceVersion: voucher.version, label: `Voucher ${voucher.code}`,
        amount: -voucher.discountAmount,
        ruleSnapshot: { ...voucher.snapshot, capturedAt: createdAt } as Prisma.InputJsonValue,
        status: adjustmentStatus,
        appliedAt: input.applied ? createdAt : null,
      } });
      await tx.voucher.update({
        where: { id: voucher.voucherId },
        data: { usedQuantity: { increment: 1 } },
      });
    }
  }

  private async audienceEligible(
    audience: string,
    customer: { user: { dateOfBirth: Date | null }; bookings: { id: string }[] },
    segments: Set<string>,
    at: Date,
  ) {
    if (audience === 'ALL') return true;
    if (audience === 'NEW_CUSTOMER') return customer.bookings.length === 0;
    if (audience === 'RETURNING_CUSTOMER') return customer.bookings.length > 0;
    if (audience === 'VIP') return segments.has('VIP');
    if (audience === 'SELECTED') return segments.has('SELECTED');
    if (audience === 'BIRTHDAY') {
      const dob = customer.user.dateOfBirth;
      return Boolean(dob && dob.getUTCMonth() === at.getUTCMonth() && dob.getUTCDate() === at.getUTCDate());
    }
    return false;
  }
}
