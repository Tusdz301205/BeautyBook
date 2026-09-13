import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SensitiveDataCipherService } from '../privacy/sensitive-data-cipher.service';
import { withSerializableTransaction } from '../common/utils/serializable-transaction';
import { auditLog } from '../common/utils/audit';

@Injectable()
export class OwnershipService {
  constructor(private readonly prisma: PrismaService, private readonly cipher: SensitiveDataCipherService) {}

  async create(businessId: string, requesterId: string, input: {
    newOwnerEmail: string; effectiveAt: string; reason: string; settlementAgreement?: Record<string, unknown>;
  }) {
    if (!input.reason?.trim()) throw new BadRequestException('Lý do chuyển giao là bắt buộc');
    const effectiveAt = new Date(input.effectiveAt);
    if (!Number.isFinite(effectiveAt.getTime()) || effectiveAt <= new Date()) throw new BadRequestException('Ngày hiệu lực phải ở tương lai');
    const business = await this.prisma.business.findUnique({ where: { id: businessId }, include: { owner: true } });
    if (!business) throw new NotFoundException('Doanh nghiệp không tồn tại');
    if (business.owner.userId !== requesterId) throw new ForbiddenException('Chỉ chủ hiện tại được tạo yêu cầu chuyển giao');
    const newOwner = await this.prisma.user.findUnique({ where: { email: input.newOwnerEmail.trim().toLowerCase() }, select: { id: true, email: true, fullName: true, isActive: true } });
    if (!newOwner?.isActive) throw new BadRequestException('Chủ mới cần có tài khoản đang hoạt động');
    if (newOwner.id === requesterId) throw new BadRequestException('Chủ mới phải khác chủ hiện tại');
    const duplicate = await this.prisma.ownershipTransfer.findFirst({ where: { businessId, status: { in: ['DRAFT', 'PENDING_NEW_OWNER_ACCEPTANCE', 'UNDER_REVIEW', 'NEED_MORE_INFO', 'APPROVED', 'SCHEDULED', 'EXECUTING'] } } });
    if (duplicate) throw new ConflictException('Doanh nghiệp đang có yêu cầu chuyển giao chưa kết thúc');
    const impact = await this.impactPreview(businessId, effectiveAt);
    const transfer = await this.prisma.ownershipTransfer.create({ data: {
      businessId, oldOwnerId: business.ownerId, newOwnerUserId: newOwner.id,
      status: 'PENDING_NEW_OWNER_ACCEPTANCE', effectiveAt, reason: input.reason.trim(),
      scopeSnapshot: { branches: impact.branches, ownerUserId: requesterId, newOwner: { id: newOwner.id, email: newOwner.email, name: newOwner.fullName } } as Prisma.InputJsonValue,
      settlementAgreement: input.settlementAgreement as Prisma.InputJsonValue | undefined,
      impactSnapshot: impact as Prisma.InputJsonValue,
      requestedBy: requesterId,
    } });
    await Promise.all([
      auditLog(this.prisma, {
        userId: requesterId, action: 'CREATE', entityType: 'OwnershipTransfer', entityId: transfer.id,
        newData: { businessId, status: transfer.status, effectiveAt, newOwnerUserId: newOwner.id }, reason: input.reason.trim(),
      }),
      this.prisma.notification.create({ data: {
        userId: newOwner.id, type: 'SYSTEM', severity: 'WARNING', title: 'Yêu cầu xác nhận chuyển quyền sở hữu',
        body: `Bạn được đề nghị tiếp nhận ${business.name}. Hãy xem tác động trước khi xác nhận.`,
        targetType: 'OWNERSHIP_TRANSFER', targetId: transfer.id, actionUrl: '/customer/benefits?tab=ownership',
      } }),
    ]);
    return transfer;
  }

