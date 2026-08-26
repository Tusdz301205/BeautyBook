import { BadRequestException } from '@nestjs/common';
import { DiscountType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface VoucherApplication {
  voucherId: string;
  code: string;
  discountAmount: number;
  finalAmount: number;
  usedVoucher: boolean;
  version: number;
  snapshot: Record<string, unknown>;
}

/** Evaluate a customer-owned voucher. Reservation is performed atomically
 * with booking creation by PricingEngineService. */
export async function applyVoucher(
  prisma: PrismaService,
  params: {
    customerId: string;
    voucherCode: string;
    branchId: string;
    subtotal: number;
    serviceIds?: string[];
    lineItems?: Array<{ serviceId: string; amount: number }>;
    comboId?: string;
  },
): Promise<VoucherApplication> {
  const { customerId, voucherCode, branchId, subtotal } = params;
  const now = new Date();
  const voucher = await prisma.voucher.findFirst({
    where: {
      code: voucherCode,
      status: 'ACTIVE',
      deletedAt: null,
      startDate: { lte: now },
      endDate: { gte: now },
    },
  });
  if (!voucher) throw new BadRequestException('Voucher không hợp lệ hoặc đã hết hạn');

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { businessId: true },
  });
  if (!branch) throw new BadRequestException('Chi nhánh không tồn tại');
  if (voucher.businessId && branch.businessId !== voucher.businessId) {
    throw new BadRequestException('Voucher không áp dụng cho chi nhánh này');
  }

  const [branchScopes, serviceScopes, comboScopes] = await Promise.all([
    prisma.voucherBranchScope.findMany({ where: { voucherId: voucher.id }, select: { branchId: true } }),
    prisma.voucherServiceScope.findMany({ where: { voucherId: voucher.id }, select: { serviceId: true } }),
    prisma.voucherComboScope.findMany({ where: { voucherId: voucher.id }, select: { comboId: true } }),
  ]);
  if (branchScopes.length && !branchScopes.some((scope) => scope.branchId === branchId)) {
    throw new BadRequestException('Voucher không áp dụng cho chi nhánh này');
  }
  if (serviceScopes.length && !(params.serviceIds ?? []).some((id) => serviceScopes.some((scope) => scope.serviceId === id))) {
    throw new BadRequestException('Voucher không áp dụng cho dịch vụ đã chọn');
  }
  if (comboScopes.length && (!params.comboId || !comboScopes.some((scope) => scope.comboId === params.comboId))) {
    throw new BadRequestException('Voucher không áp dụng cho combo đã chọn');
  }
  if (voucher.usedQuantity >= voucher.totalQuantity) {
    throw new BadRequestException('Voucher đã hết lượt sử dụng');
  }
  if (subtotal < Number(voucher.minOrderValue)) {
    throw new BadRequestException(`Đơn tối thiểu ${Number(voucher.minOrderValue).toLocaleString('vi-VN')}đ mới được áp voucher`);
  }

  const customerVoucher = await prisma.customerVoucher.findUnique({
    where: { voucherId_customerId: { voucherId: voucher.id, customerId } },
  });
  if (!customerVoucher || !['ACTIVE', 'USED'].includes(customerVoucher.status)) {
    throw new BadRequestException('Bạn chưa sở hữu voucher này');
  }
  if (customerVoucher.expiresAt && customerVoucher.expiresAt <= now) {
    throw new BadRequestException('Voucher của bạn đã hết hạn');
  }
  const customerUsage = await prisma.voucherRedemption.count({
    where: { voucherId: voucher.id, customerId, status: { in: ['RESERVED', 'APPLIED'] } },
  });
  if (customerUsage >= voucher.maxUsagePerCustomer) {
    throw new BadRequestException('Bạn đã đạt giới hạn sử dụng voucher này');
  }

  const customer = await prisma.customerProfile.findUnique({
    where: { id: customerId },
    select: {
      user: { select: { dateOfBirth: true } },
      bookings: {
        where: { branch: { businessId: branch.businessId }, status: 'COMPLETED', deletedAt: null },
        select: { id: true }, take: 1,
      },
    },
  });
  const returning = Boolean(customer?.bookings.length);
  if (voucher.audience === 'NEW_CUSTOMER' && returning) throw new BadRequestException('Voucher chỉ dành cho khách hàng mới');
  if (voucher.audience === 'RETURNING_CUSTOMER' && !returning) throw new BadRequestException('Voucher chỉ dành cho khách hàng quay lại');
  if (voucher.audience === 'BIRTHDAY') {
    const dob = customer?.user.dateOfBirth;
    if (!dob || dob.getUTCMonth() !== now.getUTCMonth() || dob.getUTCDate() !== now.getUTCDate()) {
      throw new BadRequestException('Voucher chỉ sử dụng trong ngày sinh nhật');
    }
  }
  if (voucher.audience === 'VIP') {
    const vip = await prisma.customerBusinessSegment.findFirst({
      where: { businessId: branch.businessId, customerId, segment: 'VIP' },
      select: { id: true },
    });
    if (!vip) throw new BadRequestException('Voucher chỉ dành cho khách VIP');
  }
  if (voucher.audience === 'SELECTED') {
    const selected = await prisma.customerBusinessSegment.findFirst({
      where: { businessId: branch.businessId, customerId, segment: 'SELECTED' },
      select: { id: true },
    });
    if (!selected) throw new BadRequestException('Voucher chỉ dành cho khách được chọn');
  }

  const eligibleSubtotal = serviceScopes.length
    ? (params.lineItems ?? [])
        .filter((item) => serviceScopes.some((scope) => scope.serviceId === item.serviceId))
        .reduce((sum, item) => sum + Math.max(0, Number(item.amount)), 0)
    : subtotal;
  if (eligibleSubtotal <= 0) {
    throw new BadRequestException('Không xác định được giá trị dịch vụ thuộc phạm vi voucher');
  }
  let discount = 0;
  if (voucher.discountType === DiscountType.PERCENTAGE) {
    discount = Math.round(eligibleSubtotal * Number(voucher.discountValue) / 100);
    if (voucher.maxDiscount !== null && discount > Number(voucher.maxDiscount)) {
      discount = Number(voucher.maxDiscount);
    }
  } else {
    discount = Math.min(Number(voucher.discountValue), eligibleSubtotal);
  }
  const finalAmount = Math.max(0, subtotal - discount);
  return {
    voucherId: voucher.id,
    code: voucher.code,
    discountAmount: discount,
    finalAmount,
    usedVoucher: true,
    version: voucher.version,
    snapshot: {
      voucherId: voucher.id,
      code: voucher.code,
      version: voucher.version,
      discountType: voucher.discountType,
      discountValue: Number(voucher.discountValue),
      maxDiscount: voucher.maxDiscount === null ? null : Number(voucher.maxDiscount),
      minOrderValue: Number(voucher.minOrderValue),
      audience: voucher.audience,
      eligibleSubtotal,
      branchId,
      serviceIds: params.serviceIds ?? [],
      comboId: params.comboId ?? null,
    },
  };
}
