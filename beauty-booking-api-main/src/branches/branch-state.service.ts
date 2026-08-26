import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BranchOperationalStatus, BranchReviewStatus, BranchStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { withSerializableTransaction } from '../common/utils/serializable-transaction';

export type BranchTransitionAction =
  | 'DRAFT' | 'SUBMIT' | 'REQUEST_INFO' | 'APPROVE' | 'PUBLISH'
  | 'PAUSE' | 'SUSPEND' | 'RESTORE' | 'CLOSE' | 'ARCHIVE' | 'REJECT';

@Injectable()
export class BranchStateService {
  constructor(private readonly prisma: PrismaService) {}

  canonicalState(branch: {
    status: BranchStatus;
    reviewStatus: BranchReviewStatus;
    operationalStatus: BranchOperationalStatus;
    deletedAt?: Date | null;
    business?: { status: string; bookingRestrictedAt?: Date | null; deletedAt?: Date | null };
  }) {
    const businessReady = !branch.business || (
      ['APPROVED', 'ACTIVE'].includes(branch.business.status) &&
      !branch.business.bookingRestrictedAt && !branch.business.deletedAt
    );
    const publicVisible = !branch.deletedAt && businessReady && branch.status === 'ACTIVE' &&
      branch.reviewStatus === 'APPROVED' && branch.operationalStatus === 'ACTIVE';
    return { publicVisible, bookable: publicVisible };
  }

  publicWhere(): Prisma.BranchWhereInput {
    return {
      deletedAt: null,
      status: 'ACTIVE',
      reviewStatus: 'APPROVED',
      operationalStatus: 'ACTIVE',
      business: { status: { in: ['APPROVED', 'ACTIVE'] }, bookingRestrictedAt: null, deletedAt: null },
    };
  }

