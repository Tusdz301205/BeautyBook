import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface FinancialTotals {
  grossRevenue: number;
  refundAmount: number;
  netRevenue: number;
  paymentCount: number;
}

export function calculateFinancialTotals(
  payments: Array<{ amount: unknown; refundRequests: Array<{ amount: unknown }> }>,
): FinancialTotals {
  const grossRevenue = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const refundAmount = payments.reduce(
    (sum, payment) =>
      sum + payment.refundRequests.reduce((refundSum, refund) => refundSum + Number(refund.amount), 0),
    0,
  );
  return {
    grossRevenue,
    refundAmount,
    netRevenue: grossRevenue - refundAmount,
    paymentCount: payments.length,
  };
}

@Injectable()
export class FinancialMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async totals(where: Prisma.PaymentWhereInput = {}): Promise<FinancialTotals> {
    const payments = await this.prisma.payment.findMany({
      where,
      select: {
        amount: true,
        status: true,
        transactions: { select: { amount: true, status: true } },
        refundRequests: {
          where: { status: 'REFUNDED' },
          select: { amount: true },
        },
      },
    });
    const verified = payments.flatMap((payment) => payment.transactions)
      .filter((transaction) => transaction.status === 'VERIFIED')
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
    const reversals = payments.flatMap((payment) => payment.transactions)
      .filter((transaction) => transaction.status === 'REVERSED')
      .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount)), 0);
    const legacy = payments
      .filter((payment) => payment.transactions.length === 0 && ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status))
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
    const refunds = payments.flatMap((payment) => payment.refundRequests)
      .reduce((sum, refund) => sum + Number(refund.amount), 0);
    return {
      grossRevenue: verified + legacy,
      refundAmount: reversals + refunds,
      netRevenue: verified + legacy - reversals - refunds,
      paymentCount: payments.filter((payment) => payment.transactions.some((transaction) => transaction.status === 'VERIFIED') || (payment.transactions.length === 0 && ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status))).length,
    };
  }

  async monthly(
    year: number,
    branchFilter: Record<string, unknown>,
  ): Promise<Array<FinancialTotals & { month: number }>> {
    const branches = await this.prisma.branch.findMany({
      where: { deletedAt: null, ...branchFilter },
      select: { id: true, timezone: true },
    });
    const branchIds = branches.map((branch) => branch.id);
    const timezoneByBranch = new Map(
      branches.map((branch) => [branch.id, branch.timezone || 'Asia/Ho_Chi_Minh']),
    );
    // Include one UTC day on both sides because a branch-local year does not
    // necessarily start at 00:00 UTC.
    const from = new Date(`${year}-01-01T00:00:00.000Z`);
    from.setUTCDate(from.getUTCDate() - 1);
    const to = new Date(`${year + 1}-01-01T00:00:00.000Z`);
    to.setUTCDate(to.getUTCDate() + 1);
    const localYearMonth = (instant: Date | null, branchId: string) => {
      if (!instant) return null;
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezoneByBranch.get(branchId) ?? 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
      }).formatToParts(instant);
      const value = (type: string) => parts.find((part) => part.type === type)?.value;
      return { year: Number(value('year')), month: Number(value('month')) };
    };
    const [transactions, legacyPayments, refunds] = await Promise.all([
      this.prisma.paymentTransaction.findMany({
        where: { branchId: { in: branchIds }, status: { in: ['VERIFIED', 'REVERSED'] }, verifiedAt: { gte: from, lt: to } },
        select: { id: true, branchId: true, amount: true, status: true, verifiedAt: true },
      }),
      this.prisma.payment.findMany({
        where: { booking: { branchId: { in: branchIds } }, status: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] }, paidAt: { gte: from, lt: to }, transactions: { none: {} } },
        select: { id: true, amount: true, paidAt: true, booking: { select: { branchId: true } } },
      }),
      this.prisma.refundRequest.findMany({
        where: { status: 'REFUNDED', processedAt: { gte: from, lt: to }, payment: { booking: { branchId: { in: branchIds } } } },
        select: { id: true, amount: true, processedAt: true, payment: { select: { booking: { select: { branchId: true } } } } },
      }),
    ]);
    return Array.from({ length: 12 }, (_, index) => {
      const inMonth = (instant: Date | null, branchId: string) => {
        const local = localYearMonth(instant, branchId);
        return local?.year === year && local.month === index + 1;
      };
      const verified = transactions.filter((row) => row.status === 'VERIFIED' && inMonth(row.verifiedAt, row.branchId));
      const reversed = transactions.filter((row) => row.status === 'REVERSED' && inMonth(row.verifiedAt, row.branchId));
      const legacy = legacyPayments.filter((row) => inMonth(row.paidAt, row.booking.branchId));
      const refunded = refunds.filter((row) => inMonth(row.processedAt, row.payment.booking.branchId));
      const grossRevenue = verified.reduce((sum, row) => sum + Number(row.amount), 0) + legacy.reduce((sum, row) => sum + Number(row.amount), 0);
      const refundAmount = reversed.reduce((sum, row) => sum + Math.abs(Number(row.amount)), 0) + refunded.reduce((sum, row) => sum + Number(row.amount), 0);
      return { month: index + 1, grossRevenue, refundAmount, netRevenue: grossRevenue - refundAmount, paymentCount: verified.length + legacy.length };
    });
  }
}