  async accept(transferId: string, userId: string) {
    const changed = await this.prisma.ownershipTransfer.updateMany({
      where: { id: transferId, newOwnerUserId: userId, status: 'PENDING_NEW_OWNER_ACCEPTANCE' },
      data: { status: 'UNDER_REVIEW', acceptedByNewOwnerAt: new Date() },
    });
    if (changed.count !== 1) throw new ConflictException('Yêu cầu không còn chờ chủ mới xác nhận');
    const transfer = await this.prisma.ownershipTransfer.findUnique({ where: { id: transferId } });
    if (transfer) await auditLog(this.prisma, {
      userId, action: 'STATUS_CHANGE', entityType: 'OwnershipTransfer', entityId: transferId,
      oldData: { status: 'PENDING_NEW_OWNER_ACCEPTANCE' }, newData: { status: transfer.status }, reason: 'Chủ mới xác nhận tiếp nhận',
    });
    return transfer;
  }

  async review(transferId: string, actorId: string, input: { approve: boolean; needMoreInfo?: boolean; reason: string }) {
    if (!input.reason?.trim()) throw new BadRequestException('Kết luận xác minh là bắt buộc');
    const transfer = await this.prisma.ownershipTransfer.findUnique({ where: { id: transferId } });
    if (!transfer || !['UNDER_REVIEW', 'NEED_MORE_INFO'].includes(transfer.status)) throw new ConflictException('Yêu cầu không ở trạng thái xét duyệt');
    if (transfer.status === 'NEED_MORE_INFO' && input.approve && !input.needMoreInfo) {
      throw new ConflictException('Chủ hiện tại phải gửi lại hồ sơ bổ sung trước khi duyệt');
    }
    let legalEntityVersionId: string | null = transfer.legalEntityVersionId;
    let payoutAccountVersionId: string | null = transfer.payoutAccountVersionId;
    if (input.approve && !input.needMoreInfo) {
      const [legal, payout] = await Promise.all([
        this.prisma.legalEntityVersion.findFirst({ where: { businessId: transfer.businessId, verificationStatus: 'VERIFIED' }, orderBy: { version: 'desc' } }),
        this.prisma.payoutAccountVersion.findFirst({ where: { businessId: transfer.businessId, verificationStatus: 'VERIFIED' }, orderBy: { version: 'desc' } }),
      ]);
      if (!legal || !payout) throw new ConflictException('Cần xác minh phiên bản pháp nhân và tài khoản nhận tiền trước khi duyệt chuyển chủ');
      legalEntityVersionId = legal.id;
      payoutAccountVersionId = payout.id;
    }
    const nextStatus = input.needMoreInfo ? 'NEED_MORE_INFO' : input.approve ? (transfer.effectiveAt <= new Date() ? 'APPROVED' : 'SCHEDULED') : 'REJECTED';
    const updated = await this.prisma.ownershipTransfer.update({ where: { id: transferId }, data: {
      status: nextStatus,
      approvedBy: actorId,
      approvedAt: input.approve && !input.needMoreInfo ? new Date() : null,
      failureReason: input.approve && !input.needMoreInfo ? null : input.reason.trim(),
      legalEntityVersionId,
      payoutAccountVersionId,
    } });
    await auditLog(this.prisma, {
      userId: actorId, action: 'STATUS_CHANGE', entityType: 'OwnershipTransfer', entityId: transferId,
      oldData: { status: transfer.status }, newData: { status: updated.status }, reason: input.reason.trim(),
    });
    await this.notifyTransferParties(updated, input.needMoreInfo ? 'Hồ sơ chuyển chủ cần bổ sung' : input.approve ? 'Yêu cầu chuyển chủ đã được duyệt' : 'Yêu cầu chuyển chủ bị từ chối', input.reason.trim());
    return updated;
  }

  async submitMoreInfo(transferId: string, actorId: string, input: { note: string; settlementAgreement?: Record<string, unknown> }) {
    if (!input.note?.trim()) throw new BadRequestException('Nội dung bổ sung là bắt buộc');
    const transfer = await this.prisma.ownershipTransfer.findUnique({ where: { id: transferId } });
    if (!transfer || transfer.requestedBy !== actorId || transfer.status !== 'NEED_MORE_INFO') {
      throw new ConflictException('Yêu cầu không ở trạng thái cần bổ sung hoặc không thuộc người gửi');
    }
    const updated = await this.prisma.ownershipTransfer.update({ where: { id: transferId }, data: {
      status: 'UNDER_REVIEW',
      failureReason: null,
      settlementAgreement: (input.settlementAgreement ?? transfer.settlementAgreement ?? { note: input.note.trim() }) as Prisma.InputJsonValue,
    } });
    await auditLog(this.prisma, {
      userId: actorId, action: 'STATUS_CHANGE', entityType: 'OwnershipTransfer', entityId: transferId,
      oldData: { status: transfer.status }, newData: { status: updated.status }, reason: input.note.trim(),
    });
    await this.notifyTransferParties(updated, 'Hồ sơ chuyển chủ đã được bổ sung', input.note.trim());
    return updated;
  }

