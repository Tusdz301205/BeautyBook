import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { applyVoucher } from '../common/utils/voucher';

@Injectable()
export class VouchersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Preview giá khi áp voucher (không ghi DB) — cho frontend bước xác nhận.
   */
  async preview(params: {
    customerId: string;
    branchId: string;
    voucherCode: string;
    subtotal: number;
  }) {
    const result = await applyVoucher(this.prisma, params);
    return {
      subtotal: params.subtotal,
      voucherDiscount: result.discountAmount,
      finalAmount: result.finalAmount,
      voucherApplied: result.usedVoucher,
      code: result.code,
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
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
      include: { voucher: true },
    });
    return vouchers.map((cv) => ({
      customerVoucherId: cv.id,
      code: cv.voucher.code,
      name: cv.voucher.name,
      description: cv.voucher.description,
      discountType: cv.voucher.discountType,
      discountValue: cv.voucher.discountValue,
      minOrderValue: cv.voucher.minOrderValue,
      maxDiscount: cv.voucher.maxDiscount,
      endDate: cv.voucher.endDate,
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
