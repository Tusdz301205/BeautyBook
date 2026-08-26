import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { withSerializableTransaction } from '../common/utils/serializable-transaction';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async issueInvoice(bookingId: string, actorId: string, input: {
    taxRate?: number; taxInclusive?: boolean; buyer?: Record<string, unknown>; invoiceRequestId?: string;
  }) {
    const taxRate = Number(input.taxRate ?? 0);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new BadRequestException('Thuế suất không hợp lệ');
    return withSerializableTransaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${bookingId} FOR UPDATE`;
      const existing = await tx.invoice.findFirst({ where: { bookingId, status: 'ISSUED' } });
      if (existing) {
        if (input.invoiceRequestId) {
          await tx.invoiceInformationRequest.updateMany({
            where: { id: input.invoiceRequestId, bookingId, status: 'PENDING' },
            data: { status: 'FULFILLED', invoiceId: existing.id, resolvedBy: actorId, resolvedAt: new Date(), openKey: null },
          });
        }
        return existing;
      }
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          branch: { include: { business: true } },
          customer: { include: { user: { select: { fullName: true, email: true, phone: true } } } },
          bookingServices: true,
          paymentTransactions: true,
          payments: { include: { transactions: true, refundRequests: { where: { status: 'REFUNDED' } } } },
        },
      });
      if (!booking) throw new NotFoundException('Booking không tồn tại');
      const invoiceRequest = input.invoiceRequestId
        ? await tx.invoiceInformationRequest.findUnique({ where: { id: input.invoiceRequestId } })
        : null;
      if (input.invoiceRequestId && (!invoiceRequest || invoiceRequest.bookingId !== bookingId || invoiceRequest.status !== 'PENDING')) {
        throw new ConflictException('Yêu cầu thông tin hóa đơn không còn hiệu lực');
      }
      const verified = booking.paymentTransactions.filter((row) => row.status === 'VERIFIED').reduce((sum, row) => sum + Number(row.amount), 0);
      const reversed = booking.paymentTransactions.filter((row) => row.status === 'REVERSED').reduce((sum, row) => sum + Number(row.amount), 0);
      const legacy = booking.payments.filter((payment) => payment.transactions.length === 0 && ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status)).reduce((sum, payment) => sum + Number(payment.amount), 0);
      const refund = booking.payments.flatMap((payment) => payment.refundRequests).reduce((sum, row) => sum + Number(row.amount), 0);
      const netPaid = verified - reversed + legacy - refund;
      const totalBeforeTax = Number(booking.finalAmount ?? booking.totalAmount);
      if (netPaid < totalBeforeTax) throw new ConflictException('Chỉ phát hành hóa đơn khi booking đã được thu đủ');
      await tx.$queryRaw`SELECT id FROM businesses WHERE id = ${booking.branch.businessId} FOR UPDATE`;
      const year = new Date().getUTCFullYear();
      const sequence = await tx.invoice.count({ where: { businessId: booking.branch.businessId, createdAt: { gte: new Date(`${year}-01-01T00:00:00.000Z`) } } }) + 1;
      const invoiceNumber = `BB-${year}-${String(sequence).padStart(7, '0')}`;
      const taxInclusive = input.taxInclusive ?? true;
      const taxAmount = taxRate === 0 ? 0 : taxInclusive
        ? Math.round(totalBeforeTax * taxRate / (100 + taxRate))
        : Math.round(totalBeforeTax * taxRate / 100);
      const totalAmount = taxInclusive ? totalBeforeTax : totalBeforeTax + taxAmount;
      const subtotal = Number(booking.totalAmount);
      const discount = Math.max(0, subtotal - totalBeforeTax);
      const invoice = await tx.invoice.create({ data: {
        businessId: booking.branch.businessId,
        branchId: booking.branchId,
        bookingId,
        invoiceNumber,
        status: 'ISSUED',
        subtotalAmount: subtotal,
        discountAmount: discount,
        taxAmount,
        totalAmount,
        taxInclusive,
        taxRate,
        buyerSnapshot: (input.buyer ?? (invoiceRequest?.buyerSnapshot as Record<string, unknown> | undefined) ?? {
          name: booking.customer.user.fullName,
          email: booking.customer.user.email,
          phone: booking.customer.user.phone,
        }) as Prisma.InputJsonValue,
        sellerSnapshot: {
          businessId: booking.branch.businessId,
          businessName: booking.branch.business.name,
          branchId: booking.branchId,
          branchName: booking.branch.name,
          address: booking.branch.addressLine,
          legalNote: 'Yêu cầu hóa đơn/VAT cần được xác minh theo thị trường triển khai.',
        } as Prisma.InputJsonValue,
        issuedAt: new Date(),
        createdBy: actorId,
      } });
      const itemSubtotal = booking.bookingServices.reduce((sum, item) => sum + Number(item.priceAtBooking), 0) || 1;
      await tx.invoiceLine.createMany({ data: booking.bookingServices.map((item, index) => {
        const unitPrice = Number(item.priceAtBooking);
        const lineDiscount = index === booking.bookingServices.length - 1
          ? discount - booking.bookingServices.slice(0, index).reduce((sum, row) => sum + Math.round(discount * Number(row.priceAtBooking) / itemSubtotal), 0)
          : Math.round(discount * unitPrice / itemSubtotal);
        const netLine = Math.max(0, unitPrice - lineDiscount);
        const lineTax = taxRate === 0 ? 0 : taxInclusive ? Math.round(netLine * taxRate / (100 + taxRate)) : Math.round(netLine * taxRate / 100);
        return {
          invoiceId: invoice.id,
          bookingServiceId: item.id,
          description: item.serviceNameSnapshot,
          quantity: 1,
          unitPrice,
          discountAmount: lineDiscount,
          taxRate,
          taxAmount: lineTax,
          lineTotal: taxInclusive ? netLine : netLine + lineTax,
        };
      }) });
      await tx.invoiceEvent.create({ data: { invoiceId: invoice.id, actorId, action: 'ISSUE', snapshot: invoice as any } });
      if (invoiceRequest) {
        await tx.invoiceInformationRequest.update({
          where: { id: invoiceRequest.id },
          data: { status: 'FULFILLED', invoiceId: invoice.id, resolvedBy: actorId, resolvedAt: new Date(), openKey: null },
        });
      }
      const lines = await tx.invoiceLine.findMany({ where: { invoiceId: invoice.id } });
      return { ...invoice, lines };
    }, { conflictMessage: 'Hóa đơn vừa được phát hành bởi thao tác khác' });
  }

  async requestInvoiceInformation(customerId: string, input: {
    bookingId: string;
    buyerName: string;
    buyerEmail?: string;
    buyerTaxCode?: string;
    buyerAddress?: string;
    note?: string;
    idempotencyKey: string;
  }) {
    if (!input.bookingId || !input.buyerName?.trim() || !input.idempotencyKey?.trim()) {
      throw new BadRequestException('Booking, tên người mua và idempotency key là bắt buộc');
    }
    return withSerializableTransaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${input.bookingId} FOR UPDATE`;
      const prior = await tx.invoiceInformationRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey.trim() } });
      if (prior) {
        if (prior.customerId !== customerId) throw new ConflictException('Idempotency key đã được sử dụng');
        return prior;
      }
      const openRequest = await tx.invoiceInformationRequest.findUnique({ where: { openKey: input.bookingId } });
      if (openRequest) {
        if (openRequest.customerId !== customerId) throw new ConflictException('Booking đã có yêu cầu hóa đơn đang xử lý');
        return openRequest;
      }
      const booking = await tx.booking.findUnique({
        where: { id: input.bookingId },
        include: {
          branch: { select: { id: true, businessId: true } },
          paymentTransactions: true,
          payments: { include: { transactions: true, refundRequests: { where: { status: 'REFUNDED' } } } },
          invoiceRequests: true,
        },
      });
      if (!booking || booking.customerId !== customerId) throw new NotFoundException('Booking không tồn tại trong tài khoản');
      const issuedInvoice = await tx.invoice.findFirst({ where: { bookingId: booking.id, status: 'ISSUED' }, select: { id: true } });
      if (issuedInvoice) throw new ConflictException('Booking đã có hóa đơn được phát hành');
      if (['CANCELLED', 'REJECTED', 'EXPIRED'].includes(booking.status)) throw new ConflictException('Booking đã hủy không thể yêu cầu hóa đơn dịch vụ');
      const verified = booking.paymentTransactions.filter((row) => row.status === 'VERIFIED').reduce((sum, row) => sum + Number(row.amount), 0);
      const reversed = booking.paymentTransactions.filter((row) => row.status === 'REVERSED').reduce((sum, row) => sum + Number(row.amount), 0);
      const legacy = booking.payments.filter((payment) => payment.transactions.length === 0 && ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status)).reduce((sum, payment) => sum + Number(payment.amount), 0);
      const refunded = booking.payments.flatMap((payment) => payment.refundRequests).reduce((sum, row) => sum + Number(row.amount), 0);
      const requiredAmount = Number(booking.finalAmount ?? booking.totalAmount);
      if (verified - reversed + legacy - refunded < requiredAmount) throw new ConflictException('Booking chưa được thu đủ để yêu cầu hóa đơn');
      return tx.invoiceInformationRequest.create({ data: {
        bookingId: booking.id,
        customerId,
        businessId: booking.branch.businessId,
        branchId: booking.branch.id,
        buyerSnapshot: {
          name: input.buyerName.trim(),
          email: input.buyerEmail?.trim() || null,
          taxCode: input.buyerTaxCode?.trim() || null,
          address: input.buyerAddress?.trim() || null,
        } as Prisma.InputJsonValue,
        customerNote: input.note?.trim() || null,
        openKey: booking.id,
        idempotencyKey: input.idempotencyKey.trim(),
      } });
    }, { conflictMessage: 'Yêu cầu hóa đơn vừa được tạo bởi thao tác khác' });
  }

  async listInvoiceInformationRequests(where: { customerId?: string; businessIds?: string[]; branchIds?: string[] }) {
    return this.prisma.invoiceInformationRequest.findMany({
      where: {
        ...(where.customerId ? { customerId: where.customerId } : {}),
        ...(where.businessIds ? { businessId: { in: where.businessIds } } : {}),
        ...(where.branchIds ? { branchId: { in: where.branchIds } } : {}),
      },
      include: {
        booking: { select: { id: true, bookingCode: true, status: true, appointmentDate: true, finalAmount: true, totalAmount: true } },
        branch: { select: { id: true, name: true } },
        invoice: { select: { id: true, invoiceNumber: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async cancelInvoiceInformationRequest(id: string, customerId: string) {
    const result = await this.prisma.invoiceInformationRequest.updateMany({
      where: { id, customerId, status: 'PENDING' },
      data: { status: 'CANCELLED', resolvedAt: new Date(), openKey: null },
    });
    if (result.count !== 1) throw new ConflictException('Yêu cầu không còn chờ xử lý');
    return this.prisma.invoiceInformationRequest.findUnique({ where: { id } });
  }

  async rejectInvoiceInformationRequest(id: string, actorId: string, businessIds: string[], reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Lý do từ chối là bắt buộc');
    const result = await this.prisma.invoiceInformationRequest.updateMany({
      where: { id, businessId: { in: businessIds }, status: 'PENDING' },
      data: { status: 'REJECTED', resolutionNote: reason.trim(), resolvedBy: actorId, resolvedAt: new Date(), openKey: null },
    });
    if (result.count !== 1) throw new ConflictException('Yêu cầu không còn chờ xử lý hoặc ngoài phạm vi');
    return this.prisma.invoiceInformationRequest.findUnique({ where: { id } });
  }

  async listInvoices(where: { businessIds?: string[]; branchIds?: string[]; customerId?: string }) {
    const bookingIds = where.customerId
      ? (await this.prisma.booking.findMany({ where: { customerId: where.customerId }, select: { id: true } })).map((booking) => booking.id)
      : undefined;
    const invoices = await this.prisma.invoice.findMany({
      where: {
        ...(where.businessIds ? { businessId: { in: where.businessIds } } : {}),
        ...(where.branchIds ? { branchId: { in: where.branchIds } } : {}),
        ...(bookingIds ? { bookingId: { in: bookingIds } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    const lines = await this.prisma.invoiceLine.findMany({ where: { invoiceId: { in: invoices.map((invoice) => invoice.id) } } });
    const events = await this.prisma.invoiceEvent.findMany({ where: { invoiceId: { in: invoices.map((invoice) => invoice.id) } }, orderBy: { createdAt: 'asc' } });
    return invoices.map((invoice) => ({
      ...invoice,
      lines: lines.filter((line) => line.invoiceId === invoice.id),
      events: events.filter((event) => event.invoiceId === invoice.id),
    }));
  }

  async cancelInvoice(invoiceId: string, actorId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Lý do hủy hóa đơn là bắt buộc');
    return withSerializableTransaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${invoiceId} FOR UPDATE`;
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice || invoice.status !== 'ISSUED') throw new ConflictException('Hóa đơn không thể hủy');
      const updated = await tx.invoice.update({ where: { id: invoiceId }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
      await tx.invoiceEvent.create({ data: { invoiceId, actorId, action: 'CANCEL', reason: reason.trim(), snapshot: updated as any } });
      return updated;
    }, { conflictMessage: 'Hóa đơn vừa thay đổi' });
  }

  async reissueInvoice(invoiceId: string, actorId: string, input: { reason: string; buyer?: Record<string, unknown> }) {
    if (!input.reason?.trim()) throw new BadRequestException('Lý do phát hành lại là bắt buộc');
    return withSerializableTransaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${invoiceId} FOR UPDATE`;
      const source = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { replacement: { select: { id: true } } } });
      if (!source || source.status !== 'ISSUED' || source.replacement) throw new ConflictException('Hóa đơn không thể phát hành lại');
      await tx.$queryRaw`SELECT id FROM businesses WHERE id = ${source.businessId} FOR UPDATE`;
      const lines = await tx.invoiceLine.findMany({ where: { invoiceId } });
      const year = new Date().getUTCFullYear();
      const sequence = await tx.invoice.count({ where: { businessId: source.businessId, createdAt: { gte: new Date(`${year}-01-01T00:00:00.000Z`) } } }) + 1;
      const replacement = await tx.invoice.create({ data: {
        businessId: source.businessId,
        branchId: source.branchId,
        bookingId: source.bookingId,
        paymentId: source.paymentId,
        invoiceNumber: `BB-${year}-${String(sequence).padStart(7, '0')}`,
        status: 'ISSUED',
        currency: source.currency,
        subtotalAmount: source.subtotalAmount,
        discountAmount: source.discountAmount,
        taxAmount: source.taxAmount,
        totalAmount: source.totalAmount,
        taxInclusive: source.taxInclusive,
        taxRate: source.taxRate,
        buyerSnapshot: (input.buyer ?? source.buyerSnapshot ?? {}) as Prisma.InputJsonValue,
        sellerSnapshot: source.sellerSnapshot as Prisma.InputJsonValue,
        version: source.version + 1,
        replacesInvoiceId: source.id,
        issuedAt: new Date(),
        createdBy: actorId,
      } });
      if (lines.length) {
        await tx.invoiceLine.createMany({ data: lines.map((line) => ({
          invoiceId: replacement.id,
          bookingServiceId: line.bookingServiceId,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountAmount: line.discountAmount,
          taxRate: line.taxRate,
          taxAmount: line.taxAmount,
          lineTotal: line.lineTotal,
        })) });
      }
      const adjusted = await tx.invoice.update({ where: { id: source.id }, data: { status: 'ADJUSTED', cancelledAt: new Date() } });
      await tx.invoiceEvent.createMany({ data: [
        { invoiceId: source.id, actorId, action: 'REISSUE', reason: input.reason.trim(), snapshot: adjusted as any },
        { invoiceId: replacement.id, actorId, action: 'ISSUE_REPLACEMENT', reason: input.reason.trim(), snapshot: replacement as any },
      ] });
      return { ...replacement, lines: await tx.invoiceLine.findMany({ where: { invoiceId: replacement.id } }) };
    }, { conflictMessage: 'Hóa đơn vừa thay đổi hoặc đã được phát hành lại' });
  }

  async openShift(branchId: string, actorId: string, openingBalance: number) {
    if (!Number.isFinite(openingBalance) || openingBalance < 0) throw new BadRequestException('Số dư đầu ca không hợp lệ');
    try {
      return await this.prisma.cashShift.create({ data: { branchId, openedBy: actorId, openingBalance, openKey: branchId } });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('Chi nhánh đang có ca tiền mặt mở');
      throw error;
    }
  }

  async addCashMovement(shiftId: string, actorId: string, input: { type: 'MANUAL_IN' | 'MANUAL_OUT'; amount: number; reason: string; idempotencyKey: string }) {
    if (!Number.isFinite(input.amount) || input.amount <= 0 || !input.reason?.trim() || !input.idempotencyKey) throw new BadRequestException('Giao dịch tiền mặt không hợp lệ');
    const shift = await this.prisma.cashShift.findUnique({ where: { id: shiftId } });
    if (!shift || shift.status !== 'OPEN') throw new ConflictException('Ca tiền mặt không mở');
    return this.prisma.cashMovement.upsert({ where: { idempotencyKey: input.idempotencyKey }, update: {}, create: {
      cashShiftId: shiftId, branchId: shift.branchId, type: input.type, amount: input.amount,
      reason: input.reason.trim(), actorId, idempotencyKey: input.idempotencyKey,
    } });
  }

  async closeShift(shiftId: string, actorId: string, input: { actualClosingBalance: number; varianceReason?: string; approvalThreshold?: number }) {
    if (!Number.isFinite(input.actualClosingBalance) || input.actualClosingBalance < 0) throw new BadRequestException('Số dư cuối ca không hợp lệ');
    return withSerializableTransaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM cash_shifts WHERE id = ${shiftId} FOR UPDATE`;
      const shift = await tx.cashShift.findUnique({ where: { id: shiftId } });
      if (!shift || shift.status !== 'OPEN') throw new ConflictException('Ca tiền mặt không còn mở');
      const movements = await tx.cashMovement.findMany({ where: { cashShiftId: shiftId } });
      const expected = Number(shift.openingBalance) + movements.reduce((sum, movement) =>
        sum + (['PAYMENT', 'MANUAL_IN'].includes(movement.type) ? Number(movement.amount) : -Number(movement.amount)), 0);
      const variance = input.actualClosingBalance - expected;
      const threshold = Math.max(0, input.approvalThreshold ?? 0);
      if (variance !== 0 && !input.varianceReason?.trim()) throw new BadRequestException('Cần lý do khi tiền cuối ca chênh lệch');
      const requiresApproval = Math.abs(variance) > threshold;
      return tx.cashShift.update({ where: { id: shiftId }, data: {
        expectedClosingBalance: expected,
        actualClosingBalance: input.actualClosingBalance,
        varianceAmount: variance,
        varianceReason: input.varianceReason?.trim(),
        closedBy: actorId,
        closedAt: new Date(),
        status: requiresApproval ? 'PENDING_APPROVAL' : 'CLOSED',
        openKey: null,
      } });
    }, { conflictMessage: 'Ca tiền mặt vừa được đóng bởi thao tác khác' });
  }

  async approveShift(shiftId: string, actorId: string) {
    const updated = await this.prisma.cashShift.updateMany({
      where: { id: shiftId, status: 'PENDING_APPROVAL', closedBy: { not: actorId } },
      data: { status: 'CLOSED', approvedBy: actorId, approvedAt: new Date() },
    });
    if (updated.count !== 1) throw new ConflictException('Ca không chờ duyệt hoặc người đóng ca không được tự duyệt');
    return this.prisma.cashShift.findUnique({ where: { id: shiftId } });
  }

  async shiftDetail(shiftId: string) {
    const shift = await this.prisma.cashShift.findUnique({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException('Ca tiền mặt không tồn tại');
    const movements = await this.prisma.cashMovement.findMany({ where: { cashShiftId: shiftId }, orderBy: { createdAt: 'asc' } });
    return { ...shift, movements };
  }

  async listShifts(branchIds: string[]) {
    return this.prisma.cashShift.findMany({
      where: { branchId: { in: branchIds } },
      orderBy: { openedAt: 'desc' },
      take: 100,
    });
  }

  async recordCashPayment(tx: Prisma.TransactionClient, input: { branchId: string; paymentId?: string; amount: number; actorId: string; sourceId: string }) {
    const shift = await tx.cashShift.findFirst({ where: { branchId: input.branchId, status: 'OPEN', openKey: input.branchId } });
    if (!shift) throw new ConflictException('Cần mở ca tiền mặt trước khi xác minh thanh toán CASH');
    return tx.cashMovement.upsert({ where: { idempotencyKey: `CASH:PAYMENT:${input.sourceId}` }, update: {}, create: {
      cashShiftId: shift.id, branchId: input.branchId, paymentId: input.paymentId,
      type: 'PAYMENT', amount: input.amount, reason: 'Thanh toán tiền mặt', actorId: input.actorId,
      idempotencyKey: `CASH:PAYMENT:${input.sourceId}`,
    } });
  }

  async recordCashRefund(tx: Prisma.TransactionClient, input: { branchId: string; refundRequestId: string; amount: number; actorId: string }) {
    const shift = await tx.cashShift.findFirst({ where: { branchId: input.branchId, status: 'OPEN', openKey: input.branchId } });
    if (!shift) throw new ConflictException('Cần mở ca tiền mặt trước khi hoàn tiền CASH');
    return tx.cashMovement.upsert({ where: { idempotencyKey: `CASH:REFUND:${input.refundRequestId}` }, update: {}, create: {
      cashShiftId: shift.id, branchId: input.branchId, refundRequestId: input.refundRequestId,
      type: 'REFUND', amount: input.amount, reason: 'Hoàn tiền mặt', actorId: input.actorId,
      idempotencyKey: `CASH:REFUND:${input.refundRequestId}`,
    } });
  }
}
