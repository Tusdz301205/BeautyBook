import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { withSerializableTransaction } from '../common/utils/serializable-transaction';

type Tx = Prisma.TransactionClient;

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  async configureRule(businessId: string, actorId: string, input: {
    branchId?: string; earnPointsPerAmount: number; earnAmountUnit: number;
    redemptionValuePerPoint: number; expiresAfterDays?: number; validFrom?: string;
  }) {
    if (!Number.isInteger(input.earnPointsPerAmount) || input.earnPointsPerAmount <= 0 || input.earnAmountUnit <= 0 || input.redemptionValuePerPoint <= 0) {
      throw new BadRequestException('Cấu hình tích điểm không hợp lệ');
    }
    return withSerializableTransaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM businesses WHERE id = ${businessId} FOR UPDATE`;
      const latest = await tx.loyaltyRule.findFirst({ where: { businessId, branchId: input.branchId ?? null }, orderBy: { version: 'desc' } });
      if (latest?.active) await tx.loyaltyRule.update({ where: { id: latest.id }, data: { active: false, validTo: new Date() } });
      return tx.loyaltyRule.create({ data: {
        businessId, branchId: input.branchId, version: (latest?.version ?? 0) + 1,
        earnPointsPerAmount: input.earnPointsPerAmount,
        earnAmountUnit: input.earnAmountUnit,
        redemptionValuePerPoint: input.redemptionValuePerPoint,
        expiresAfterDays: input.expiresAfterDays,
        validFrom: input.validFrom ? new Date(input.validFrom) : new Date(),
        createdBy: actorId,
      } });
    }, { conflictMessage: 'Cấu hình tích điểm vừa thay đổi' });
  }

  async listCustomer(customerId: string) {
    await this.expireDue(customerId);
    const accounts = await this.prisma.loyaltyAccount.findMany({ where: { customerId }, orderBy: { updatedAt: 'desc' } });
    const businesses = await this.prisma.business.findMany({ where: { id: { in: accounts.map((account) => account.businessId) } }, select: { id: true, name: true } });
    const names = new Map(businesses.map((business) => [business.id, business.name]));
    return Promise.all(accounts.map(async (account) => {
      const transactions = await this.prisma.loyaltyTransaction.findMany({ where: { accountId: account.id }, orderBy: { createdAt: 'desc' }, take: 100 });
      const expiringPoints = transactions.filter((row) => row.type === 'EARN' && row.expiresAt && row.expiresAt > new Date() && row.expiresAt <= new Date(Date.now() + 30 * 86400000)).reduce((sum, row) => sum + Math.max(0, row.points), 0);
      return { ...account, businessName: names.get(account.businessId), expiringPoints, transactions };
    }));
  }

  async previewRedemption(customerId: string, branchId: string, requestedPoints: number, amountAfterDiscounts: number) {
    if (!Number.isInteger(requestedPoints) || requestedPoints < 0) throw new BadRequestException('Số điểm không hợp lệ');
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId }, select: { businessId: true } });
    if (!branch) throw new NotFoundException('Chi nhánh không tồn tại');
    await this.expireDue(customerId, branch.businessId);
    const [account, rule] = await Promise.all([
      this.prisma.loyaltyAccount.findUnique({ where: { businessId_customerId: { businessId: branch.businessId, customerId } } }),
      this.activeRule(branch.businessId, branchId),
    ]);
    if (!rule || requestedPoints === 0) return { businessId: branch.businessId, points: 0, discount: 0, rule: null };
    if (!account || account.balance < requestedPoints) throw new ConflictException('Số dư điểm không đủ');
    const maxPoints = Math.floor(amountAfterDiscounts / Number(rule.redemptionValuePerPoint));
    const points = Math.min(requestedPoints, maxPoints);
    return {
      businessId: branch.businessId,
      points,
      discount: Math.min(amountAfterDiscounts, points * Number(rule.redemptionValuePerPoint)),
      rule: { id: rule.id, version: rule.version, redemptionValuePerPoint: Number(rule.redemptionValuePerPoint) },
    };
  }

  async redeemInTransaction(tx: Tx, input: {
    businessId: string; customerId: string; bookingId: string; points: number;
    discount: number; actorId: string; rule: { id: string; version: number; redemptionValuePerPoint: number };
  }) {
    if (input.points <= 0) return null;
    const account = await tx.loyaltyAccount.upsert({
      where: { businessId_customerId: { businessId: input.businessId, customerId: input.customerId } },
      create: { businessId: input.businessId, customerId: input.customerId }, update: {},
    });
    await tx.$queryRaw`SELECT id FROM loyalty_accounts WHERE id = ${account.id} FOR UPDATE`;
    const claimed = await tx.loyaltyAccount.updateMany({
      where: { id: account.id, balance: { gte: input.points } },
      data: { balance: { decrement: input.points }, version: { increment: 1 } },
    });
    if (claimed.count !== 1) throw new ConflictException('Số dư điểm vừa thay đổi');
    const current = await tx.loyaltyAccount.findUniqueOrThrow({ where: { id: account.id } });
    const transaction = await tx.loyaltyTransaction.create({ data: {
      accountId: account.id, businessId: input.businessId, customerId: input.customerId,
      bookingId: input.bookingId, type: 'REDEEM', points: -input.points, balanceAfter: current.balance,
      idempotencyKey: `LOYALTY:REDEEM:${input.bookingId}`,
      ruleSnapshot: input.rule as Prisma.InputJsonValue, reason: 'Đổi điểm khi đặt lịch', createdBy: input.actorId,
    } });
    await tx.priceAdjustment.create({ data: {
      bookingId: input.bookingId,
      branchId: (await tx.booking.findUniqueOrThrow({ where: { id: input.bookingId }, select: { branchId: true } })).branchId,
      customerId: input.customerId, type: 'LOYALTY', sourceId: transaction.id,
      label: `Đổi ${input.points} điểm`, amount: -input.discount,
      ruleSnapshot: input.rule as Prisma.InputJsonValue, status: 'APPLIED', appliedAt: new Date(),
    } });
    return transaction;
  }

  async earnForBooking(bookingId: string, actorId?: string) {
    return withSerializableTransaction(this.prisma, async (tx) => {
      const existing = await tx.loyaltyTransaction.findUnique({ where: { idempotencyKey: `LOYALTY:EARN:${bookingId}` } });
      if (existing) return existing;
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          branch: { select: { businessId: true } },
          paymentTransactions: true,
          payments: { include: { transactions: true, refundRequests: { where: { status: 'REFUNDED' } } } },
        },
      });
      if (!booking || booking.status !== 'COMPLETED') return null;
      const rule = await this.activeRule(booking.branch.businessId, booking.branchId, tx);
      if (!rule) return null;
      const verified = booking.paymentTransactions.filter((row) => row.status === 'VERIFIED').reduce((sum, row) => sum + Number(row.amount), 0);
      const reversed = booking.paymentTransactions.filter((row) => row.status === 'REVERSED').reduce((sum, row) => sum + Number(row.amount), 0);
      const legacy = booking.payments.filter((payment) => payment.transactions.length === 0 && ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status)).reduce((sum, payment) => sum + Number(payment.amount), 0);
      const refunds = booking.payments.flatMap((payment) => payment.refundRequests).reduce((sum, refund) => sum + Number(refund.amount), 0);
      const validAmount = Math.max(0, Math.min(Number(booking.finalAmount ?? booking.totalAmount), verified - reversed + legacy - refunds));
      const points = Math.floor(validAmount / Number(rule.earnAmountUnit)) * rule.earnPointsPerAmount;
      if (points <= 0) return null;
      const account = await tx.loyaltyAccount.upsert({
        where: { businessId_customerId: { businessId: booking.branch.businessId, customerId: booking.customerId } },
        create: { businessId: booking.branch.businessId, customerId: booking.customerId }, update: {},
      });
      await tx.$queryRaw`SELECT id FROM loyalty_accounts WHERE id = ${account.id} FOR UPDATE`;
      const updated = await tx.loyaltyAccount.update({ where: { id: account.id }, data: { balance: { increment: points }, version: { increment: 1 } } });
      return tx.loyaltyTransaction.create({ data: {
        accountId: account.id, businessId: booking.branch.businessId, customerId: booking.customerId,
        bookingId, type: 'EARN', points, balanceAfter: updated.balance,
        idempotencyKey: `LOYALTY:EARN:${bookingId}`,
        ruleSnapshot: { ruleId: rule.id, version: rule.version, validAmount, earnAmountUnit: Number(rule.earnAmountUnit), earnPointsPerAmount: rule.earnPointsPerAmount } as Prisma.InputJsonValue,
        expiresAt: rule.expiresAfterDays ? new Date(Date.now() + rule.expiresAfterDays * 86400000) : null,
        createdBy: actorId,
      } });
    }, { conflictMessage: 'Điểm thưởng vừa được cập nhật bởi giao dịch khác' });
  }

  async reverseRedemptionForBooking(tx: Tx, bookingId: string, actorId?: string) {
    const redemption = await tx.loyaltyTransaction.findFirst({ where: { bookingId, type: 'REDEEM' } });
    if (!redemption) return;
    const key = `LOYALTY:REVERSE:REDEEM:${bookingId}`;
    if (await tx.loyaltyTransaction.findUnique({ where: { idempotencyKey: key } })) return;
    await tx.$queryRaw`SELECT id FROM loyalty_accounts WHERE id = ${redemption.accountId} FOR UPDATE`;
    const points = Math.abs(redemption.points);
    const account = await tx.loyaltyAccount.update({ where: { id: redemption.accountId }, data: { balance: { increment: points }, version: { increment: 1 } } });
    await tx.loyaltyTransaction.create({ data: {
      accountId: account.id, businessId: redemption.businessId, customerId: redemption.customerId,
      bookingId, type: 'REVERSE', points, balanceAfter: account.balance,
      idempotencyKey: key, reversalOfId: redemption.id, reason: 'Hoàn điểm do lịch bị hủy', createdBy: actorId,
    } });
  }

  async adjustForRefund(bookingId: string, refundId: string, refundAmount: number, actorId?: string, transaction?: Tx) {
    const work = async (tx: Tx) => {
      const earn = await tx.loyaltyTransaction.findFirst({ where: { bookingId, type: 'EARN' } });
      if (!earn) return null;
      const key = `LOYALTY:REFUND:${refundId}`;
      const existing = await tx.loyaltyTransaction.findUnique({ where: { idempotencyKey: key } });
      if (existing) return existing;
      const snapshot = earn.ruleSnapshot as any;
      const points = Math.min(earn.points, Math.floor(refundAmount / Number(snapshot?.earnAmountUnit || 1)) * Number(snapshot?.earnPointsPerAmount || 0));
      if (points <= 0) return null;
      await tx.$queryRaw`SELECT id FROM loyalty_accounts WHERE id = ${earn.accountId} FOR UPDATE`;
      const account = await tx.loyaltyAccount.findUniqueOrThrow({ where: { id: earn.accountId } });
      const deduction = Math.min(account.balance, points);
      const updated = await tx.loyaltyAccount.update({ where: { id: account.id }, data: { balance: { decrement: deduction }, version: { increment: 1 } } });
      return tx.loyaltyTransaction.create({ data: {
        accountId: account.id, businessId: earn.businessId, customerId: earn.customerId, bookingId,
        refundRequestId: refundId, type: 'REFUND_ADJUSTMENT', points: -deduction,
        balanceAfter: updated.balance, idempotencyKey: key, reversalOfId: earn.id,
        reason: deduction < points ? 'Refund adjustment; số điểm đã dùng trước khi hoàn' : 'Điều chỉnh điểm do hoàn tiền', createdBy: actorId,
      } });
    };
    return transaction
      ? work(transaction)
      : withSerializableTransaction(this.prisma, work, { conflictMessage: 'Số dư điểm vừa thay đổi' });
  }

  async expireDue(customerId?: string, businessId?: string) {
    const accounts = await this.prisma.loyaltyAccount.findMany({ where: { customerId, businessId } });
    for (const account of accounts) {
      await withSerializableTransaction(this.prisma, async (tx) => {
        await tx.$queryRaw`SELECT id FROM loyalty_accounts WHERE id = ${account.id} FOR UPDATE`;
        const earns = await tx.loyaltyTransaction.findMany({ where: { accountId: account.id, type: 'EARN' }, orderBy: { createdAt: 'asc' } });
        const negatives = await tx.loyaltyTransaction.findMany({ where: { accountId: account.id, points: { lt: 0 } }, orderBy: { createdAt: 'asc' } });
        let consumed = negatives.reduce((sum, row) => sum + Math.abs(row.points), 0);
        for (const earn of earns) {
          const consumedHere = Math.min(consumed, earn.points);
          consumed -= consumedHere;
          const remaining = earn.points - consumedHere;
          if (remaining <= 0 || !earn.expiresAt || earn.expiresAt > new Date()) continue;
          const key = `LOYALTY:EXPIRE:${earn.id}`;
          if (await tx.loyaltyTransaction.findUnique({ where: { idempotencyKey: key } })) continue;
          const current = await tx.loyaltyAccount.findUniqueOrThrow({ where: { id: account.id } });
          const expiring = Math.min(current.balance, remaining);
          if (expiring <= 0) continue;
          const updated = await tx.loyaltyAccount.update({ where: { id: account.id }, data: { balance: { decrement: expiring }, version: { increment: 1 } } });
          await tx.loyaltyTransaction.create({ data: {
            accountId: account.id, businessId: account.businessId, customerId: account.customerId,
            type: 'EXPIRE', points: -expiring, balanceAfter: updated.balance,
            idempotencyKey: key, reversalOfId: earn.id, reason: 'Điểm hết hạn',
          } });
        }
      }, { conflictMessage: 'Số dư điểm vừa thay đổi' });
    }
  }

  private activeRule(businessId: string, branchId: string, db: PrismaService | Tx = this.prisma) {
    const now = new Date();
    return db.loyaltyRule.findFirst({
      where: {
        businessId,
        active: true,
        validFrom: { lte: now },
        AND: [
          { OR: [{ validTo: null }, { validTo: { gt: now } }] },
          { OR: [{ branchId }, { branchId: null }] },
        ],
      },
      orderBy: [{ branchId: 'desc' }, { version: 'desc' }],
    });
  }
}
