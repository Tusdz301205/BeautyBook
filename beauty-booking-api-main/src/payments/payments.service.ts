import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { can } from '../common/utils/policy';
import { isPlatformRole } from '../common/utils/scope-helpers';
import {
  ALL_TENANTS,
  assertBranchAccess,
  assertBusinessAccess,
  resolveBusinessIdsForUser,
} from '../common/utils/multi-tenancy';
import { auditLog } from '../common/utils/audit';
import { PrismaService } from '../prisma/prisma.service';
import {
  prismaErrorCode,
  withSerializableTransaction,
} from '../common/utils/serializable-transaction';
import { PaymentProviderRegistry } from './providers/payment-provider.registry';
import type {
  CreateTreatmentPackageDto,
  CreatePaymentPolicyDto,
  GeneratePlatformStatementDto,
  PayPackageInstallmentDto,
  PurchaseTreatmentPackageDto,
  ReservePackageSessionDto,
  TransitionPlatformStatementDto,
} from './dto/payments.dto';
import { LoyaltyService } from '../loyalty/loyalty.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly providerRegistry?: PaymentProviderRegistry,
    @Optional() private readonly loyalty?: LoyaltyService,
  ) {}

  private providers() {
    return this.providerRegistry ?? new PaymentProviderRegistry();
  }

  private hasPaymentCore(client: PrismaService | Prisma.TransactionClient) {
    return !!(client as any).paymentIntent && !!(client as any).paymentTransaction;
  }

  async list(user: AuthUser) {
    const where: any = {};
    if (!isPlatformRole(user)) {
      if (user.roles.includes('CUSTOMER')) {
        where.booking = { customer: { userId: user.id } };
      } else {
        const businessIds = await resolveBusinessIdsForUser(this.prisma, user);
        const branchIds = (user.scopes ?? []).map((scope) => scope.branchId).filter(Boolean);
        where.booking = {
          branch: branchIds.length
            ? { id: { in: branchIds } }
            : { businessId: { in: businessIds } },
        };
      }
    }
    const rows = await this.prisma.payment.findMany({
      where,
      include: {
        booking: {
          include: {
            branch: { select: { id: true, name: true, businessId: true } },
            customer: {
              include: {
                user: { select: { id: true, fullName: true, phone: true } },
              },
            },
            pricingSnapshot: true,
            paymentPolicySnapshot: true,
          },
        },
        refundRequests: {
          select: {
            id: true,
            amount: true,
            reason: true,
            status: true,
            createdAt: true,
            reviewedAt: true,
            processedAt: true,
            settlementReference: true,
            failureReason: true,
            allocations: {
              select: { id: true, bookingServiceId: true, amount: true },
            },
          },
        },
        transactions: {
          select: {
            id: true,
            amount: true,
            currency: true,
            method: true,
            provider: true,
            status: true,
            transactionRef: true,
            verifiedAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((row) => ({
      id: row.id,
      bookingId: row.bookingId,
      amount: row.amount,
      method: row.method,
      status: row.status,
      transactionRef: row.transactionRef,
      paidAt: row.paidAt,
      createdAt: row.createdAt,
      booking: {
        id: row.booking.id,
        bookingCode: row.booking.bookingCode,
        branchId: row.booking.branchId,
        branch: row.booking.branch,
        customer: {
          user: {
            id: row.booking.customer.user.id,
            fullName: row.booking.customer.user.fullName,
            phone: row.booking.customer.user.phone
              ? `***${row.booking.customer.user.phone.slice(-4)}`
              : null,
          },
        },
        pricingSnapshot: row.booking.pricingSnapshot,
        paymentPolicySnapshot: row.booking.paymentPolicySnapshot,
      },
      refundRequests: row.refundRequests,
      transactions: row.transactions,
    }));
  }

  async collect(
    bookingId: string,
    method: 'CASH' | 'BANK_TRANSFER' | 'MOMO' | 'VNPAY' | 'ZALOPAY' | 'CREDIT_CARD',
    user: AuthUser,
    options: {
      amount?: number;
      idempotencyKey?: string;
      evidence?: Record<string, unknown>;
    } = {},
  ) {
    const bookingReference = bookingId.trim();
    if (/^BB-/i.test(bookingReference)) {
      const referencedBooking = await this.prisma.booking.findFirst({
        where: { deletedAt: null, bookingCode: { equals: bookingReference, mode: 'insensitive' } },
        select: { id: true },
      });
      if (!referencedBooking) throw new NotFoundException('Không tìm thấy lịch hẹn theo mã đã nhập');
      bookingId = referencedBooking.id;
    }
    if (!(this.prisma as any).paymentIntent || !(this.prisma as any).paymentTransaction) {
      return this.collectLegacy(bookingId, method, user);
    }
    const unsupportedProviders = ['MOCK_ONLINE', 'MOMO', 'VNPAY', 'ZALOPAY', 'CREDIT_CARD'];
    if (unsupportedProviders.includes(method)) {
      throw new BadRequestException(
        `${method} chưa có gateway, callback và xác minh chữ ký`,
      );
    }
    const idempotencyKey =
      options.idempotencyKey?.trim() || `COLLECT:${bookingId}:${randomUUID()}`;
    try {
      return await withSerializableTransaction(
        this.prisma,
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${bookingId} FOR UPDATE`;
          const booking = await tx.booking.findUnique({
            where: { id: bookingId },
            include: {
              payments: { include: { transactions: true } },
              paymentTransactions: true,
              branch: true,
              customer: { select: { userId: true } },
            },
          });
          if (!booking) throw new NotFoundException('Booking not found');
          const context = {
            tenantId: booking.branch.businessId,
            branchId: booking.branchId,
          };
          const canCollectAtCounter =
            can(user, 'payment:create:branch', context) ||
            can(user, 'payment:create:tenant', context);
          // Khách hàng không được tự tạo giao dịch. Chỉ nhân sự có quyền tại
          // chi nhánh/doanh nghiệp mới được ghi nhận tiền mặt hoặc chuyển khoản thủ công.
          if (!canCollectAtCounter) {
            throw new ForbiddenException('Chỉ nhân sự tại cơ sở mới được ghi nhận thanh toán');
          }
          if (!['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'].includes(booking.status)) {
            throw new ConflictException('Trạng thái booking chưa cho phép ghi nhận thanh toán');
          }
          const existingIntent = await tx.paymentIntent.findUnique({ where: { idempotencyKey } });
          if (existingIntent) return this.checkoutContext(bookingId, user, tx);

          const total = Number(booking.finalAmount ?? booking.totalAmount);
          const verifiedCore = booking.paymentTransactions
            .filter((transaction) => transaction.status === 'VERIFIED')
            .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
          const reversedCore = booking.paymentTransactions
            .filter((transaction) => transaction.status === 'REVERSED')
            .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount)), 0);
          const legacyPaid = booking.payments
            .filter((payment) =>
              payment.transactions.length === 0 &&
              ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status),
            )
            .reduce((sum, payment) => sum + Number(payment.amount), 0);
          const paid = Math.max(0, verifiedCore - reversedCore + legacyPaid);
          const due = Math.max(0, total - paid);
          const amount = options.amount ?? due;
          if (!Number.isFinite(amount) || amount <= 0 || amount > due) {
            throw new BadRequestException(`Số tiền phải lớn hơn 0 và không vượt quá ${due}`);
          }

          const provider = this.providers().resolve(method as PaymentMethod);
          const intent = await tx.paymentIntent.create({
            data: {
              bookingId,
              businessId: booking.branch.businessId,
              branchId: booking.branchId,
              amount,
              method: method as PaymentMethod,
              provider: provider.code,
              status: 'CREATED',
              idempotencyKey,
              createdBy: user.id,
              metadata: options.evidence as any,
            },
          });
          const initiation = await provider.initiate({
            intentId: intent.id,
            amount,
            currency: 'VND',
            idempotencyKey,
            metadata: options.evidence,
          });
          const verified = initiation.status === 'VERIFIED';
          const legacyPayment = await tx.payment.create({
            data: {
              bookingId,
              amount,
              method: method as PaymentMethod,
              status: verified ? 'PAID' : 'PENDING',
              paidAt: verified ? new Date() : null,
              transactionRef: initiation.providerReference || null,
            },
          });
          const transaction = await tx.paymentTransaction.create({
            data: {
              intentId: intent.id,
              paymentId: legacyPayment.id,
              bookingId,
              businessId: booking.branch.businessId,
              branchId: booking.branchId,
              amount,
              method: method as PaymentMethod,
              provider: provider.code,
              status: verified ? 'VERIFIED' : 'PENDING',
              transactionRef: initiation.providerReference || null,
              idempotencyKey: `TX:${idempotencyKey}`,
              evidence: options.evidence as any,
              verifiedBy: verified ? user.id : null,
              verifiedAt: verified ? new Date() : null,
            },
          });
          await tx.paymentIntent.update({
            where: { id: intent.id },
            data: { status: verified ? 'SUCCEEDED' : 'PENDING' },
          });
          if (verified) {
            await this.postPaymentLedger(tx, transaction.id, user.id);
            await this.ensurePlatformFee(tx, bookingId);
          }
          return this.checkoutContext(bookingId, user, tx);
        },
        { conflictMessage: 'Booking vừa được thu tiền bởi yêu cầu khác' },
      );
    } catch (error) {
      if (prismaErrorCode(error) === 'P2002') {
        throw new ConflictException('Yêu cầu thanh toán trùng lặp hoặc booking đã được xử lý');
      }
      throw error;
    }
  }

  private async collectLegacy(
    bookingId: string,
    method: 'CASH' | 'BANK_TRANSFER' | 'MOMO' | 'VNPAY' | 'ZALOPAY' | 'CREDIT_CARD',
    user: AuthUser,
  ) {
    const unsupportedProviders = ['MOCK_ONLINE', 'MOMO', 'VNPAY', 'ZALOPAY', 'CREDIT_CARD'];
    if (unsupportedProviders.includes(method)) {
      throw new BadRequestException(
        `${method} chưa tích hợp gateway, callback và xác minh chữ ký`,
      );
    }

    try {
      return await withSerializableTransaction(
        this.prisma,
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${bookingId} FOR UPDATE`;
          const booking = await tx.booking.findUnique({
            where: { id: bookingId },
            include: { payments: true, branch: true },
          });
          if (!booking) throw new NotFoundException('Booking not found');
          if (!can(user, 'payment:create:branch', {
            tenantId: booking.branch.businessId,
            branchId: booking.branchId,
          })) {
            throw new ForbiddenException('Không có quyền thu tiền tại chi nhánh này');
          }
          if (booking.status !== 'COMPLETED') {
            throw new ConflictException('Chỉ thu tiền khi booking đã hoàn thành');
          }
          if (
            booking.payments.some((payment) =>
              ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status),
            )
          ) {
            throw new ConflictException('Booking đã được thanh toán');
          }

          return tx.payment.create({
            data: {
              bookingId,
              amount: booking.finalAmount ?? booking.totalAmount,
              method: method as any,
              status: 'PAID',
              paidAt: new Date(),
              transactionRef: null,
            },
          });
        },
        { conflictMessage: 'Booking vừa được thu tiền bởi yêu cầu khác' },
      );
    } catch (error) {
      if (prismaErrorCode(error) === 'P2002') {
        throw new ConflictException('Booking đã được thanh toán');
      }
      throw error;
    }
  }

  async requestRefund(
    paymentId: string,
    amount: number,
    reason: string,
    evidence: unknown,
    user: AuthUser,
  ) {
    if (!Number.isFinite(amount) || amount <= 0 || !reason?.trim()) {
      throw new BadRequestException('amount và reason không hợp lệ');
    }
    return withSerializableTransaction(
      this.prisma,
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM payments WHERE id = ${paymentId} FOR UPDATE`;
        const payment = await this.loadPayment(paymentId, tx);
        this.assertRefundScope(user, payment.booking.branch.businessId, 'create');
        if (!['PAID', 'PARTIALLY_REFUNDED'].includes(payment.status)) {
          throw new ConflictException('Payment không thể refund');
        }
        const reserved = payment.refundRequests
          .filter((request) => ['PENDING', 'APPROVED', 'REFUNDED'].includes(request.status))
          .reduce((sum, request) => sum + Number(request.amount), 0);
        if (reserved + amount > Number(payment.amount)) {
          throw new BadRequestException('Số tiền refund vượt quá số tiền đã thanh toán');
        }
        return tx.refundRequest.create({
          data: { paymentId, amount, reason, evidence: evidence as any, requestedBy: user.id },
        });
      },
      { conflictMessage: 'Số dư hoàn tiền vừa thay đổi, vui lòng tải lại' },
    );
  }

  async reviewRefund(
    refundId: string,
    approve: boolean,
    note: string | undefined,
    user: AuthUser,
  ) {
    const refund = await this.loadRefund(refundId);
    this.assertRefundScope(user, refund.payment.booking.branch.businessId, 'approve');
    if (refund.status !== 'PENDING') throw new ConflictException('Refund không còn chờ duyệt');
    if (refund.requestedBy === user.id) {
      throw new ForbiddenException('Người tạo yêu cầu không được tự duyệt refund');
    }
    const result = await this.prisma.refundRequest.updateMany({
      where: { id: refundId, status: 'PENDING' },
      data: {
        status: approve ? 'APPROVED' : 'REJECTED',
        reviewedBy: user.id,
        reviewNote: note,
        reviewedAt: new Date(),
      },
    });
    if (result.count !== 1) throw new ConflictException('Refund đã được xử lý bởi yêu cầu khác');
    return this.prisma.refundRequest.findUnique({ where: { id: refundId } });
  }

  async processRefund(
    refundId: string,
    input: {
      action: 'START' | 'CONFIRM' | 'FAIL';
      settlementReference?: string;
      failureReason?: string;
    },
    user: AuthUser,
  ) {
    if (!can(user, 'refund:process:platform')) {
      throw new ForbiddenException('Permission required: refund:process:platform');
    }
    try {
      return await withSerializableTransaction(
        this.prisma,
        async (tx) => {
          const initial = await tx.refundRequest.findUnique({
            where: { id: refundId },
            select: { paymentId: true },
          });
          if (!initial) throw new NotFoundException('Refund request not found');
          await tx.$queryRaw`SELECT id FROM payments WHERE id = ${initial.paymentId} FOR UPDATE`;
          const refund = await this.loadRefund(refundId, tx);
          if (refund.status === 'REFUNDED') return refund;
          if (
            ['MOMO', 'VNPAY', 'ZALOPAY', 'CREDIT_CARD'].includes(
              refund.payment.method,
            )
          ) {
            throw new BadRequestException(
              `Không thể xác nhận hoàn tiền ${refund.payment.method} khi chưa có provider callback`,
            );
          }

          if (input.action === 'START') {
            if (refund.status === 'PROCESSING') return refund;
            if (refund.status !== 'APPROVED') {
              throw new ConflictException('Refund chưa được duyệt');
            }
            const started = await tx.refundRequest.updateMany({
              where: { id: refundId, status: 'APPROVED' },
              data: {
                status: 'PROCESSING',
                processingStartedAt: new Date(),
                processedBy: user.id,
                failureReason: null,
              },
            });
            if (started.count !== 1) {
              throw new ConflictException('Refund đã được xử lý bởi yêu cầu khác');
            }
            return tx.refundRequest.findUniqueOrThrow({ where: { id: refundId } });
          }

          if (input.action === 'FAIL') {
            if (refund.status !== 'PROCESSING') {
              throw new ConflictException('Refund không ở trạng thái đang xử lý');
            }
            if (!input.failureReason?.trim()) {
              throw new BadRequestException(
                'Cần ghi lý do thất bại để giữ audit trail',
              );
            }
            const failed = await tx.refundRequest.updateMany({
              where: { id: refundId, status: 'PROCESSING' },
              data: {
                status: 'FAILED',
                failureReason: input.failureReason.trim(),
                processedBy: user.id,
              },
            });
            if (failed.count !== 1) {
              throw new ConflictException('Refund đã được xử lý bởi yêu cầu khác');
            }
            return tx.refundRequest.findUniqueOrThrow({ where: { id: refundId } });
          }

          if (refund.status !== 'PROCESSING') {
            throw new ConflictException(
              'Refund phải được bắt đầu xử lý trước khi xác nhận đã hoàn',
            );
          }

          let settlementReference = input.settlementReference?.trim();
          if (!settlementReference) {
            throw new BadRequestException(
              'Cần mã biên nhận/đối soát trước khi xác nhận đã hoàn tiền',
            );
          }

          const completedBefore = refund.payment.refundRequests
            .filter((request) => request.status === 'REFUNDED')
            .reduce((sum, request) => sum + Number(request.amount), 0);
          const completedTotal = completedBefore + Number(refund.amount);
          if (completedTotal > Number(refund.payment.amount)) {
            throw new ConflictException('Refund vượt quá số tiền có thể hoàn');
          }
          const updatedCount = await tx.refundRequest.updateMany({
            where: { id: refundId, status: 'PROCESSING' },
            data: {
              status: 'REFUNDED',
              processedAt: new Date(),
              processedBy: user.id,
              settlementReference,
              failureReason: null,
            },
          });
          if (updatedCount.count !== 1) {
            throw new ConflictException(
              'Refund đã được xử lý bởi yêu cầu khác',
            );
          }
          const paymentStatus =
            completedTotal >= Number(refund.payment.amount)
              ? 'REFUNDED'
              : 'PARTIALLY_REFUNDED';
          await tx.payment.update({
            where: { id: refund.paymentId },
            data: { status: paymentStatus },
          });
          await this.postRefundLedger(tx, refundId, user.id);
          await this.ensurePlatformFeeAdjustment(tx, refundId);
          if (this.loyalty) {
            await this.loyalty.adjustForRefund(
              refund.payment.bookingId,
              refundId,
              Number(refund.amount),
              user.id,
              tx,
            );
          }
          return tx.refundRequest.findUniqueOrThrow({
            where: { id: refundId },
          });
        },
        { conflictMessage: 'Refund vừa được xử lý bởi yêu cầu khác' },
      );
    } catch (error) {
      if (prismaErrorCode(error) === 'P2002') {
        throw new ConflictException('Mã đối soát hoàn tiền đã được sử dụng');
      }
      throw error;
    }
  }

  async captureBookingSnapshots(
    client: Prisma.TransactionClient,
    input: {
      bookingId: string;
      businessId: string;
      branchId: string;
      subtotal: number;
      discount: number;
      total: number;
      items: Array<Record<string, unknown>>;
      serviceIds: string[];
    },
  ) {
    const policy = await this.resolveEffectivePolicy(
      client,
      input.businessId,
      input.branchId,
      input.serviceIds,
      new Date(),
    );
    const requiredAmount = this.depositAmount(
      policy?.depositType ?? 'NONE',
      Number(policy?.depositValue ?? 0),
      input.total,
    );
    await client.pricingSnapshot.create({
      data: {
        bookingId: input.bookingId,
        businessId: input.businessId,
        branchId: input.branchId,
        subtotalAmount: input.subtotal,
        discountAmount: input.discount,
        finalAmount: input.total,
        items: input.items as any,
      },
    });
    await client.paymentPolicySnapshot.create({
      data: {
        bookingId: input.bookingId,
        businessId: input.businessId,
        branchId: input.branchId,
        paymentPolicyId: policy?.id ?? null,
        policyVersion: policy?.version ?? null,
        depositType: policy?.depositType ?? 'NONE',
        depositValue: policy?.depositValue ?? 0,
        requiredAmount,
        allowSplitPayment: policy?.allowSplitPayment ?? true,
        allowInstallments: policy?.allowInstallments ?? false,
      },
    });
  }

  private async resolveEffectivePolicy(
    client: PrismaService | Prisma.TransactionClient,
    businessId: string,
    branchId: string,
    serviceIds: string[],
    at: Date,
  ) {
    const policies = await client.paymentPolicy.findMany({
      where: {
        businessId,
        status: 'ACTIVE',
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
        AND: [{
          OR: [
            { serviceId: { in: serviceIds } },
            { branchId, serviceId: null },
            { branchId: null, serviceId: null },
          ],
        }],
      },
      orderBy: [{ version: 'desc' }, { effectiveFrom: 'desc' }],
    });
    return policies.sort((left, right) => {
      const score = (item: typeof left) => item.serviceId ? 3 : item.branchId ? 2 : 1;
      return score(right) - score(left) || right.version - left.version;
    })[0] ?? null;
  }

  private depositAmount(
    type: 'NONE' | 'FIXED' | 'PERCENTAGE' | 'FULL_PREPAYMENT',
    value: number,
    total: number,
  ) {
    if (type === 'NONE') return 0;
    if (type === 'FULL_PREPAYMENT') return Number(total.toFixed(2));
    if (type === 'FIXED') return Number(Math.min(total, value).toFixed(2));
    return Number(Math.min(total, total * value / 100).toFixed(2));
  }

  async checkoutContext(
    bookingId: string,
    user: AuthUser,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const booking = await client.booking.findUnique({
      where: { id: bookingId },
      include: {
        branch: { select: { id: true, name: true, businessId: true } },
        customer: { select: { userId: true } },
        pricingSnapshot: true,
        paymentPolicySnapshot: true,
        paymentTransactions: { orderBy: { createdAt: 'asc' } },
        payments: {
          include: {
            transactions: { select: { id: true } },
            refundRequests: { where: { status: 'REFUNDED' } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    const own = booking.customer.userId === user.id;
    if (!own) {
      await assertBusinessAccess(this.prisma, user, booking.branch.businessId);
      const branchScoped = user.scopes?.some((scope) => scope.branchId);
      if (branchScoped) {
        const allowed = user.scopes?.some((scope) => scope.branchId === booking.branchId);
        if (!allowed) throw new ForbiddenException('Không có quyền xem checkout này');
      }
    }
    const verified = booking.paymentTransactions
      .filter((item) => item.status === 'VERIFIED')
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const reversed = booking.paymentTransactions
      .filter((item) => item.status === 'REVERSED')
      .reduce((sum, item) => sum + Math.abs(Number(item.amount)), 0);
    const legacy = booking.payments
      .filter((item) =>
        item.transactions.length === 0 &&
        ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(item.status),
      )
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const refunded = booking.payments
      .flatMap((item) => item.refundRequests)
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const total = Number(booking.pricingSnapshot?.finalAmount ?? booking.finalAmount ?? booking.totalAmount);
    const paidAmount = Math.max(0, verified - reversed + legacy - refunded);
    const amountDue = Math.max(0, Number((total - paidAmount).toFixed(2)));
    return {
      booking: {
        id: booking.id,
        bookingCode: booking.bookingCode,
        status: booking.status,
        branch: booking.branch,
      },
      pricing: booking.pricingSnapshot ?? {
        subtotalAmount: booking.totalAmount,
        discountAmount: booking.voucherDiscountAmount ?? 0,
        finalAmount: booking.finalAmount ?? booking.totalAmount,
        currency: 'VND',
      },
      policy: booking.paymentPolicySnapshot ?? {
        depositType: 'NONE',
        depositValue: 0,
        requiredAmount: 0,
        allowSplitPayment: true,
        allowInstallments: false,
      },
      summary: {
        totalAmount: total,
        paidAmount,
        refundedAmount: refunded,
        amountDue,
        status: amountDue <= 0 ? 'PAID' : paidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
      },
      transactions: booking.paymentTransactions.map((item) => ({
        id: item.id,
        amount: item.amount,
        method: item.method,
        provider: item.provider,
        status: item.status,
        transactionRef: item.transactionRef,
        verifiedAt: item.verifiedAt,
        createdAt: item.createdAt,
      })),
      providerCapabilities: this.providers().capabilities(),
    };
  }

  async verifyTransaction(
    transactionId: string,
    settlementReference: string,
    evidence: Record<string, unknown>,
    user: AuthUser,
  ) {
    if (!settlementReference?.trim() || !evidence || !Object.keys(evidence).length) {
      throw new BadRequestException('Cần mã đối soát và chứng từ xác minh');
    }
    return withSerializableTransaction(this.prisma, async (tx) => {
      const existing = await tx.paymentTransaction.findUnique({
        where: { id: transactionId },
        include: {
          booking: { include: { branch: true } },
          packagePurchase: true,
        },
      });
      if (!existing) throw new NotFoundException('Giao dịch không tồn tại');
      const context = {
        tenantId: existing.businessId,
        branchId: existing.branchId,
      };
      if (
        !can(user, 'payment_transaction:verify:branch', context) &&
        !can(user, 'payment_transaction:verify:tenant', context)
      ) {
        throw new ForbiddenException('Không có quyền xác minh giao dịch');
      }
      if (existing.method !== 'BANK_TRANSFER' || existing.provider !== 'MANUAL_BANK_TRANSFER') {
        throw new BadRequestException('Chỉ chuyển khoản thủ công mới dùng luồng xác minh này');
      }
      if (existing.status === 'VERIFIED') {
        return existing.bookingId
          ? this.checkoutContext(existing.bookingId, user, tx)
          : this.packagePurchaseDetail(tx, existing.packagePurchaseId!);
      }
      if (existing.status !== 'PENDING') throw new ConflictException('Giao dịch không còn chờ xác minh');
      const changed = await tx.paymentTransaction.updateMany({
        where: { id: transactionId, status: 'PENDING' },
        data: {
          status: 'VERIFIED',
          transactionRef: settlementReference.trim(),
          evidence: evidence as any,
          verifiedBy: user.id,
          verifiedAt: new Date(),
        },
      });
      if (changed.count !== 1) throw new ConflictException('Giao dịch vừa được xử lý');
      if (existing.paymentId) {
        await tx.payment.update({
          where: { id: existing.paymentId },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            transactionRef: settlementReference.trim(),
          },
        });
      }
      if (existing.intentId) {
        await tx.paymentIntent.update({
          where: { id: existing.intentId },
          data: { status: 'SUCCEEDED' },
        });
      }
      if (existing.packageInstallmentId) {
        await tx.packageInstallment.update({
          where: { id: existing.packageInstallmentId },
          data: { status: 'PAID', paidAt: new Date() },
        });
      }
      await this.postPaymentLedger(tx, transactionId, user.id);
      if (existing.bookingId) {
        await this.ensurePlatformFee(tx, existing.bookingId);
        return this.checkoutContext(existing.bookingId, user, tx);
      }
      if (existing.packagePurchaseId) {
        await this.recalculatePackagePurchase(tx, existing.packagePurchaseId);
        return this.packagePurchaseDetail(tx, existing.packagePurchaseId);
      }
      throw new ConflictException('Giao dịch không gắn với booking hoặc gói liệu trình');
    });
  }

  async reverseTransaction(
    transactionId: string,
    reason: string,
    idempotencyKey: string,
    user: AuthUser,
  ) {
    if (!reason?.trim()) throw new BadRequestException('Lý do reversal là bắt buộc');
    return withSerializableTransaction(this.prisma, async (tx) => {
      const existing = await tx.paymentTransaction.findUnique({ where: { id: transactionId } });
      if (!existing) throw new NotFoundException('Giao dịch không tồn tại');
      if (existing.status !== 'VERIFIED') {
        throw new ConflictException('Chỉ giao dịch đã xác minh mới có thể reversal');
      }
      const context = { tenantId: existing.businessId, branchId: existing.branchId };
      if (
        !can(user, 'payment_transaction:verify:branch', context) &&
        !can(user, 'payment_transaction:verify:tenant', context) &&
        !can(user, 'refund:process:platform')
      ) {
        throw new ForbiddenException('Không có quyền reversal giao dịch');
      }
      const reversal = await tx.paymentTransaction.upsert({
        where: { idempotencyKey },
        update: {},
        create: {
          bookingId: existing.bookingId,
          packagePurchaseId: existing.packagePurchaseId,
          packageInstallmentId: existing.packageInstallmentId,
          businessId: existing.businessId,
          branchId: existing.branchId,
          amount: existing.amount,
          currency: existing.currency,
          method: existing.method,
          provider: existing.provider,
          status: 'REVERSED',
          transactionRef: `REVERSAL:${existing.transactionRef || existing.id}`,
          idempotencyKey,
          reversalOfId: existing.id,
          verifiedBy: user.id,
          verifiedAt: new Date(),
          evidence: { reason },
        },
      });
      await tx.financialLedgerEntry.upsert({
        where: { idempotencyKey: `LEDGER:REVERSAL:${reversal.id}` },
        update: {},
        create: {
          businessId: existing.businessId,
          branchId: existing.branchId,
          bookingId: existing.bookingId,
          paymentTransactionId: reversal.id,
          type: 'REVERSAL',
          direction: 'DEBIT',
          amount: existing.amount,
          sourceType: 'PAYMENT_TRANSACTION_REVERSAL',
          sourceId: reversal.id,
          idempotencyKey: `LEDGER:REVERSAL:${reversal.id}`,
          actorId: user.id,
          metadata: { originalTransactionId: existing.id, reason },
        },
      });
      if (existing.packageInstallmentId) {
        await tx.packageInstallment.update({
          where: { id: existing.packageInstallmentId },
          data: { status: 'DUE', paidAt: null },
        });
      }
      if (existing.packagePurchaseId) {
        await this.recalculatePackagePurchase(tx, existing.packagePurchaseId);
      }
      return reversal;
    });
  }

  private async postPaymentLedger(
    tx: Prisma.TransactionClient,
    transactionId: string,
    actorId: string,
  ) {
    if (!(tx as any).financialLedgerEntry) return null;
    const transaction = await tx.paymentTransaction.findUnique({ where: { id: transactionId } });
    if (!transaction || transaction.status !== 'VERIFIED') return null;
    return tx.financialLedgerEntry.upsert({
      where: { idempotencyKey: `LEDGER:PAYMENT:${transaction.id}` },
      update: {},
      create: {
        businessId: transaction.businessId,
        branchId: transaction.branchId,
        bookingId: transaction.bookingId,
        paymentId: transaction.paymentId,
        paymentTransactionId: transaction.id,
        type: 'PAYMENT_RECEIVED',
        direction: 'CREDIT',
        amount: transaction.amount,
        currency: transaction.currency,
        sourceType: 'PAYMENT_TRANSACTION',
        sourceId: transaction.id,
        idempotencyKey: `LEDGER:PAYMENT:${transaction.id}`,
        actorId,
      },
    });
  }

  private async postRefundLedger(
    tx: Prisma.TransactionClient,
    refundId: string,
    actorId: string,
  ) {
    if (!(tx as any).financialLedgerEntry) return null;
    const refund = await tx.refundRequest.findUnique({
      where: { id: refundId },
      include: { payment: { include: { booking: { include: { branch: true } } } } },
    });
    if (!refund || refund.status !== 'REFUNDED') return null;
    return tx.financialLedgerEntry.upsert({
      where: { idempotencyKey: `LEDGER:REFUND:${refund.id}` },
      update: {},
      create: {
        businessId: refund.payment.booking.branch.businessId,
        branchId: refund.payment.booking.branchId,
        bookingId: refund.payment.bookingId,
        paymentId: refund.paymentId,
        refundId: refund.id,
        type: 'REFUND',
        direction: 'DEBIT',
        amount: refund.amount,
        sourceType: 'REFUND',
        sourceId: refund.id,
        idempotencyKey: `LEDGER:REFUND:${refund.id}`,
        actorId,
        metadata: { settlementReference: refund.settlementReference },
      },
    });
  }

  async ensurePlatformFee(
    tx: Prisma.TransactionClient,
    bookingId: string,
  ) {
    if (!(tx as any).platformFeeEntry) return null;
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        branch: true,
        paymentTransactions: true,
        payments: { include: { transactions: true, refundRequests: { where: { status: 'REFUNDED' } } } },
      },
    });
    if (!booking || booking.status !== 'COMPLETED') return null;
    const verified = booking.paymentTransactions
      .filter((item) => item.status === 'VERIFIED')
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const reversed = booking.paymentTransactions
      .filter((item) => item.status === 'REVERSED')
      .reduce((sum, item) => sum + Math.abs(Number(item.amount)), 0);
    const legacy = booking.payments
      .filter((item) => item.transactions.length === 0 && ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(item.status))
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const refunded = booking.payments
      .flatMap((item) => item.refundRequests)
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const baseAmount = Number(booking.finalAmount ?? booking.totalAmount);
    if (verified - reversed + legacy - refunded < baseAmount) return null;
    const feeRate = Number(this.config?.get<string>('PLATFORM_FEE_RATE_PERCENT') || 5);
    const feeAmount = Number((baseAmount * feeRate / 100).toFixed(2));
    const fee = await tx.platformFeeEntry.upsert({
      where: { bookingId },
      update: {},
      create: {
        businessId: booking.branch.businessId,
        branchId: booking.branchId,
        bookingId,
        baseAmount,
        feeRate,
        feeAmount,
        calculationSnapshot: {
          baseAmount,
          feeRate,
          policy: 'DEFAULT_PLATFORM_FEE',
          calculatedAt: new Date().toISOString(),
        },
      },
    });
    await tx.financialLedgerEntry.upsert({
      where: { idempotencyKey: `LEDGER:PLATFORM_FEE:${fee.id}` },
      update: {},
      create: {
        businessId: fee.businessId,
        branchId: fee.branchId,
        bookingId,
        type: 'PLATFORM_FEE',
        direction: 'DEBIT',
        amount: fee.feeAmount,
        sourceType: 'PLATFORM_FEE',
        sourceId: fee.id,
        idempotencyKey: `LEDGER:PLATFORM_FEE:${fee.id}`,
      },
    });
    return fee;
  }

  private async ensurePlatformFeeAdjustment(
    tx: Prisma.TransactionClient,
    refundId: string,
  ) {
    if (!(tx as any).platformFeeAdjustment) return null;
    const refund = await tx.refundRequest.findUnique({
      where: { id: refundId },
      include: {
        payment: { include: { booking: { include: { platformFeeEntry: true, branch: true } } } },
      },
    });
    const fee = refund?.payment.booking.platformFeeEntry;
    if (!refund || refund.status !== 'REFUNDED' || !fee) return null;
    const existing = await tx.platformFeeAdjustment.findFirst({ where: { refundId } });
    if (existing) return existing;
    const amount = -Math.abs(Number((Number(refund.amount) * Number(fee.feeRate) / 100).toFixed(2)));
    const adjustment = await tx.platformFeeAdjustment.create({
      data: {
        platformFeeId: fee.id,
        businessId: fee.businessId,
        branchId: fee.branchId,
        refundId,
        amount,
        reason: `Điều chỉnh phí theo refund ${refund.id}`,
      },
    });
    await tx.financialLedgerEntry.upsert({
      where: { idempotencyKey: `LEDGER:PLATFORM_FEE_ADJUSTMENT:${adjustment.id}` },
      update: {},
      create: {
        businessId: fee.businessId,
        branchId: fee.branchId,
        bookingId: refund.payment.bookingId,
        refundId,
        type: 'PLATFORM_FEE_ADJUSTMENT',
        direction: 'CREDIT',
        amount: Math.abs(amount),
        sourceType: 'PLATFORM_FEE_ADJUSTMENT',
        sourceId: adjustment.id,
        idempotencyKey: `LEDGER:PLATFORM_FEE_ADJUSTMENT:${adjustment.id}`,
      },
    });
    return adjustment;
  }

  async createPaymentPolicy(user: AuthUser, body: CreatePaymentPolicyDto) {
    await assertBusinessAccess(this.prisma, user, body.businessId);
    if (body.branchId) {
      const businessId = await assertBranchAccess(this.prisma, user, body.branchId);
      if (businessId !== body.businessId) throw new BadRequestException('Chi nhánh không thuộc doanh nghiệp');
    }
    if (body.depositType === 'PERCENTAGE' && body.depositValue > 100) {
      throw new BadRequestException('Tỷ lệ đặt cọc không được vượt quá 100%');
    }
    const effectiveFrom = new Date(body.effectiveFrom);
    const effectiveTo = body.effectiveTo ? new Date(body.effectiveTo) : null;
    const latest = await this.prisma.paymentPolicy.findFirst({
      where: {
        businessId: body.businessId,
        branchId: body.branchId || null,
        serviceId: body.serviceId || null,
        name: body.name,
      },
      orderBy: { version: 'desc' },
    });
    if (latest?.status === 'ACTIVE') {
      await this.prisma.paymentPolicy.update({
        where: { id: latest.id },
        data: {
          status: 'ARCHIVED',
          effectiveTo: new Date(effectiveFrom.getTime() - 1),
        },
      });
    }
    return this.prisma.paymentPolicy.create({
      data: {
        businessId: body.businessId,
        branchId: body.branchId || null,
        serviceId: body.serviceId || null,
        name: body.name.trim(),
        version: (latest?.version || 0) + 1,
        depositType: body.depositType,
        depositValue: body.depositValue,
        allowSplitPayment: body.allowSplitPayment,
        allowInstallments: body.allowInstallments,
        effectiveFrom,
        effectiveTo,
        createdBy: user.id,
      },
    });
  }

  async listPaymentPolicies(user: AuthUser, businessId: string) {
    await assertBusinessAccess(this.prisma, user, businessId);
    return this.prisma.paymentPolicy.findMany({
      where: { businessId },
      include: {
        branch: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
      },
      orderBy: [{ name: 'asc' }, { version: 'desc' }],
    });
  }

  async ledger(
    user: AuthUser,
    query: { businessId?: string; branchId?: string; bookingId?: string; from?: string; to?: string },
  ) {
    if (query.businessId) await assertBusinessAccess(this.prisma, user, query.businessId);
    if (query.branchId) await assertBranchAccess(this.prisma, user, query.branchId);
    const businessIds = await resolveBusinessIdsForUser(this.prisma, user);
    return this.prisma.financialLedgerEntry.findMany({
      where: {
        businessId: query.businessId || (businessIds.includes(ALL_TENANTS) ? undefined : { in: businessIds }),
        branchId: query.branchId || undefined,
        bookingId: query.bookingId || undefined,
        occurredAt: {
          gte: query.from ? new Date(query.from) : undefined,
          lte: query.to ? new Date(query.to) : undefined,
        },
      },
      select: {
        id: true,
        businessId: true,
        branchId: true,
        bookingId: true,
        type: true,
        direction: true,
        amount: true,
        currency: true,
        sourceType: true,
        sourceId: true,
        correlationId: true,
        occurredAt: true,
      },
      orderBy: { occurredAt: 'desc' },
      take: 5000,
    });
  }

  async generatePlatformStatement(
    user: AuthUser,
    body: GeneratePlatformStatementDto,
  ) {
    const periodStart = new Date(body.periodStart);
    const periodEnd = new Date(body.periodEnd);
    if (periodEnd < periodStart) throw new BadRequestException('Kỳ đối soát không hợp lệ');
    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.platformStatement.findFirst({
        where: { businessId: body.businessId, periodStart, periodEnd },
        orderBy: { version: 'desc' },
      });
      if (latest && latest.status !== 'DRAFT') return latest;
      if (latest) {
        return tx.platformStatement.findUnique({
          where: { id: latest.id },
          include: { lines: true },
        });
      }
      const [fees, adjustments] = await Promise.all([
        tx.platformFeeEntry.findMany({
          where: { businessId: body.businessId, createdAt: { gte: periodStart, lte: new Date(periodEnd.getTime() + 86_400_000 - 1) } },
        }),
        tx.platformFeeAdjustment.findMany({
          where: { businessId: body.businessId, createdAt: { gte: periodStart, lte: new Date(periodEnd.getTime() + 86_400_000 - 1) } },
        }),
      ]);
      const gross = fees.reduce((sum, item) => sum + Number(item.feeAmount), 0);
      const adjustmentAmount = adjustments.reduce((sum, item) => sum + Number(item.amount), 0);
      const statement = await tx.platformStatement.create({
        data: {
          businessId: body.businessId,
          periodStart,
          periodEnd,
          version: 1,
          grossFeeAmount: gross,
          adjustmentAmount,
          netAmount: gross + adjustmentAmount,
          lines: {
            create: [
              ...fees.map((fee) => ({
                platformFeeId: fee.id,
                lineType: 'FEE' as const,
                amount: fee.feeAmount,
                sourceSnapshot: {
                  bookingId: fee.bookingId,
                  baseAmount: Number(fee.baseAmount),
                  feeRate: Number(fee.feeRate),
                },
              })),
              ...adjustments.map((adjustment) => ({
                feeAdjustmentId: adjustment.id,
                lineType: 'ADJUSTMENT' as const,
                amount: adjustment.amount,
                sourceSnapshot: {
                  platformFeeId: adjustment.platformFeeId,
                  refundId: adjustment.refundId,
                  reason: adjustment.reason,
                },
              })),
            ],
          },
        },
        include: { lines: true },
      });
      await tx.platformFeeEntry.updateMany({
        where: { id: { in: fees.map((fee) => fee.id) } },
        data: { status: 'STATEMENTED' },
      });
      return statement;
    });
  }

  async listPlatformStatements(user: AuthUser, businessId?: string) {
    if (businessId) await assertBusinessAccess(this.prisma, user, businessId);
    const businessIds = await resolveBusinessIdsForUser(this.prisma, user);
    return this.prisma.platformStatement.findMany({
      where: {
        businessId: businessId || (businessIds.includes(ALL_TENANTS) ? undefined : { in: businessIds }),
      },
      include: { lines: true, business: { select: { id: true, name: true } } },
      orderBy: { periodStart: 'desc' },
    });
  }

  async transitionPlatformStatement(
    user: AuthUser,
    id: string,
    body: TransitionPlatformStatementDto,
  ) {
    const existing = await this.prisma.platformStatement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Đối soát không tồn tại');
    const transitions: Record<string, string[]> = {
      DRAFT: ['REVIEW'],
      REVIEW: ['ISSUED'],
      ISSUED: ['PAID', 'OVERDUE'],
      OVERDUE: ['PAID'],
      PAID: [],
    };
    if (!transitions[existing.status]?.includes(body.status)) {
      throw new ConflictException(`Không thể chuyển ${existing.status} → ${body.status}`);
    }
    const updated = await this.prisma.platformStatement.update({
      where: { id },
      data: {
        status: body.status,
        issuedAt: body.status === 'ISSUED' ? new Date() : undefined,
        lockedAt: body.status === 'ISSUED' ? new Date() : undefined,
        paidAt: body.status === 'PAID' ? new Date() : undefined,
      },
    });
    await auditLog(this.prisma, {
      userId: user.id,
      action: 'STATUS_CHANGE',
      entityType: 'PlatformStatement',
      entityId: id,
      oldData: { status: existing.status },
      newData: { status: body.status },
      reason: body.reason,
    });
    return updated;
  }

  async listTreatmentPackages(input: { businessId?: string; branchId?: string }) {
    return this.prisma.treatmentPackage.findMany({
      where: {
        businessId: input.businessId,
        OR: input.branchId
          ? [{ branchId: input.branchId }, { branchId: null }]
          : undefined,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        businessId: true,
        branchId: true,
        name: true,
        description: true,
        totalPrice: true,
        currency: true,
        sessionCount: true,
        validityDays: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTreatmentPackage(user: AuthUser, body: CreateTreatmentPackageDto) {
    await assertBusinessAccess(this.prisma, user, body.businessId);
    if (body.branchId) {
      const businessId = await assertBranchAccess(this.prisma, user, body.branchId);
      if (businessId !== body.businessId) {
        throw new BadRequestException('Chi nhánh không thuộc doanh nghiệp');
      }
    }
    return this.prisma.treatmentPackage.create({
      data: {
        businessId: body.businessId,
        branchId: body.branchId || null,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        totalPrice: body.totalPrice,
        sessionCount: body.sessionCount,
        validityDays: body.validityDays,
      },
      select: {
        id: true,
        businessId: true,
        branchId: true,
        name: true,
        description: true,
        totalPrice: true,
        currency: true,
        sessionCount: true,
        validityDays: true,
        status: true,
      },
    });
  }

  async purchaseTreatmentPackage(
    user: AuthUser,
    packageId: string,
    body: PurchaseTreatmentPackageDto,
  ) {
    const treatmentPackage = await this.prisma.treatmentPackage.findFirst({
      where: { id: packageId, status: 'ACTIVE' },
      include: { branch: { select: { businessId: true } } },
    });
    if (!treatmentPackage) throw new NotFoundException('Gói liệu trình không tồn tại');
    const branchId = body.branchId || treatmentPackage.branchId;
    if (!branchId) {
      throw new BadRequestException('Cần chọn chi nhánh sử dụng gói liệu trình');
    }
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, businessId: treatmentPackage.businessId, deletedAt: null },
      select: { id: true, businessId: true },
    });
    if (!branch || (treatmentPackage.branchId && treatmentPackage.branchId !== branch.id)) {
      throw new BadRequestException('Chi nhánh không hợp lệ với gói liệu trình');
    }
    // Việc tạo gói và khoản phải thu là nghiệp vụ tại quầy, không phải
    // thanh toán online của khách hàng.
    await assertBranchAccess(this.prisma, user, branch.id);
    const customerId = body.customerId;
    if (!customerId) throw new BadRequestException('Khách hàng là bắt buộc');
    const customer = await this.prisma.customerProfile.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Khách hàng không tồn tại');

    const policy = await this.resolveEffectivePolicy(
      this.prisma,
      treatmentPackage.businessId,
      branch.id,
      [],
      new Date(),
    );
    if (body.installmentCount > 1 && !policy?.allowInstallments) {
      throw new ConflictException('Chính sách hiện tại không cho phép trả góp');
    }
    const total = Number(treatmentPackage.totalPrice);
    const installmentCount = body.installmentCount || 1;
    const baseAmount = Math.floor((total / installmentCount) * 100) / 100;
    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + treatmentPackage.validityDays);

    return withSerializableTransaction(this.prisma, async (tx) => {
      const purchase = await tx.packagePurchase.create({
        data: {
          packageId: treatmentPackage.id,
          customerId: customerId!,
          businessId: treatmentPackage.businessId,
          branchId: branch.id,
          totalAmount: total,
          expiresAt,
          pricingSnapshot: {
            packageId: treatmentPackage.id,
            name: treatmentPackage.name,
            totalPrice: total,
            currency: treatmentPackage.currency,
            sessionCount: treatmentPackage.sessionCount,
            validityDays: treatmentPackage.validityDays,
            paymentPolicyId: policy?.id ?? null,
            paymentPolicyVersion: policy?.version ?? null,
            installmentCount,
            capturedAt: new Date().toISOString(),
          },
          entitlements: {
            create: Array.from({ length: treatmentPackage.sessionCount }, (_, index) => ({
              sequence: index + 1,
            })),
          },
          installments: {
            create: Array.from({ length: installmentCount }, (_, index) => ({
              sequence: index + 1,
              dueAt: new Date(Date.now() + index * 30 * 86400000),
              amount: index === installmentCount - 1
                ? Number((total - baseAmount * (installmentCount - 1)).toFixed(2))
                : baseAmount,
            })),
          },
        },
        include: { installments: true, entitlements: true },
      });
      await auditLog(tx as any, {
        userId: user.id,
        action: 'CREATE',
        entityType: 'PackagePurchase',
        entityId: purchase.id,
        newData: {
          packageId,
          customerId,
          totalAmount: total,
          installmentCount,
          sessionCount: treatmentPackage.sessionCount,
        },
      });
      return purchase;
    });
  }

  async listPackagePurchases(user: AuthUser, businessId?: string) {
    const customerOnly = user.roles.includes('CUSTOMER') &&
      !user.roles.some((role) => ['BUSINESS_OWNER', 'PLATFORM_ADMIN'].includes(role));
    let where: Prisma.PackagePurchaseWhereInput;
    if (customerOnly) {
      where = { customer: { userId: user.id } };
    } else {
      if (businessId) await assertBusinessAccess(this.prisma, user, businessId);
      const businessIds = await resolveBusinessIdsForUser(this.prisma, user);
      where = {
        businessId: businessId ||
          (businessIds.includes(ALL_TENANTS) ? undefined : { in: businessIds }),
      };
    }
    return this.prisma.packagePurchase.findMany({
      where,
      select: {
        id: true,
        totalAmount: true,
        paidAmount: true,
        currency: true,
        status: true,
        purchasedAt: true,
        expiresAt: true,
        package: {
          select: { id: true, name: true, sessionCount: true, validityDays: true },
        },
        installments: {
          select: { id: true, sequence: true, dueAt: true, amount: true, status: true, paidAt: true },
          orderBy: { sequence: 'asc' },
        },
        entitlements: {
          select: { id: true, sequence: true, status: true, bookingId: true, reservedAt: true, redeemedAt: true },
          orderBy: { sequence: 'asc' },
        },
      },
      orderBy: { purchasedAt: 'desc' },
    });
  }

  async payPackageInstallment(
    user: AuthUser,
    installmentId: string,
    body: PayPackageInstallmentDto,
  ) {
    const method = body.method as PaymentMethod;
    const unsupportedProviders: PaymentMethod[] = ['MOCK_ONLINE', 'MOMO', 'VNPAY', 'ZALOPAY', 'CREDIT_CARD'];
    if (unsupportedProviders.includes(method)) {
      throw new BadRequestException(`${method} chưa có gateway và callback xác minh`);
    }
    return withSerializableTransaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM package_installments WHERE id = ${installmentId} FOR UPDATE`;
      const installment = await tx.packageInstallment.findUnique({
        where: { id: installmentId },
        include: {
          purchase: {
            include: { customer: { select: { userId: true } } },
          },
        },
      });
      if (!installment) throw new NotFoundException('Kỳ thanh toán không tồn tại');
      const context = {
        tenantId: installment.purchase.businessId,
        branchId: installment.purchase.branchId || undefined,
        ownerId: installment.purchase.customer.userId,
      };
      const canCollectAtCounter =
        can(user, 'package_purchase:create:branch', context) ||
        can(user, 'package_purchase:create:tenant', context);
      if (!canCollectAtCounter) {
        throw new ForbiddenException('Không có quyền thanh toán gói liệu trình này');
      }
      const previous = await tx.paymentIntent.findUnique({
        where: { idempotencyKey: body.idempotencyKey.trim() },
        include: { transactions: true },
      });
      if (previous) return this.packagePurchaseDetail(tx, installment.purchaseId);
      if (!['DUE', 'FAILED'].includes(installment.status)) {
        throw new ConflictException('Kỳ thanh toán không còn ở trạng thái có thể thu tiền');
      }
      const branchId = installment.purchase.branchId;
      if (!branchId) throw new ConflictException('Giao dịch gói chưa được gắn chi nhánh');
      const provider = this.providers().resolve(method);
      const intent = await tx.paymentIntent.create({
        data: {
          bookingId: null,
          packagePurchaseId: installment.purchaseId,
          packageInstallmentId: installment.id,
          businessId: installment.purchase.businessId,
          branchId,
          amount: installment.amount,
          method,
          provider: provider.code,
          idempotencyKey: body.idempotencyKey.trim(),
          createdBy: user.id,
          metadata: body.evidence as any,
        },
      });
      const initiation = await provider.initiate({
        intentId: intent.id,
        amount: Number(installment.amount),
        currency: installment.purchase.currency,
        idempotencyKey: body.idempotencyKey.trim(),
        metadata: body.evidence,
      });
      const verified = initiation.status === 'VERIFIED';
      const transaction = await tx.paymentTransaction.create({
        data: {
          intentId: intent.id,
          bookingId: null,
          packagePurchaseId: installment.purchaseId,
          packageInstallmentId: installment.id,
          businessId: installment.purchase.businessId,
          branchId,
          amount: installment.amount,
          currency: installment.purchase.currency,
          method,
          provider: provider.code,
          status: verified ? 'VERIFIED' : 'PENDING',
          transactionRef: initiation.providerReference || null,
          idempotencyKey: `TX:${body.idempotencyKey.trim()}`,
          evidence: body.evidence as any,
          verifiedBy: verified ? user.id : null,
          verifiedAt: verified ? new Date() : null,
        },
      });
      await tx.paymentIntent.update({
        where: { id: intent.id },
        data: { status: verified ? 'SUCCEEDED' : 'PENDING' },
      });
      await tx.packageInstallment.update({
        where: { id: installment.id },
        data: {
          paymentIntentId: intent.id,
          status: verified ? 'PAID' : 'PENDING',
          paidAt: verified ? new Date() : null,
        },
      });
      if (verified) {
        await this.postPaymentLedger(tx, transaction.id, user.id);
        await this.recalculatePackagePurchase(tx, installment.purchaseId);
      }
      return this.packagePurchaseDetail(tx, installment.purchaseId);
    });
  }

  async reservePackageSession(
    user: AuthUser,
    purchaseId: string,
    body: ReservePackageSessionDto,
  ) {
    return withSerializableTransaction(this.prisma, async (tx) => {
      const purchase = await tx.packagePurchase.findUnique({
        where: { id: purchaseId },
        include: { customer: { select: { userId: true } } },
      });
      if (!purchase) throw new NotFoundException('Giao dịch gói không tồn tại');
      if (purchase.status !== 'ACTIVE' || purchase.expiresAt <= new Date()) {
        throw new ConflictException('Gói chưa hoạt động hoặc đã hết hạn');
      }
      const context = {
        tenantId: purchase.businessId,
        branchId: purchase.branchId || undefined,
        ownerId: purchase.customer.userId,
      };
      if (
        !can(user, 'package_purchase:create:self', context) &&
        !can(user, 'package_purchase:create:branch', context) &&
        !can(user, 'package_purchase:create:tenant', context)
      ) {
        throw new ForbiddenException('Không có quyền sử dụng gói này');
      }
      const bookingService = await tx.bookingService.findFirst({
        where: {
          id: body.bookingServiceId,
          bookingId: body.bookingId,
          booking: {
            customerId: purchase.customerId,
            branch: { businessId: purchase.businessId },
          },
        },
        select: { id: true, bookingId: true },
      });
      if (!bookingService) {
        throw new BadRequestException('Dịch vụ đặt lịch không thuộc khách hàng và doanh nghiệp của gói');
      }
      const entitlement = await tx.packageSessionEntitlement.findFirst({
        where: { purchaseId, status: 'AVAILABLE' },
        orderBy: { sequence: 'asc' },
      });
      if (!entitlement) throw new ConflictException('Gói không còn lượt sử dụng');
      return tx.packageSessionEntitlement.update({
        where: { id: entitlement.id },
        data: {
          status: 'RESERVED',
          bookingId: body.bookingId,
          redeemedBookingServiceId: body.bookingServiceId,
          reservedAt: new Date(),
        },
      });
    });
  }

  async redeemPackageEntitlements(
    bookingId: string,
    status: 'COMPLETED' | 'CANCELLED' | 'NO_SHOW',
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const reserved = await client.packageSessionEntitlement.findMany({
      where: { bookingId, status: 'RESERVED' },
      select: { id: true, purchaseId: true },
    });
    if (!reserved.length) return;
    if (status === 'COMPLETED') {
      await client.packageSessionEntitlement.updateMany({
        where: { id: { in: reserved.map((item) => item.id) }, status: 'RESERVED' },
        data: { status: 'REDEEMED', redeemedAt: new Date() },
      });
    } else {
      await client.packageSessionEntitlement.updateMany({
        where: { id: { in: reserved.map((item) => item.id) }, status: 'RESERVED' },
        data: {
          status: 'AVAILABLE',
          bookingId: null,
          redeemedBookingServiceId: null,
          reservedAt: null,
        },
      });
    }
    for (const purchaseId of [...new Set(reserved.map((item) => item.purchaseId))]) {
      await this.recalculatePackagePurchase(client, purchaseId);
    }
  }

  private async recalculatePackagePurchase(
    client: PrismaService | Prisma.TransactionClient,
    purchaseId: string,
  ) {
    const purchase = await client.packagePurchase.findUnique({
      where: { id: purchaseId },
      include: { paymentTransactions: true, entitlements: true },
    });
    if (!purchase) return null;
    const verified = purchase.paymentTransactions
      .filter((item) => item.status === 'VERIFIED')
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const reversed = purchase.paymentTransactions
      .filter((item) => item.status === 'REVERSED')
      .reduce((sum, item) => sum + Math.abs(Number(item.amount)), 0);
    const paidAmount = Math.max(0, verified - reversed);
    const allSessionsRedeemed =
      purchase.entitlements.length > 0 &&
      purchase.entitlements.every((item) => item.status === 'REDEEMED');
    const fullyPaid = paidAmount >= Number(purchase.totalAmount);
    const status = allSessionsRedeemed && fullyPaid
      ? 'COMPLETED'
      : paidAmount > 0
        ? 'ACTIVE'
        : 'PENDING_PAYMENT';
    return client.packagePurchase.update({
      where: { id: purchaseId },
      data: { paidAmount, status },
    });
  }

  private packagePurchaseDetail(
    client: PrismaService | Prisma.TransactionClient,
    purchaseId: string,
  ) {
    return client.packagePurchase.findUnique({
      where: { id: purchaseId },
      select: {
        id: true,
        totalAmount: true,
        paidAmount: true,
        currency: true,
        status: true,
        purchasedAt: true,
        expiresAt: true,
        package: { select: { id: true, name: true, sessionCount: true } },
        installments: {
          select: { id: true, sequence: true, dueAt: true, amount: true, status: true, paidAt: true },
          orderBy: { sequence: 'asc' },
        },
        entitlements: {
          select: { id: true, sequence: true, status: true, bookingId: true, reservedAt: true, redeemedAt: true },
          orderBy: { sequence: 'asc' },
        },
        paymentTransactions: {
          select: {
            id: true,
            amount: true,
            method: true,
            provider: true,
            status: true,
            transactionRef: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  providerCapabilities() {
    return this.providers().capabilities();
  }

  private loadPayment(
    paymentId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    return client.payment.findUnique({
      where: { id: paymentId },
      include: { booking: { include: { branch: true } }, refundRequests: true },
    }).then((payment) => {
      if (!payment) throw new NotFoundException('Payment not found');
      return payment;
    });
  }

  private loadRefund(
    refundId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    return client.refundRequest.findUnique({
      where: { id: refundId },
      include: { payment: { include: { booking: { include: { branch: true } }, refundRequests: true } } },
    }).then((refund) => {
      if (!refund) throw new NotFoundException('Refund request not found');
      return refund;
    });
  }

  private assertRefundScope(user: AuthUser, businessId: string, action: 'create' | 'approve') {
    const platformPermission = `refund:${action}:platform`;
    const tenantPermission = `refund:${action}:tenant`;
    if (can(user, platformPermission)) return;
    if (can(user, tenantPermission, { tenantId: businessId })) return;
    throw new ForbiddenException(`Permission required: ${platformPermission}|${tenantPermission}`);
  }
}
