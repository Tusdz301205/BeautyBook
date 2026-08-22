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
              select: { id: true },
            },
          },
        },
      },
    });

    return categories
      .map((cat) => ({
        name: cat.name,
        value: cat.services.reduce(
          (sum, svc) => sum + svc.bookingServices.length,
          0,
        ),
      }))
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
          select: { id: true },
        },
      },
    });

    return services
      .map((svc) => ({
        name: svc.name,
        value: svc.bookingServices.length,
      }))
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
              select: { status: true, totalAmount: true },
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
          revenue: completedServices.reduce(
            (sum, bs) => sum + Number(bs.priceAtBooking),
            0,
          ),
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
      bookings,
      previousBookings,
      payments,
      previousPayments,
      attendance,
      pendingAdjustments,
      reviews,
    ] = await Promise.all([
      this.prisma.branch.findMany({
        where: { deletedAt: null, ...scopedBranchFilter },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              staff: { where: { status: 'ACTIVE', deletedAt: null } },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.booking.findMany({
        where: bookingWhere,
        select: {
          id: true,
          branchId: true,
          appointmentDate: true,
          status: true,
          voucherDiscountAmount: true,
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
          where: previousBookingWhere,
          select: {
            id: true,
            status: true,
            appointmentDate: true,
            voucherDiscountAmount: true,
          },
      }),
      this.prisma.payment.findMany({
        where: {
          status: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
          paidAt: { gte: from, lte: to },
          booking: { branch: scopedBranchFilter },
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
          paidAt: { gte: previousFrom, lte: previousTo },
          booking: { branch: scopedBranchFilter },
        },
          select: {
            amount: true,
            paidAt: true,
            refundRequests: {
              where: { status: 'REFUNDED' },
              select: { amount: true },
          },
        },
      }),
      this.prisma.staffAttendance.findMany({
        where: { branch: scopedBranchFilter, workDate: { gte: from, lte: to } },
        select: { branchId: true, workDate: true, status: true },
      }),
      this.prisma.attendanceExceptionRequest.count({
        where: { branch: scopedBranchFilter, status: 'PENDING', workDate: { gte: from, lte: to } },
      }),
      this.prisma.review.findMany({
        where: {
          deletedAt: null,
          createdAt: { gte: from, lte: to },
          booking: { branch: scopedBranchFilter },
        },
        select: {
          id: true,
          overallRating: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);
    const previousGross = previousPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const previousRefund = previousPayments.reduce(
      (sum, payment) => sum + payment.refundRequests.reduce((refundSum, refund) => refundSum + Number(refund.amount), 0),
      0,
    );
    const previousNet = previousGross - previousRefund;
    const gross = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const refund = payments.reduce(
      (sum, payment) => sum + payment.refundRequests.reduce((refundSum, item) => refundSum + Number(item.amount), 0),
      0,
    );
    const net = gross - refund;
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
      const key = payment.paidAt.toISOString().slice(0, 10);
      const row = revenueByDay.get(key) ?? { gross: 0, refund: 0 };
      row.gross += Number(payment.amount);
      row.refund += payment.refundRequests.reduce((sum, item) => sum + Number(item.amount), 0);
      revenueByDay.set(key, row);
    }
      const discountByDay = new Map<string, number>();
    for (const booking of bookings) {
      const key = booking.appointmentDate.toISOString().slice(0, 10);
        discountByDay.set(key, (discountByDay.get(key) ?? 0) + Number(booking.voucherDiscountAmount ?? 0));
      }
      const previousRevenueByDay = new Map<string, { gross: number; refund: number }>();
      for (const payment of previousPayments) {
        if (!payment.paidAt) continue;
        const key = payment.paidAt.toISOString().slice(0, 10);
        const row = previousRevenueByDay.get(key) ?? { gross: 0, refund: 0 };
        row.gross += Number(payment.amount);
        row.refund += payment.refundRequests.reduce((sum, item) => sum + Number(item.amount), 0);
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
      const branchGross = branchPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      const branchRefund = branchPayments.reduce(
        (sum, payment) => sum + payment.refundRequests.reduce((refundSum, item) => refundSum + Number(item.amount), 0),
        0,
      );
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
    for (const booking of bookings) {
      for (const item of booking.bookingServices) {
        const price = Number(item.priceAtBooking);
        const service = serviceMap.get(item.service.id) ?? {
          id: item.service.id,
          name: item.service.name,
          bookings: 0,
          revenue: 0,
        };
        service.bookings += 1;
        service.revenue += price;
        serviceMap.set(item.service.id, service);
        if (item.combo) {
          const combo = comboMap.get(item.combo.id) ?? {
            id: item.combo.id,
            name: item.combo.name,
            bookings: 0,
            revenue: 0,
          };
          combo.bookings += 1;
          combo.revenue += price;
          comboMap.set(item.combo.id, combo);
        }
      }
    }
    const attendanceStatuses = ['CHECKED_OUT', 'LATE', 'LEFT_EARLY', 'MISSING_CHECKOUT', 'ABSENT', 'NOT_CHECKED_IN'];
    const attendanceStatus = attendanceStatuses.map((status) => ({
      status,
      count: attendance.filter((row) => row.status === status).length,
    }));
    const ratingDistribution = [1, 2, 3, 4, 5].map((rating) => ({
      rating,
      count: reviews.filter((review) => review.overallRating === rating).length,
    }));
      const approvedReviews = reviews.filter((review) => review.status === 'APPROVED');
      const reviewTrend = Array.from({ length: rangeDays }, (_, index) => {
        const date = new Date(from.getTime() + index * 86400000).toISOString().slice(0, 10);
        const rows = approvedReviews.filter((review) => review.createdAt.toISOString().slice(0, 10) === date);
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
        attendanceStatus,
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
      pendingAdjustments,
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
