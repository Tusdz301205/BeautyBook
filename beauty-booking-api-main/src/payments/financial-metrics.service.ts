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
      where: {
        ...where,
        status: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
      },
      select: {
        amount: true,
        refundRequests: {
          where: { status: 'REFUNDED' },
          select: { amount: true },
        },
      },
    });
    return calculateFinancialTotals(payments);
  }

  async monthly(
    year: number,
    branchFilter: Record<string, unknown>,
  ): Promise<Array<FinancialTotals & { month: number }>> {
    const payments = await this.prisma.payment.findMany({
      where: {
        status: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
        booking: { branch: branchFilter },
        paidAt: {
          gte: new Date(`${year}-01-01T00:00:00.000Z`),
          lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
        },
      },
      select: {
        amount: true,
        paidAt: true,
        refundRequests: {
          where: { status: 'REFUNDED' },
          select: { amount: true },
        },
      },
    });
    return Array.from({ length: 12 }, (_, index) => {
      const monthlyPayments = payments.filter((payment) => payment.paidAt?.getUTCMonth() === index);
      return { month: index + 1, ...calculateFinancialTotals(monthlyPayments) };
    });
  }
}