  async cancel(transferId: string, actorId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Lý do hủy là bắt buộc');
    const transfer = await this.prisma.ownershipTransfer.findUnique({ where: { id: transferId } });
    if (!transfer || transfer.requestedBy !== actorId || !['PENDING_NEW_OWNER_ACCEPTANCE', 'UNDER_REVIEW', 'NEED_MORE_INFO', 'SCHEDULED'].includes(transfer.status)) throw new ConflictException('Yêu cầu không thể hủy');
    const updated = await this.prisma.ownershipTransfer.update({ where: { id: transferId }, data: { status: 'CANCELLED', failureReason: reason.trim() } });
    await auditLog(this.prisma, {
      userId: actorId, action: 'STATUS_CHANGE', entityType: 'OwnershipTransfer', entityId: transferId,
      oldData: { status: transfer.status }, newData: { status: 'CANCELLED' }, reason: reason.trim(),
    });
    await this.notifyTransferParties(updated, 'Yêu cầu chuyển chủ đã hủy', reason.trim());
    return updated;
  }

  async execute(transferId: string, actorId: string) {
    return withSerializableTransaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM ownership_transfers WHERE id = ${transferId} FOR UPDATE`;
      const transfer = await tx.ownershipTransfer.findUnique({ where: { id: transferId } });
      if (!transfer) throw new NotFoundException('Yêu cầu chuyển giao không tồn tại');
      if (transfer.status === 'COMPLETED') return transfer;
      if (!['APPROVED', 'SCHEDULED'].includes(transfer.status) || !transfer.approvedBy || !transfer.acceptedByNewOwnerAt) throw new ConflictException('Yêu cầu chưa đủ phê duyệt');
      if (transfer.effectiveAt > new Date()) throw new ConflictException('Chưa đến thời điểm chuyển giao');
      // Re-check financial liabilities at execution time, not only in the
      // earlier impact preview. The transfer and this check share the row
      // lock/serializable transaction so a pending obligation cannot slip in
      // between review and ownership mutation.
      const [pendingPayments, pendingRefunds] = await Promise.all([
        tx.paymentTransaction.count({
          where: { businessId: transfer.businessId, status: 'PENDING' },
        }),
        tx.refundRequest.count({
          where: {
            payment: { booking: { branch: { businessId: transfer.businessId } } },
            status: { in: ['PENDING', 'APPROVED', 'PROCESSING'] },
          },
        }),
      ]);
      if (pendingPayments || pendingRefunds) {
        throw new ConflictException(
          `Chưa thể chuyển giao khi còn ${pendingPayments} giao dịch chờ xác minh và ${pendingRefunds} yêu cầu hoàn tiền đang xử lý`,
        );
      }
      await tx.ownershipTransfer.update({ where: { id: transferId }, data: { status: 'EXECUTING' } });
      const business = await tx.business.findUniqueOrThrow({ where: { id: transfer.businessId }, include: { owner: true } });
      if (business.ownerId !== transfer.oldOwnerId) throw new ConflictException('Chủ doanh nghiệp đã thay đổi ngoài workflow');
      const newOwner = await tx.businessOwnerProfile.upsert({
        where: { userId: transfer.newOwnerUserId },
        create: { userId: transfer.newOwnerUserId }, update: {},
      });
      await tx.ownershipHistory.updateMany({ where: { businessId: business.id, validTo: null }, data: { validTo: transfer.effectiveAt } });
      if (!(await tx.ownershipHistory.findFirst({ where: { businessId: business.id, ownerId: business.ownerId } }))) {
        await tx.ownershipHistory.create({ data: { businessId: business.id, ownerId: business.ownerId, validFrom: business.createdAt, validTo: transfer.effectiveAt } });
      }
      await tx.ownershipHistory.create({ data: { businessId: business.id, ownerId: newOwner.id, transferId, validFrom: transfer.effectiveAt } });
      await tx.business.update({ where: { id: business.id }, data: { ownerId: newOwner.id } });
      const ownerRole = await tx.role.findUniqueOrThrow({ where: { code: 'BUSINESS_OWNER' } });
      await tx.userRole.deleteMany({ where: { userId: business.owner.userId, businessId: business.id, roleId: ownerRole.id } });
      const currentOwnerRole = await tx.userRole.findFirst({
        where: { userId: transfer.newOwnerUserId, roleId: ownerRole.id, businessId: business.id, branchId: null },
      });
      if (currentOwnerRole) {
        await tx.userRole.update({ where: { id: currentOwnerRole.id }, data: { expiresAt: null, grantedBy: actorId } });
      } else {
        await tx.userRole.create({
          data: { userId: transfer.newOwnerUserId, roleId: ownerRole.id, businessId: business.id, grantedBy: actorId },
        });
      }
      await tx.userSession.updateMany({ where: { userId: business.owner.userId, workspace: 'SALON', businessId: business.id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.userSession.updateMany({ where: { userId: transfer.newOwnerUserId, workspace: 'SALON', businessId: business.id, revokedAt: null }, data: { revokedAt: new Date() } });
      if (!transfer.legalEntityVersionId || !transfer.payoutAccountVersionId) throw new ConflictException('Thiếu phiên bản pháp nhân hoặc tài khoản nhận tiền đã xác minh');
      await tx.legalEntityVersion.updateMany({
        where: { businessId: business.id, isActive: true, id: { not: transfer.legalEntityVersionId } },
        data: { isActive: false, validTo: transfer.effectiveAt },
      });
      const legalActivated = await tx.legalEntityVersion.updateMany({
        where: { id: transfer.legalEntityVersionId, businessId: business.id, verificationStatus: 'VERIFIED' },
        data: { isActive: true, validFrom: transfer.effectiveAt, validTo: null },
      });
      await tx.payoutAccountVersion.updateMany({
        where: { businessId: business.id, isActive: true, id: { not: transfer.payoutAccountVersionId } },
        data: { isActive: false, validTo: transfer.effectiveAt },
      });
      const payoutActivated = await tx.payoutAccountVersion.updateMany({
        where: { id: transfer.payoutAccountVersionId, businessId: business.id, verificationStatus: 'VERIFIED' },
        data: { isActive: true, validFrom: transfer.effectiveAt, validTo: null },
      });
      if (legalActivated.count !== 1 || payoutActivated.count !== 1) throw new ConflictException('Phiên bản pháp nhân hoặc tài khoản nhận tiền chưa được xác minh');
      await tx.auditLog.create({ data: {
        userId: actorId, action: 'STATUS_CHANGE', entityType: 'BusinessOwnership', entityId: business.id,
        oldData: { ownerId: business.ownerId, ownerUserId: business.owner.userId },
        newData: { ownerId: newOwner.id, ownerUserId: transfer.newOwnerUserId, effectiveAt: transfer.effectiveAt },
        reason: transfer.reason,
      } });
      return tx.ownershipTransfer.update({ where: { id: transferId }, data: { status: 'COMPLETED', completedAt: new Date(), failureReason: null } });
    }, { conflictMessage: 'Yêu cầu chuyển giao vừa được xử lý' });
  }

  async list(businessId: string) {
    return this.prisma.ownershipTransfer.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' } });
  }

  async listIncoming(userId: string) {
    return this.prisma.ownershipTransfer.findMany({
      where: { newOwnerUserId: userId, status: { in: ['PENDING_NEW_OWNER_ACCEPTANCE', 'UNDER_REVIEW', 'NEED_MORE_INFO', 'APPROVED', 'SCHEDULED'] } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listPlatformQueue() {
    const transfers = await this.prisma.ownershipTransfer.findMany({
      where: { status: { in: ['UNDER_REVIEW', 'NEED_MORE_INFO', 'APPROVED', 'SCHEDULED', 'EXECUTION_FAILED'] } },
      orderBy: [{ effectiveAt: 'asc' }, { createdAt: 'asc' }],
    });
    const businessIds = [...new Set(transfers.map((transfer) => transfer.businessId))];
    const userIds = [...new Set(transfers.flatMap((transfer) => [transfer.newOwnerUserId, transfer.requestedBy]))];
    const [businesses, users, legalVersions, payoutVersions] = await Promise.all([
      this.prisma.business.findMany({ where: { id: { in: businessIds } }, select: { id: true, name: true } }),
      this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true, email: true } }),
      this.prisma.legalEntityVersion.findMany({ where: { businessId: { in: businessIds } }, orderBy: { version: 'desc' } }),
      this.prisma.payoutAccountVersion.findMany({ where: { businessId: { in: businessIds } }, select: {
        id: true, businessId: true, version: true, bankName: true, accountHolder: true, maskedAccountNumber: true,
        verificationStatus: true, isActive: true, validFrom: true, validTo: true, createdAt: true,
      }, orderBy: { version: 'desc' } }),
    ]);
    return transfers.map((transfer) => ({
      ...transfer,
      business: businesses.find((business) => business.id === transfer.businessId) ?? null,
      newOwner: users.find((user) => user.id === transfer.newOwnerUserId) ?? null,
      requester: users.find((user) => user.id === transfer.requestedBy) ?? null,
      legalEntityVersion: legalVersions.find((version) => version.id === transfer.legalEntityVersionId)
        ?? legalVersions.find((version) => version.businessId === transfer.businessId) ?? null,
      payoutAccountVersion: payoutVersions.find((version) => version.id === transfer.payoutAccountVersionId)
        ?? payoutVersions.find((version) => version.businessId === transfer.businessId) ?? null,
    }));
  }

  async executeDueTransfers() {
    const due = await this.prisma.ownershipTransfer.findMany({
      where: { status: { in: ['APPROVED', 'SCHEDULED'] }, effectiveAt: { lte: new Date() }, approvedBy: { not: null } },
      select: { id: true, approvedBy: true }, take: 20, orderBy: { effectiveAt: 'asc' },
    });
    for (const transfer of due) {
      try { await this.execute(transfer.id, transfer.approvedBy!); }
      catch (error) {
        await this.prisma.ownershipTransfer.updateMany({
          where: { id: transfer.id, status: { in: ['APPROVED', 'SCHEDULED'] } },
          data: { status: 'EXECUTION_FAILED', failureReason: error instanceof Error ? error.message.slice(0, 1000) : 'Lỗi thực thi không xác định' },
        });
      }
    }
    return due.length;
  }

  async createLegalVersion(businessId: string, actorId: string, input: any) {
    if (!input.legalName?.trim()) throw new BadRequestException('Tên pháp nhân là bắt buộc');
    return withSerializableTransaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM businesses WHERE id = ${businessId} FOR UPDATE`;
      const current = await tx.legalEntityVersion.findFirst({ where: { businessId }, orderBy: { version: 'desc' } });
      return tx.legalEntityVersion.create({ data: {
        businessId, version: (current?.version ?? 0) + 1, legalName: input.legalName.trim(),
        taxCode: input.taxCode?.trim(), registrationNumber: input.registrationNumber?.trim(), representativeName: input.representativeName?.trim(),
        verificationStatus: 'PENDING', validFrom: new Date(), createdBy: actorId,
      } });
    }, { conflictMessage: 'Thông tin pháp nhân vừa thay đổi' });
  }

  async createPayoutVersion(businessId: string, actorId: string, input: { bankName: string; accountHolder: string; accountNumber: string }) {
    if (!input.bankName?.trim() || !input.accountHolder?.trim() || !input.accountNumber?.trim()) throw new BadRequestException('Thông tin tài khoản nhận tiền chưa đủ');
    const encrypted = this.cipher.encrypt(input.accountNumber.trim(), 1024);
    const masked = `****${input.accountNumber.trim().slice(-4)}`;
    return withSerializableTransaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM businesses WHERE id = ${businessId} FOR UPDATE`;
      const current = await tx.payoutAccountVersion.findFirst({ where: { businessId }, orderBy: { version: 'desc' } });
      return tx.payoutAccountVersion.create({ data: {
        businessId, version: (current?.version ?? 0) + 1, bankName: input.bankName.trim(), accountHolder: input.accountHolder.trim(),
        accountNumberCiphertext: encrypted.valueCiphertext, accountNumberIv: encrypted.encryptionIv,
        authenticationTag: encrypted.authenticationTag, keyVersion: encrypted.keyVersion,
        maskedAccountNumber: masked, verificationStatus: 'PENDING', validFrom: new Date(), createdBy: actorId,
      } });
    }, { conflictMessage: 'Tài khoản nhận tiền vừa thay đổi' });
  }

  async versions(businessId: string) {
    const [legalEntities, payoutAccounts] = await Promise.all([
      this.prisma.legalEntityVersion.findMany({ where: { businessId }, orderBy: { version: 'desc' } }),
      this.prisma.payoutAccountVersion.findMany({ where: { businessId }, select: {
        id: true, businessId: true, version: true, bankName: true, accountHolder: true, maskedAccountNumber: true,
        verificationStatus: true, isActive: true, validFrom: true, validTo: true, createdBy: true, createdAt: true,
      }, orderBy: { version: 'desc' } }),
    ]);
    return { legalEntities, payoutAccounts };
  }

  async verifyVersion(type: 'LEGAL_ENTITY' | 'PAYOUT_ACCOUNT', id: string, actorId: string, input: { approve: boolean; reason: string }) {
    if (!input.reason?.trim()) throw new BadRequestException('Kết luận xác minh là bắt buộc');
    const model = type === 'LEGAL_ENTITY' ? this.prisma.legalEntityVersion : this.prisma.payoutAccountVersion;
    const current = await (model as any).findUnique({ where: { id } });
    if (!current || current.verificationStatus !== 'PENDING') throw new ConflictException('Phiên bản không còn chờ xác minh');
    const updated = await (model as any).update({
      where: { id },
      data: { verificationStatus: input.approve ? 'VERIFIED' : 'REJECTED' },
    });
    await auditLog(this.prisma, {
      userId: actorId,
      action: 'STATUS_CHANGE',
      entityType: type === 'LEGAL_ENTITY' ? 'LegalEntityVersion' : 'PayoutAccountVersion',
      entityId: id,
      oldData: { verificationStatus: current.verificationStatus },
      newData: { verificationStatus: updated.verificationStatus },
      reason: input.reason.trim(),
    });
    if (type === 'PAYOUT_ACCOUNT') {
      const { accountNumberCiphertext: _ciphertext, accountNumberIv: _iv, authenticationTag: _tag, ...safe } = updated;
      return safe;
    }
    return updated;
  }

  private async impactPreview(businessId: string, effectiveAt: Date) {
    const [branches, bookings, payments, refunds] = await Promise.all([
      this.prisma.branch.findMany({ where: { businessId, deletedAt: null }, select: { id: true, name: true, status: true, operationalStatus: true } }),
      this.prisma.booking.count({ where: { branch: { businessId }, appointmentDate: { gte: effectiveAt }, status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] }, deletedAt: null } }),
      this.prisma.paymentTransaction.count({ where: { businessId, status: 'PENDING' } }),
      this.prisma.refundRequest.count({ where: { payment: { booking: { branch: { businessId } } }, status: { in: ['PENDING', 'APPROVED', 'PROCESSING'] } } }),
    ]);
    return { branches, futureBookings: bookings, pendingPayments: payments, pendingRefunds: refunds, liabilitiesAndPayoutSplitMustBeConfirmed: payments > 0 || refunds > 0 };
  }

  private async notifyTransferParties(transfer: { id: string; newOwnerUserId: string; requestedBy: string }, title: string, body: string) {
    const recipients = [...new Set([transfer.newOwnerUserId, transfer.requestedBy])];
    await this.prisma.notification.createMany({ data: recipients.map((userId) => ({
      userId, type: 'SYSTEM' as const, severity: 'INFO' as const, title, body,
      targetType: 'OWNERSHIP_TRANSFER', targetId: transfer.id, actionUrl: '/customer/benefits?tab=ownership',
    })) });
  }
}