  async transition(branchId: string, action: BranchTransitionAction, actorId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Lý do chuyển trạng thái là bắt buộc');
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, deletedAt: null },
      include: { business: { select: { id: true, status: true } } },
    });
    if (!branch) throw new NotFoundException('Chi nhánh không tồn tại');

    if (['PAUSE', 'SUSPEND', 'CLOSE', 'ARCHIVE'].includes(action)) {
      const completedImpact = await this.prisma.operationalImpactCase.findFirst({
        where: { subjectType: 'BRANCH', subjectId: branchId, action: action as any, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        select: { id: true },
      });
      const futureBookings = await this.prisma.booking.findMany({
        where: {
          branchId,
          deletedAt: null,
          status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] },
          appointmentDate: { gte: new Date(new Date().toISOString().slice(0, 10)) },
        },
        select: { id: true, finalAmount: true, voucherId: true, payments: { select: { amount: true, status: true } } },
      });
      if (futureBookings.length && !completedImpact) {
        const existing = await this.prisma.operationalImpactCase.findFirst({
          where: { subjectType: 'BRANCH', subjectId: branchId, action: action as any, status: { in: ['OPEN', 'IN_PROGRESS', 'READY_TO_COMPLETE'] } },
          select: { id: true, status: true },
        });
        if (existing) return { transitioned: false, requiresImpactResolution: true, impactCase: existing };
        const impact = await this.prisma.operationalImpactCase.create({
          data: {
            businessId: branch.businessId,
            branchId,
            subjectType: 'BRANCH',
            subjectId: branchId,
            action: action as any,
            reason: reason.trim(),
            ownerId: actorId,
            createdBy: actorId,
            deadlineAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          },
        });
        await this.prisma.operationalImpactItem.createMany({
          data: futureBookings.map((booking) => ({
            caseId: impact.id,
            bookingId: booking.id,
            financialSnapshot: {
              finalAmount: Number(booking.finalAmount ?? 0),
              voucherId: booking.voucherId,
              payments: booking.payments.map((payment) => ({ amount: Number(payment.amount), status: payment.status })),
            },
          })),
        });
        return { transitioned: false, requiresImpactResolution: true, impactCase: impact };
      }
    }

    return withSerializableTransaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM branches WHERE id = ${branchId} FOR UPDATE`;
      const current = await tx.branch.findUniqueOrThrow({ where: { id: branchId } });
      const target = this.target(current, action);
      if (['PAUSE', 'SUSPEND', 'CLOSE', 'ARCHIVE'].includes(action)) {
        const [activeBookingCount, completedImpact] = await Promise.all([
          tx.booking.count({ where: {
            branchId, deletedAt: null,
            status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] },
            appointmentDate: { gte: new Date(new Date().toISOString().slice(0, 10)) },
          } }),
          tx.operationalImpactCase.findFirst({
            where: { subjectType: 'BRANCH', subjectId: branchId, action: action as any, status: 'COMPLETED' },
            select: { id: true },
          }),
        ]);
        if (activeBookingCount > 0 && !completedImpact) {
          throw new ConflictException('Phát sinh lịch tương lai mới; cần tải lại và hoàn tất impact workflow');
        }
      }
      if (current.status === target.status && current.reviewStatus === target.reviewStatus && current.operationalStatus === target.operationalStatus) {
        return { transitioned: true, alreadyApplied: true, branch: current, canonical: this.canonicalState(current) };
      }
      const version = await tx.branchStateTransition.count({ where: { branchId } }) + 1;
      const updated = await tx.branch.update({
        where: { id: branchId },
        data: {
          status: target.status,
          reviewStatus: target.reviewStatus,
          operationalStatus: target.operationalStatus,
          reviewNote: ['REQUEST_INFO', 'REJECT', 'SUSPEND'].includes(action) ? reason.trim() : current.reviewNote,
          reviewedAt: ['APPROVE', 'REJECT', 'REQUEST_INFO'].includes(action) ? new Date() : current.reviewedAt,
          publishedAt: action === 'PUBLISH' ? new Date() : current.publishedAt,
        },
      });
      await tx.branchStateTransition.create({
        data: {
          branchId,
          actorId,
          fromStatus: current.status,
          toStatus: updated.status,
          fromReviewStatus: current.reviewStatus,
          toReviewStatus: updated.reviewStatus,
          fromOperationalStatus: current.operationalStatus,
          toOperationalStatus: updated.operationalStatus,
          reason: reason.trim(),
          version,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'STATUS_CHANGE',
          entityType: 'Branch',
          entityId: branchId,
          oldData: { status: current.status, reviewStatus: current.reviewStatus, operationalStatus: current.operationalStatus },
          newData: { status: updated.status, reviewStatus: updated.reviewStatus, operationalStatus: updated.operationalStatus },
          reason: reason.trim(),
        },
      });
      return { transitioned: true, branch: updated, canonical: this.canonicalState(updated) };
    }, { conflictMessage: 'Trạng thái chi nhánh vừa thay đổi; vui lòng tải lại' });
  }

  private target(branch: { status: BranchStatus; reviewStatus: BranchReviewStatus; operationalStatus: BranchOperationalStatus }, action: BranchTransitionAction) {
    const map: Record<BranchTransitionAction, { status: BranchStatus; reviewStatus: BranchReviewStatus; operationalStatus: BranchOperationalStatus }> = {
      DRAFT: { status: 'PENDING', reviewStatus: 'DRAFT', operationalStatus: 'INACTIVE' },
      SUBMIT: { status: 'PENDING', reviewStatus: 'PENDING_REVIEW', operationalStatus: 'INACTIVE' },
      REQUEST_INFO: { status: 'PENDING', reviewStatus: 'NEED_MORE_INFO', operationalStatus: 'INACTIVE' },
      APPROVE: { status: 'INACTIVE', reviewStatus: 'APPROVED', operationalStatus: 'READY_TO_PUBLISH' },
      PUBLISH: { status: 'ACTIVE', reviewStatus: 'APPROVED', operationalStatus: 'ACTIVE' },
      PAUSE: { status: 'INACTIVE', reviewStatus: branch.reviewStatus, operationalStatus: 'PAUSED' },
      SUSPEND: { status: 'INACTIVE', reviewStatus: branch.reviewStatus, operationalStatus: 'SUSPENDED' },
      RESTORE: { status: branch.reviewStatus === 'APPROVED' ? 'ACTIVE' : 'PENDING', reviewStatus: branch.reviewStatus, operationalStatus: branch.reviewStatus === 'APPROVED' ? 'ACTIVE' : 'INACTIVE' },
      CLOSE: { status: 'INACTIVE', reviewStatus: branch.reviewStatus, operationalStatus: 'CLOSED' },
      ARCHIVE: { status: 'INACTIVE', reviewStatus: branch.reviewStatus, operationalStatus: 'ARCHIVED' },
      REJECT: { status: 'PENDING', reviewStatus: 'REJECTED', operationalStatus: 'INACTIVE' },
    };
    const target = map[action];
    const allowed: Record<BranchTransitionAction, boolean> = {
      DRAFT: branch.reviewStatus === 'DRAFT' && branch.operationalStatus === 'INACTIVE',
      SUBMIT: ['DRAFT', 'NEED_MORE_INFO'].includes(branch.reviewStatus) && branch.operationalStatus === 'INACTIVE',
      REQUEST_INFO: branch.reviewStatus === 'PENDING_REVIEW',
      APPROVE: branch.reviewStatus === 'PENDING_REVIEW',
      PUBLISH: branch.reviewStatus === 'APPROVED' && branch.operationalStatus === 'READY_TO_PUBLISH',
      PAUSE: branch.reviewStatus === 'APPROVED' && branch.operationalStatus === 'ACTIVE',
      SUSPEND: !['CLOSED', 'ARCHIVED'].includes(branch.operationalStatus),
      RESTORE: ['PAUSED', 'SUSPENDED'].includes(branch.operationalStatus),
      CLOSE: !['CLOSED', 'ARCHIVED'].includes(branch.operationalStatus),
      ARCHIVE: ['CLOSED', 'INACTIVE'].includes(branch.operationalStatus),
      REJECT: ['PENDING_REVIEW', 'NEED_MORE_INFO'].includes(branch.reviewStatus),
    };
    if (!allowed[action]) throw new ConflictException(`Không thể ${action} từ trạng thái hiện tại`);
    if (action === 'RESTORE' && !['PAUSED', 'SUSPENDED'].includes(branch.operationalStatus)) throw new ConflictException('Chi nhánh không ở trạng thái có thể khôi phục');
    return target;
  }
}
