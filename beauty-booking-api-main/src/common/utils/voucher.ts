import { BadRequestException } from '@nestjs/common';
import { DiscountType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface VoucherApplication {
  voucherId: string;
  code: string;
  discountAmount: number;
  finalAmount: number;
  usedVoucher: boolean;
}

/**
 * Áp dụng voucher cho booking. Trả về breakdown giá + finalAmount.
 *
 * Quy tắc:
 *  - minOrderValue phải đạt ngưỡng
 *  - PERCENTAGE: discount = price * value/100, cap bởi maxDiscount nếu có
 *  - FIXED_AMOUNT: discount = value (không cap)
 *  - Voucher đã hết lượt hoặc ngoài thời gian → reject
 *  - Customer phải có CustomerVoucher row (đã sở hữu)
 */
export async function applyVoucher(
  prisma: PrismaService,
  params: {
    customerId: string;
    voucherCode: string;
    branchId: string;
    subtotal: number;
  },
): Promise<VoucherApplication> {
  const { customerId, voucherCode, branchId, subtotal } = params;

  const voucher = await prisma.voucher.findFirst({
    where: {
      code: voucherCode,
      status: 'ACTIVE',
      deletedAt: null,
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
    },
  });
  if (!voucher) {
    throw new BadRequestException('Voucher không hợp lệ hoặc đã hết hạn');
  }
  if (voucher.businessId) {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { businessId: true },
    });
    if (!branch || branch.businessId !== voucher.businessId) {
      throw new BadRequestException('Voucher không áp dụng cho chi nhánh này');
    }
  }
  if (voucher.usedQuantity >= voucher.totalQuantity) {
    throw new BadRequestException('Voucher đã hết lượt sử dụng');
  }
  if (Number(subtotal) < Number(voucher.minOrderValue)) {
    throw new BadRequestException(
      `Đơn tối thiểu ${voucher.minOrderValue}đ mới được áp voucher`,
    );
  }

  // Kiểm tra customer đã sở hữu voucher (CustomerVoucher)
  const customerVoucher = await prisma.customerVoucher.findUnique({
    where: { voucherId_customerId: { voucherId: voucher.id, customerId } },
  });
  if (!customerVoucher || customerVoucher.status !== 'ACTIVE') {
    throw new BadRequestException('Bạn chưa sở hữu voucher này');
  }

  let discount = 0;
  if (voucher.discountType === DiscountType.PERCENTAGE) {
    discount = Math.round(
      Number(subtotal) * (Number(voucher.discountValue) / 100),
    );
    if (
      voucher.maxDiscount !== null &&
      voucher.maxDiscount !== undefined &&
      discount > Number(voucher.maxDiscount)
    ) {
      discount = Number(voucher.maxDiscount);
    }
  } else {
    discount = Math.min(
      Number(voucher.discountValue),
      Number(subtotal),
    );
  }

  const finalAmount = Math.max(0, Number(subtotal) - discount);

  // Voucher áp cho branch nào — mở rộng nếu cần check promotionBranches
  // (đơn giản hoá: voucher toàn hệ thống, không ràng buộc branch)

  return {
    voucherId: voucher.id,
    code: voucher.code,
    discountAmount: discount,
    finalAmount,
    usedVoucher: true,
  };
}
