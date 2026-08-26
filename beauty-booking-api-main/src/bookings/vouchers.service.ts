import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PricingEngineService } from '../promotions/pricing-engine.service';
import { LoyaltyService } from '../loyalty/loyalty.service';

@Injectable()
export class VouchersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingEngine: PricingEngineService,
    private readonly loyalty: LoyaltyService,
  ) {}

  /**
   * Preview giá khi áp voucher (không ghi DB) — cho frontend bước xác nhận.
   */
  async preview(params: {
    customerId: string;
    branchId: string;
    voucherCode: string;
    subtotal: number;
    serviceIds?: string[];
    lineItems?: Array<{ serviceId: string; amount: number }>;
    comboId?: string;
    loyaltyPoints?: number;
  }) {
    const result = await this.pricingEngine.quote({
      customerId: params.customerId,
      branchId: params.branchId,
      serviceIds: params.serviceIds ?? [],
      lineItems: params.lineItems,
      comboId: params.comboId,
      subtotal: params.subtotal,
      voucherCode: params.voucherCode || undefined,
    });
    const loyalty = await this.loyalty.previewRedemption(
      params.customerId,
      params.branchId,
      params.loyaltyPoints ?? 0,
      result.finalAmount,
    );
    return {
      subtotal: params.subtotal,
      discountAmount: result.discountAmount + loyalty.discount,
      voucherDiscount: result.voucher?.discountAmount ?? 0,
      promotionDiscount: result.promotion?.amount ?? 0,
      loyaltyDiscount: loyalty.discount,
      loyaltyPoints: loyalty.points,
      finalAmount: Math.max(0, result.finalAmount - loyalty.discount),
      voucherApplied: Boolean(result.voucher),
      code: result.voucher?.code ?? null,
      promotion: result.promotion,
      explanations: result.explanations,
    };
  }

  /**
   * Liệt kê voucher khách hàng đang sở hữu (ACtIVE, còn hạn).
   */
  async listForCustomer(customerId: string) {
    const now = new Date();
    const vouchers = await this.prisma.customerVoucher.findMany({
      where: {
        customerId,
        status: { in: ['ACTIVE', 'USED'] },
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
      include: { voucher: true },
    });
    const usage = await this.prisma.voucherRedemption.groupBy({
      by: ['voucherId'],
      where: { customerId, status: { in: ['RESERVED', 'APPLIED'] } },
      _count: { _all: true },
    });
    const usedByVoucher = new Map(usage.map((row) => [row.voucherId, row._count._all]));
    return vouchers
      .filter((cv) => (usedByVoucher.get(cv.voucherId) ?? 0) < cv.voucher.maxUsagePerCustomer)
      .map((cv) => ({
      customerVoucherId: cv.id,
      code: cv.voucher.code,
      name: cv.voucher.name,
      description: cv.voucher.description,
      discountType: cv.voucher.discountType,
      discountValue: cv.voucher.discountValue,
      minOrderValue: cv.voucher.minOrderValue,
      maxDiscount: cv.voucher.maxDiscount,
      endDate: cv.voucher.endDate,
      usedCount: usedByVoucher.get(cv.voucherId) ?? 0,
      remainingUses: Math.max(0, cv.voucher.maxUsagePerCustomer - (usedByVoucher.get(cv.voucherId) ?? 0)),
    }));
  }

  /**
   * Khách nhận voucher (issue voucher cho customer).
   */
  async grantToCustomer(voucherId: string, customerId: string) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id: voucherId },
    });
    if (!voucher) throw new NotFoundException('Voucher không tồn tại');
    if (voucher.status !== 'ACTIVE') {
      throw new BadRequestException('Voucher không khả dụng');
    }
    if (voucher.usedQuantity >= voucher.totalQuantity) {
      throw new BadRequestException('Voucher đã hết lượt');
    }

    const customerVoucher = await this.prisma.customerVoucher.upsert({
      where: { voucherId_customerId: { voucherId, customerId } },
      create: {
        voucherId,
        customerId,
        status: 'ACTIVE',
        expiresAt: voucher.endDate,
      },
      update: {},
    });
    return customerVoucher;
  }
}
