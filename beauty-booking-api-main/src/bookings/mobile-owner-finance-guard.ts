import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

// Evaluate inside the serializable mutation; pending records also need review.
export async function assertMobileOwnerWithoutFinance(tx: Prisma.TransactionClient, bookingId: string) {
  const involved = await tx.booking.findFirst({
    where: { id: bookingId, OR: [
      { voucherId: { not: null } }, { recurringPlanId: { not: null } },
      { payments: { some: {} } }, { paymentTransactions: { some: {} } },
      { paymentIntents: { some: {} } }, { financialLedgerEntries: { some: {} } },
      { packageEntitlements: { some: {} } },
      { refs_VoucherRedemption_bookingId: { some: {} } },
      { refs_PromotionRedemption_bookingId: { some: {} } },
      { refs_PriceAdjustment_bookingId: { some: {} } },
      { refs_LoyaltyTransaction_bookingId: { some: {} } },
      { refs_Invoice_bookingId: { some: {} } },
    ] }, select: { id: true },
  });
  if (involved) throw new ConflictException({ code: 'MOBILE_FINANCE_REVIEW_REQUIRED',
    message: 'Lịch hẹn có thanh toán hoặc quyền lợi liên quan; vui lòng xử lý trên phiên bản quản trị' });
}
