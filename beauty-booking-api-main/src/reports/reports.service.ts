import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FinancialMetricsService } from '../payments/financial-metrics.service';

export interface ReportScope {
  businessIds?: string[];
  branchIds?: string[];
}

export interface OwnerDashboardQuery {
  scope: ReportScope;
  branchId?: string;
  from: Date;
  to: Date;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialMetrics: FinancialMetricsService,
  ) {}

  /**
   * Doanh thu theo tháng (tương ứng revenueData trong mockData)
   */
  async getRevenue(year?: number, scope: ReportScope = {}) {
    const targetYear = year || new Date().getFullYear();
    const monthNames = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];

    const monthlyRevenue = await this.financialMetrics.monthly(
      targetYear,
      this.branchFilter(scope),
    );

    return monthlyRevenue.map((totals, i) => ({
      month: monthNames[i],
      grossRevenue: totals.grossRevenue,
      refundAmount: totals.refundAmount,
      netRevenue: totals.netRevenue,
      revenue: Number((totals.netRevenue / 1000000).toFixed(1)),
    }));
  }

  /**
   * Phân bổ lịch hẹn theo nhóm dịch vụ (tương ứng categoryBookingData)
   */
  async getCategoryStats(scope: ReportScope = {}) {
    const categories = await this.prisma.serviceCategory.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        services: {
          where: this.serviceFilter(scope),
          select: {
            bookingServices: {
              select: { id: true, booking: { select: { status: true } } },
            },
          },
        },
      },
    });

    return categories
      .map((cat) => {
        const rows = cat.services.flatMap((service) => service.bookingServices);
        const bookedCount = rows.length;
        const completedCount = rows.filter((row) => row.booking.status === 'COMPLETED').length;
        const cancelledCount = rows.filter((row) => ['CANCELLED', 'REJECTED', 'EXPIRED'].includes(row.booking.status)).length;
        const noShowCount = rows.filter((row) => row.booking.status === 'NO_SHOW').length;
        return { name: cat.name, value: bookedCount, bookedCount, completedCount, cancelledCount, noShowCount };
      })
      .sort((a, b) => b.value - a.value);
  }

  /**
   * Phân bổ dịch vụ phổ biến (tương ứng serviceBookingData)
   */
  async getServiceStats(scope: ReportScope = {}) {
    const services = await this.prisma.branchServiceOffering.findMany({
      where: { deletedAt: null, ...this.serviceFilter(scope) },
      select: {
        name: true,
        bookingServices: {
          select: { id: true, booking: { select: { status: true } } },
        },
      },
    });

    return services
      .map((svc) => {
        const bookedCount = svc.bookingServices.length;
        return {
          name: svc.name,
          value: bookedCount,
          bookedCount,
          completedCount: svc.bookingServices.filter((row) => row.booking.status === 'COMPLETED').length,
          cancelledCount: svc.bookingServices.filter((row) => ['CANCELLED', 'REJECTED', 'EXPIRED'].includes(row.booking.status)).length,
          noShowCount: svc.bookingServices.filter((row) => row.booking.status === 'NO_SHOW').length,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5
  }

  /**
   * Top cơ sở theo lượt đặt lịch (tương ứng topSalonsData)
   */
  async getTopBranches(limit = 5, scope: ReportScope = {}) {
    const branches = await this.prisma.branch.findMany({
      where: { deletedAt: null, ...this.branchFilter(scope) },
      select: {
        id: true,
        name: true,
        business: { select: { name: true } },
        bookings: {
          where: { deletedAt: null },
          select: { id: true },
        },
      },
    });

    return branches
      .map((b) => ({
        id: b.id,
        name: b.business?.name || b.name,
        bookings: b.bookings.length,
      }))
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, limit);
  }

  /**
   * Tăng trưởng người dùng theo tháng (tương ứng userGrowthData)
   */
  async getUserGrowth(year?: number) {
    const targetYear = year || new Date().getFullYear();
    const monthNames = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];

    const users = await this.prisma.user.findMany({
      where: {
        createdAt: {
          gte: new Date(`${targetYear}-01-01`),
          lt: new Date(`${targetYear + 1}-01-01`),
        },
      },
      select: { createdAt: true },
    });

    // Cumulative count by month
    const monthlyCounts = new Array(12).fill(0);
    for (const u of users) {
      const month = u.createdAt.getMonth();
      monthlyCounts[month]++;
    }

    // Make cumulative
    let cumulative = 0;
    // Count users before this year
    const existingUsers = await this.prisma.user.count({
      where: {
        createdAt: { lt: new Date(`${targetYear}-01-01`) },
      },
    });
    cumulative = existingUsers;

    return monthlyCounts.map((count, i) => {
      cumulative += count;
      return {
        month: monthNames[i],
        users: cumulative,
      };
    });
  }

  /**
   * Hiệu suất nhân viên (tương ứng stylistPerformance)
   */
  async getStaffPerformance(scope: ReportScope = {}) {
    const where: any = this.staffFilter(scope);

    const staff = await this.prisma.staffProfile.findMany({
      where: { ...where, deletedAt: null },
      include: {
        user: { select: { fullName: true } },
        bookingServices: {
          include: {
            booking: {
              select: {
                status: true, totalAmount: true, finalAmount: true,
                bookingServices: { select: { priceAtBooking: true } },
                paymentTransactions: { select: { status: true, amount: true } },
                payments: { select: { amount: true, status: true, transactions: { select: { id: true } }, refundRequests: { where: { status: 'REFUNDED' }, select: { amount: true } } } },
              },
            },
          },
        },
      },
    });

    return staff
      .map((s) => {
        const completedServices = s.bookingServices.filter(
          (bs) => bs.booking.status === 'COMPLETED',
        );
        return {
          name: s.user?.fullName || s.fullName,
          bookings: s.bookingServices.length,
          revenue: completedServices.reduce((sum, bs) => {
            const verified = bs.booking.paymentTransactions.filter((row) => row.status === 'VERIFIED').reduce((value, row) => value + Number(row.amount), 0);
            const reversed = bs.booking.paymentTransactions.filter((row) => row.status === 'REVERSED').reduce((value, row) => value + Number(row.amount), 0);
            const legacy = bs.booking.payments.filter((payment) => payment.transactions.length === 0 && ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status)).reduce((value, payment) => value + Number(payment.amount), 0);
            const refunded = bs.booking.payments.flatMap((payment) => payment.refundRequests).reduce((value, refund) => value + Number(refund.amount), 0);
            const itemSubtotal = bs.booking.bookingServices.reduce((value, item) => value + Number(item.priceAtBooking), 0) || 1;
            return sum + Math.max(0, verified - reversed + legacy - refunded) * Number(bs.priceAtBooking) / itemSubtotal;
          }, 0),
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }

  /**
   * Dashboard tổng quan (overview stats)
   */
  async getDashboardOverview(scope: ReportScope = {}) {
    const branchFilter = this.branchFilter(scope);
    const bookingFilter = { branch: branchFilter };
    const isScoped = !!(scope.businessIds || scope.branchIds);
    const [
      totalUsers,
      totalBranches,
      totalBookings,
      totalRevenue,
      pendingBookings,
    ] = await Promise.all([
      isScoped
        ? this.prisma.customerProfile.count({
            where: { bookings: { some: bookingFilter } },
          })
        : this.prisma.user.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.branch.count({ where: { deletedAt: null, status: 'ACTIVE', ...branchFilter } }),
      this.prisma.booking.count({ where: { deletedAt: null, ...bookingFilter } }),
      this.financialMetrics.totals({ booking: bookingFilter }),
      this.prisma.booking.count({
        where: { status: 'PENDING', deletedAt: null, ...bookingFilter },
      }),
    ]);

    return {
      totalUsers,
      totalBranches,
      totalBookings,
      totalRevenue: totalRevenue.netRevenue,
      grossRevenue: totalRevenue.grossRevenue,
      refundAmount: totalRevenue.refundAmount,
      netRevenue: totalRevenue.netRevenue,
      pendingBookings,
    };
  }

  async getOwnerDashboard(query: OwnerDashboardQuery) {
    const from = new Date(`${query.from.toISOString().slice(0, 10)}T00:00:00.000Z`);
    const to = new Date(`${query.to.toISOString().slice(0, 10)}T23:59:59.999Z`);
    const rangeDays = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
    if (rangeDays < 1 || rangeDays > 366) {
      throw new BadRequestException('Khoảng ngày dashboard phải từ 1 đến 366 ngày');
    }
    const previousTo = new Date(from.getTime() - 1);
    const previousFrom = new Date(previousTo.getTime() - rangeDays * 86400000 + 1);
    const broadFrom = new Date(from);
    broadFrom.setUTCDate(broadFrom.getUTCDate() - 1);
    const broadTo = new Date(to);
    broadTo.setUTCDate(broadTo.getUTCDate() + 1);
    const previousBroadFrom = new Date(previousFrom);
    previousBroadFrom.setUTCDate(previousBroadFrom.getUTCDate() - 1);
    const previousBroadTo = new Date(previousTo);
    previousBroadTo.setUTCDate(previousBroadTo.getUTCDate() + 1);
    const scopedBranchFilter = {
      ...this.branchFilter(query.scope),
      ...(query.branchId ? { id: query.branchId } : {}),
    };
    const bookingWhere = {
      branch: scopedBranchFilter,
      deletedAt: null,
      appointmentDate: { gte: from, lte: to },
    };
    const previousBookingWhere = {
      branch: scopedBranchFilter,
      deletedAt: null,
      appointmentDate: { gte: previousFrom, lte: previousTo },
    };
    const [
      branches,
      rawBookings,
      rawPreviousBookings,
      rawPayments,
      rawPreviousPayments,
      rawTransactions,
      rawPreviousTransactions,
      rawRefunds,
      rawPreviousRefunds,
      rawReviews,
    ] = await Promise.all([
      this.prisma.branch.findMany({
        where: { deletedAt: null, ...scopedBranchFilter },
        select: {
          id: true,
          name: true,
          timezone: true,
          _count: {
            select: {
              staff: { where: { status: 'ACTIVE', deletedAt: null } },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.booking.findMany({
        where: { ...bookingWhere, appointmentDate: { gte: broadFrom, lte: broadTo } },
        select: {
          id: true,
          branchId: true,
          appointmentDate: true,
          status: true,
          voucherDiscountAmount: true,
          paymentTransactions: { select: { amount: true, status: true } },
          payments: {
            select: {
              amount: true,
              status: true,
              transactions: { select: { id: true } },
              refundRequests: { where: { status: 'REFUNDED' }, select: { amount: true } },
            },
          },
          bookingServices: {
            select: {
              priceAtBooking: true,
              comboId: true,
              service: { select: { id: true, name: true } },
              combo: { select: { id: true, name: true } },
            },
          },
        },
      }),
        this.prisma.booking.findMany({
          where: { ...previousBookingWhere, appointmentDate: { gte: previousBroadFrom, lte: previousBroadTo } },
          select: {
            id: true,
            branchId: true,
            status: true,
            appointmentDate: true,
            voucherDiscountAmount: true,
          },
      }),
      this.prisma.payment.findMany({
        where: {
          status: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
          paidAt: { gte: broadFrom, lte: broadTo },
          booking: { branch: scopedBranchFilter },
          transactions: { none: {} },
        },
        select: {
          id: true,
          amount: true,
          paidAt: true,
          bookingId: true,
          booking: { select: { branchId: true } },
          refundRequests: {
            where: { status: 'REFUNDED' },
            select: { amount: true },
          },
        },
      }),
      this.prisma.payment.findMany({
        where: {
          status: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
          paidAt: { gte: previousBroadFrom, lte: previousBroadTo },
          booking: { branch: scopedBranchFilter },
          transactions: { none: {} },
        },
          select: {
            amount: true,
            paidAt: true,
            booking: { select: { branchId: true } },
        },
      }),
      this.prisma.paymentTransaction.findMany({
        where: { branch: scopedBranchFilter, status: { in: ['VERIFIED', 'REVERSED'] }, OR: [{ verifiedAt: { gte: broadFrom, lte: broadTo } }, { verifiedAt: null, createdAt: { gte: broadFrom, lte: broadTo } }] },
        select: { id: true, bookingId: true, branchId: true, amount: true, status: true, verifiedAt: true, createdAt: true },
      }),
      this.prisma.paymentTransaction.findMany({
        where: { branch: scopedBranchFilter, status: { in: ['VERIFIED', 'REVERSED'] }, OR: [{ verifiedAt: { gte: previousBroadFrom, lte: previousBroadTo } }, { verifiedAt: null, createdAt: { gte: previousBroadFrom, lte: previousBroadTo } }] },
        select: { bookingId: true, branchId: true, amount: true, status: true, verifiedAt: true, createdAt: true },
      }),
      this.prisma.refundRequest.findMany({
        where: { status: 'REFUNDED', processedAt: { gte: broadFrom, lte: broadTo }, payment: { booking: { branch: scopedBranchFilter } } },
        select: { id: true, amount: true, processedAt: true, payment: { select: { bookingId: true, booking: { select: { branchId: true } } } } },
      }),
      this.prisma.refundRequest.findMany({
        where: { status: 'REFUNDED', processedAt: { gte: previousBroadFrom, lte: previousBroadTo }, payment: { booking: { branch: scopedBranchFilter } } },
        select: { id: true, amount: true, processedAt: true, payment: { select: { bookingId: true, booking: { select: { branchId: true } } } } },
      }),
      this.prisma.review.findMany({
        where: {
          deletedAt: null,
          createdAt: { gte: broadFrom, lte: broadTo },
          booking: { branch: scopedBranchFilter },
        },
        select: {
          id: true,
          overallRating: true,
          status: true,
          createdAt: true,
          booking: { select: { branchId: true } },
        },
      }),
    ]);
    const rawDiscountAdjustments = await this.prisma.priceAdjustment.findMany({
      where: {
        branchId: { in: branches.map((branch) => branch.id) },
        status: 'APPLIED',
        type: { in: ['PROMOTION', 'VOUCHER', 'LOYALTY', 'PACKAGE'] },
        bookingId: { not: null },
      },
      select: { bookingId: true, amount: true },
    });
    const fromKey = from.toISOString().slice(0, 10);
    const toKey = to.toISOString().slice(0, 10);
    const previousFromKey = previousFrom.toISOString().slice(0, 10);
    const previousToKey = previousTo.toISOString().slice(0, 10);
    const timezoneByBranch = new Map(
      branches.map((branch) => [branch.id, branch.timezone || 'Asia/Ho_Chi_Minh']),
    );
    const localDate = (instant: Date, branchId: string) => {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezoneByBranch.get(branchId) ?? 'Asia/Ho_Chi_Minh',
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(instant);
      const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
      return `${value('year')}-${value('month')}-${value('day')}`;
    };
    const inRange = (instant: Date | null, branchId: string, start: string, end: string) => {
      if (!instant) return false;
      const date = localDate(instant, branchId);
      return date >= start && date <= end;
    };
    const bookings = rawBookings.filter((row) => inRange(row.appointmentDate, row.branchId, fromKey, toKey));
    const previousBookings = rawPreviousBookings.filter((row) => inRange(row.appointmentDate, row.branchId, previousFromKey, previousToKey));
    const payments = rawPayments.filter((row) => inRange(row.paidAt, row.booking.branchId, fromKey, toKey));
    const previousPayments = rawPreviousPayments.filter((row) => inRange(row.paidAt, row.booking.branchId, previousFromKey, previousToKey));
    const transactions = rawTransactions.filter((row) => inRange(row.verifiedAt ?? row.createdAt, row.branchId, fromKey, toKey));
    const previousTransactions = rawPreviousTransactions.filter((row) => inRange(row.verifiedAt ?? row.createdAt, row.branchId, previousFromKey, previousToKey));
    const refunds = rawRefunds.filter((row) => inRange(row.processedAt, row.payment.booking.branchId, fromKey, toKey));
    const previousRefunds = rawPreviousRefunds.filter((row) => inRange(row.processedAt, row.payment.booking.branchId, previousFromKey, previousToKey));
    const reviews = rawReviews.filter((row) => inRange(row.createdAt, row.booking.branchId, fromKey, toKey));
    const discountByBooking = new Map<string, number>();
    for (const adjustment of rawDiscountAdjustments) {
      if (!adjustment.bookingId || Number(adjustment.amount) >= 0) continue;
      discountByBooking.set(adjustment.bookingId, (discountByBooking.get(adjustment.bookingId) ?? 0) + Math.abs(Number(adjustment.amount)));
    }
    const previousGross = previousPayments.reduce((sum, payment) => sum + Number(payment.amount), 0)
      + previousTransactions.filter((transaction) => transaction.status === 'VERIFIED').reduce((sum, transaction) => sum + Number(transaction.amount), 0);
    const previousRefund = previousRefunds.reduce((sum, row) => sum + Number(row.amount), 0);
    const previousReversal = previousTransactions.filter((transaction) => transaction.status === 'REVERSED').reduce((sum, transaction) => sum + Number(transaction.amount), 0);
    const previousNet = previousGross - previousRefund - previousReversal;
    const gross = payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
      + transactions.filter((transaction) => transaction.status === 'VERIFIED').reduce((sum, transaction) => sum + Number(transaction.amount), 0);
    const refund = refunds.reduce((sum, row) => sum + Number(row.amount), 0);
    const reversal = transactions.filter((transaction) => transaction.status === 'REVERSED').reduce((sum, transaction) => sum + Number(transaction.amount), 0);
    const net = gross - refund - reversal;
    const compare = (current: number, previous: number) => ({
      current,
      previous,
      changePercent: previous === 0
        ? current === 0 ? 0 : null
        : Math.round(((current - previous) / previous) * 1000) / 10,
    });
    const revenueByDay = new Map<string, { gross: number; refund: number }>();
    for (const payment of payments) {
      if (!payment.paidAt) continue;
      const key = localDate(payment.paidAt, payment.booking.branchId);
      const row = revenueByDay.get(key) ?? { gross: 0, refund: 0 };
      row.gross += Number(payment.amount);
      revenueByDay.set(key, row);
    }
    for (const transaction of transactions) {
      const instant = transaction.verifiedAt ?? transaction.createdAt;
      const key = localDate(instant, transaction.branchId);
      const row = revenueByDay.get(key) ?? { gross: 0, refund: 0 };
      if (transaction.status === 'VERIFIED') row.gross += Number(transaction.amount);
      else row.refund += Number(transaction.amount);
      revenueByDay.set(key, row);
    }
    for (const item of refunds) {
      if (!item.processedAt) continue;
      const key = localDate(item.processedAt, item.payment.booking.branchId);
      const row = revenueByDay.get(key) ?? { gross: 0, refund: 0 };
      row.refund += Number(item.amount);
      revenueByDay.set(key, row);
    }
    const discountByDay = new Map<string, number>();
    for (const booking of bookings) {
      const key = localDate(booking.appointmentDate, booking.branchId);
      discountByDay.set(key, (discountByDay.get(key) ?? 0) + (discountByBooking.get(booking.id) ?? 0));
    }
    const previousRevenueByDay = new Map<string, { gross: number; refund: number }>();
    for (const payment of previousPayments) {
      if (!payment.paidAt) continue;
      const key = localDate(payment.paidAt, payment.booking.branchId);
      const row = previousRevenueByDay.get(key) ?? { gross: 0, refund: 0 };
      row.gross += Number(payment.amount);
      previousRevenueByDay.set(key, row);
    }
    for (const transaction of previousTransactions) {
      const key = localDate(transaction.verifiedAt ?? transaction.createdAt, transaction.branchId);
      const row = previousRevenueByDay.get(key) ?? { gross: 0, refund: 0 };
      if (transaction.status === 'VERIFIED') row.gross += Number(transaction.amount);
      else row.refund += Number(transaction.amount);
      previousRevenueByDay.set(key, row);
    }
    for (const item of previousRefunds) {
      if (!item.processedAt) continue;
      const key = localDate(item.processedAt, item.payment.booking.branchId);
      const row = previousRevenueByDay.get(key) ?? { gross: 0, refund: 0 };
      row.refund += Number(item.amount);
      previousRevenueByDay.set(key, row);
    }
    const revenueSeries = Array.from({ length: rangeDays }, (_, index) => {
        const date = new Date(from.getTime() + index * 86400000).toISOString().slice(0, 10);
        const previousDate = new Date(previousFrom.getTime() + index * 86400000).toISOString().slice(0, 10);
        const row = revenueByDay.get(date) ?? { gross: 0, refund: 0 };
        const previousRow = previousRevenueByDay.get(previousDate) ?? { gross: 0, refund: 0 };
        return {
          date,
          previousDate,
          grossRevenue: row.gross,
          discountAmount: discountByDay.get(date) ?? 0,
          refundAmount: row.refund,
          netRevenue: row.gross - row.refund,
          previousNetRevenue: previousRow.gross - previousRow.refund,
        };
    });
    const bookingStatuses = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
    const bookingStatus = bookingStatuses.map((status) => ({
      status,
      count: bookings.filter((booking) => booking.status === status).length,
    }));
    const branchComparison = branches.map((branch) => {
      const branchBookings = bookings.filter((booking) => booking.branchId === branch.id);
      const branchPayments = payments.filter((payment) => payment.booking.branchId === branch.id);
      const branchTransactions = transactions.filter((transaction) => transaction.branchId === branch.id);
      const branchRefunds = refunds.filter((item) => item.payment.booking.branchId === branch.id);
      const branchGross = branchPayments.reduce((sum, payment) => sum + Number(payment.amount), 0)
        + branchTransactions.filter((transaction) => transaction.status === 'VERIFIED').reduce((sum, transaction) => sum + Number(transaction.amount), 0);
      const branchRefund = branchRefunds.reduce((sum, item) => sum + Number(item.amount), 0)
        + branchTransactions.filter((transaction) => transaction.status === 'REVERSED').reduce((sum, transaction) => sum + Number(transaction.amount), 0);
      return {
        branchId: branch.id,
        branchName: branch.name,
        netRevenue: branchGross - branchRefund,
        bookingCount: branchBookings.length,
        completedBookings: branchBookings.filter((booking) => booking.status === 'COMPLETED').length,
        activeStaff: branch._count.staff,
      };
    });
    const serviceMap = new Map<string, { id: string; name: string; bookings: number; revenue: number }>();
    const comboMap = new Map<string, { id: string; name: string; bookings: number; revenue: number }>();
    const netByBooking = new Map<string, number>();
    for (const booking of bookings) {
      const transactionNet = booking.paymentTransactions.reduce(
        (sum, row) => sum + (row.status === 'VERIFIED' ? Number(row.amount) : row.status === 'REVERSED' ? -Number(row.amount) : 0),
        0,
      );
      const legacyNet = booking.payments
        .filter((payment) => payment.transactions.length === 0 && ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status))
        .reduce((sum, payment) => sum + Number(payment.amount) - payment.refundRequests.reduce((refundSum, item) => refundSum + Number(item.amount), 0), 0);
      netByBooking.set(booking.id, transactionNet + legacyNet);
      const itemSubtotal = booking.bookingServices.reduce((sum, item) => sum + Number(item.priceAtBooking), 0) || 1;
      const recognizedForBooking = booking.status === 'COMPLETED' ? Math.max(0, netByBooking.get(booking.id) ?? 0) : 0;
      for (const item of booking.bookingServices) {
        const price = Number(item.priceAtBooking);
        const recognizedItemRevenue = recognizedForBooking * price / itemSubtotal;
        const service = serviceMap.get(item.service.id) ?? {
          id: item.service.id,
          name: item.service.name,
          bookings: 0,
          revenue: 0,
        };
        service.bookings += 1;
        service.revenue += recognizedItemRevenue;
        serviceMap.set(item.service.id, service);
        if (item.combo) {
          const combo = comboMap.get(item.combo.id) ?? {
            id: item.combo.id,
            name: item.combo.name,
            bookings: 0,
            revenue: 0,
          };
          combo.bookings += 1;
          combo.revenue += recognizedItemRevenue;
          comboMap.set(item.combo.id, combo);
        }
      }
    }
    const approvedReviews = reviews.filter((review) => review.status === 'APPROVED');
    const ratingDistribution = [1, 2, 3, 4, 5].map((rating) => ({
      rating,
      count: approvedReviews.filter((review) => review.overallRating === rating).length,
    }));
    const reviewTrend = Array.from({ length: rangeDays }, (_, index) => {
        const date = new Date(from.getTime() + index * 86400000).toISOString().slice(0, 10);
        const rows = approvedReviews.filter((review) => localDate(review.createdAt, review.booking.branchId) === date);
        return {
          date,
          count: rows.length,
          average: rows.length
            ? Math.round((rows.reduce((sum, item) => sum + item.overallRating, 0) / rows.length) * 10) / 10
            : null,
        };
      });
    return {
      range: {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
        previousFrom: previousFrom.toISOString().slice(0, 10),
        previousTo: previousTo.toISOString().slice(0, 10),
      },
      scope: { branchId: query.branchId ?? null, branchCount: branches.length },
      kpis: {
        netRevenue: compare(net, previousNet),
        bookings: compare(bookings.length, previousBookings.length),
        completedBookings: compare(
          bookings.filter((booking) => booking.status === 'COMPLETED').length,
          previousBookings.filter((booking) => booking.status === 'COMPLETED').length,
        ),
        refundAmount: compare(refund, previousRefund),
      },
      charts: {
        revenueSeries,
        bookingStatus,
        branchComparison,
        topServices: [...serviceMap.values()].sort((left, right) => right.bookings - left.bookings).slice(0, 8),
        topCombos: [...comboMap.values()].sort((left, right) => right.bookings - left.bookings).slice(0, 5),
        review: {
          average: approvedReviews.length
            ? Math.round((approvedReviews.reduce((sum, item) => sum + item.overallRating, 0) / approvedReviews.length) * 10) / 10
            : null,
          count: approvedReviews.length,
            pending: reviews.filter((review) => review.status === 'PENDING').length,
            distribution: ratingDistribution,
            trend: reviewTrend,
          },
      },
    };
  }

  async getFinancialSummary(scope: ReportScope, fromDate: string, toDate: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate) || fromDate > toDate) {
      throw new BadRequestException('Khoảng ngày không hợp lệ');
    }
    const branches = await this.prisma.branch.findMany({
      where: { deletedAt: null, ...this.branchFilter(scope) },
      select: { id: true, name: true, timezone: true },
    });
    const branchIds = branches.map((branch) => branch.id);
    const timezoneByBranch = new Map(branches.map((branch) => [branch.id, branch.timezone || 'Asia/Ho_Chi_Minh']));
    const broadFrom = new Date(`${fromDate}T00:00:00.000Z`);
    broadFrom.setUTCDate(broadFrom.getUTCDate() - 1);
    const broadTo = new Date(`${toDate}T23:59:59.999Z`);
    broadTo.setUTCDate(broadTo.getUTCDate() + 1);
    const localDate = (instant: Date, branchId: string) => {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezoneByBranch.get(branchId) ?? 'Asia/Ho_Chi_Minh',
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(instant);
      const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
      return `${value('year')}-${value('month')}-${value('day')}`;
    };
    const inPeriod = (instant: Date | null, branchId: string) => Boolean(
      instant && localDate(instant, branchId) >= fromDate && localDate(instant, branchId) <= toDate,
    );
    const [bookings, transactions, legacyPayments, refunds, adjustments] = await Promise.all([
      this.prisma.booking.findMany({
        where: { branchId: { in: branchIds }, deletedAt: null, appointmentDate: { gte: broadFrom, lte: broadTo } },
        select: {
          id: true, branchId: true, status: true, appointmentDate: true, finalAmount: true, totalAmount: true,
          bookingServices: { select: { id: true, status: true, priceAtBooking: true } },
          paymentTransactions: { select: { id: true, amount: true, status: true, reversalOfId: true } },
          payments: {
            select: {
              id: true, amount: true, status: true,
              transactions: { select: { id: true } },
              refundRequests: { where: { status: 'REFUNDED' }, select: { id: true, amount: true } },
            },
          },
        },
      }),
      this.prisma.paymentTransaction.findMany({
        where: {
          branchId: { in: branchIds },
          status: { in: ['VERIFIED', 'REVERSED'] },
          OR: [
            { verifiedAt: { gte: broadFrom, lte: broadTo } },
            { verifiedAt: null, createdAt: { gte: broadFrom, lte: broadTo } },
          ],
        },
        select: { id: true, bookingId: true, branchId: true, amount: true, status: true, verifiedAt: true, createdAt: true, reversalOfId: true },
      }),
      this.prisma.payment.findMany({
        where: {
          booking: { branchId: { in: branchIds } },
          status: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
          paidAt: { gte: broadFrom, lte: broadTo },
          transactions: { none: {} },
        },
        select: { id: true, bookingId: true, amount: true, paidAt: true, booking: { select: { branchId: true } } },
      }),
      this.prisma.refundRequest.findMany({
        where: {
          status: 'REFUNDED', processedAt: { gte: broadFrom, lte: broadTo },
          payment: { booking: { branchId: { in: branchIds } } },
        },
        select: { id: true, amount: true, processedAt: true, payment: { select: { bookingId: true, booking: { select: { branchId: true } } } } },
      }),
      this.prisma.priceAdjustment.findMany({
        where: { branchId: { in: branchIds }, status: 'APPLIED', appliedAt: { gte: broadFrom, lte: broadTo } },
        select: { id: true, bookingId: true, branchId: true, type: true, amount: true, appliedAt: true },
      }),
    ]);
    const scopedBookings = bookings.filter((booking) => inPeriod(booking.appointmentDate, booking.branchId));
    const scopedTransactions = transactions.filter((transaction) => inPeriod(transaction.verifiedAt ?? transaction.createdAt, transaction.branchId));
    const scopedLegacy = legacyPayments.filter((payment) => inPeriod(payment.paidAt, payment.booking.branchId));
    const scopedRefunds = refunds.filter((refund) => inPeriod(refund.processedAt, refund.payment.booking.branchId));
    const scopedAdjustments = adjustments.filter((adjustment) => inPeriod(adjustment.appliedAt, adjustment.branchId));
    const verified = scopedTransactions.filter((row) => row.status === 'VERIFIED');
    const reversed = scopedTransactions.filter((row) => row.status === 'REVERSED');
    const grossCollected = verified.reduce((sum, row) => sum + Number(row.amount), 0) +
      scopedLegacy.reduce((sum, row) => sum + Number(row.amount), 0);
    const reversalAmount = reversed.reduce((sum, row) => sum + Number(row.amount), 0);
    const refundAmount = scopedRefunds.reduce((sum, row) => sum + Number(row.amount), 0) + reversalAmount;
    const netCollected = grossCollected - refundAmount;
    const lifetimeNetByBooking = new Map<string, number>();
    for (const booking of scopedBookings) {
      const verifiedAmount = booking.paymentTransactions.filter((row) => row.status === 'VERIFIED').reduce((sum, row) => sum + Number(row.amount), 0);
      const reversedAmount = booking.paymentTransactions.filter((row) => row.status === 'REVERSED').reduce((sum, row) => sum + Number(row.amount), 0);
      const legacyAmount = booking.payments.filter((payment) => payment.transactions.length === 0 && ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status)).reduce((sum, payment) => sum + Number(payment.amount), 0);
      const legacyRefund = booking.payments.flatMap((payment) => payment.refundRequests).reduce((sum, refund) => sum + Number(refund.amount), 0);
      lifetimeNetByBooking.set(booking.id, verifiedAmount - reversedAmount + legacyAmount - legacyRefund);
    }
    const recognizedServiceRevenue = scopedBookings
      .filter((booking) => booking.status === 'COMPLETED')
      .reduce((sum, booking) => sum + Math.max(0, Math.min(Number(booking.finalAmount ?? booking.totalAmount), lifetimeNetByBooking.get(booking.id) ?? 0)), 0);
    const outstandingAmount = scopedBookings
      .filter((booking) => !['CANCELLED', 'REJECTED', 'EXPIRED'].includes(booking.status))
      .reduce((sum, booking) => sum + Math.max(0, Number(booking.finalAmount ?? booking.totalAmount) - (lifetimeNetByBooking.get(booking.id) ?? 0)), 0);
    const discountAmount = Math.abs(scopedAdjustments
      .filter((adjustment) => ['PROMOTION', 'VOUCHER', 'LOYALTY', 'PACKAGE'].includes(adjustment.type) && Number(adjustment.amount) < 0)
      .reduce((sum, adjustment) => sum + Number(adjustment.amount), 0));
    const completedCount = scopedBookings.filter((booking) => booking.status === 'COMPLETED').length;
    const cancelledCount = scopedBookings.filter((booking) => ['CANCELLED', 'REJECTED', 'EXPIRED'].includes(booking.status)).length;
    const noShowCount = scopedBookings.filter((booking) => booking.status === 'NO_SHOW').length;
    return {
      definitions: {
        bookedCount: 'Tất cả lịch được tạo trong kỳ theo ngày hẹn tại múi giờ chi nhánh.',
        grossCollected: 'Tiền từ giao dịch đã xác minh; không phải giá niêm yết hoặc giá snapshot.',
        netCollected: 'grossCollected trừ refund/reversal thực tế phát sinh trong kỳ.',
        recognizedServiceRevenue: 'Tiền đã thu ròng được ghi nhận cho lịch hoàn thành, không vượt giá cuối cùng.',
        outstandingAmount: 'Giá cuối cùng còn thiếu trên các lịch không bị hủy/từ chối/hết hạn.',
      },
      from: fromDate,
      to: toDate,
      branchCount: branches.length,
      bookedCount: scopedBookings.length,
      completedCount,
      cancelledCount,
      noShowCount,
      grossCollected,
      refundAmount,
      netCollected,
      recognizedServiceRevenue,
      discountAmount,
      outstandingAmount,
      cancellationFeeCollected: 0,
      noShowFeeCollected: 0,
      drillDown: {
        bookingIds: scopedBookings.map((booking) => booking.id),
        paymentTransactionIds: verified.map((transaction) => transaction.id),
        refundIds: scopedRefunds.map((refund) => refund.id),
        adjustmentIds: scopedAdjustments.map((adjustment) => adjustment.id),
      },
    };
  }

  private branchFilter(scope: ReportScope): Record<string, unknown> {
    if (scope.branchIds) return { id: { in: scope.branchIds } };
    if (scope.businessIds) return { businessId: { in: scope.businessIds } };
    return {};
  }

  private serviceFilter(scope: ReportScope): Record<string, unknown> {
    if (scope.branchIds) return { branchId: { in: scope.branchIds } };
    if (scope.businessIds) {
      return { branch: { businessId: { in: scope.businessIds } } };
    }
    return {};
  }

  private staffFilter(scope: ReportScope): Record<string, unknown> {
    if (scope.branchIds) return { branchId: { in: scope.branchIds } };
    if (scope.businessIds) {
      return { branch: { businessId: { in: scope.businessIds } } };
    }
    return {};
  }
}
