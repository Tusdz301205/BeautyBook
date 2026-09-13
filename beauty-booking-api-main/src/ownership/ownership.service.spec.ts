import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { OwnershipService } from './ownership.service';

const transfer = {
  id: 'transfer-1', businessId: 'business-1', requestedBy: 'old-owner-user', newOwnerUserId: 'new-owner-user',
  status: 'UNDER_REVIEW', effectiveAt: new Date(Date.now() + 24 * 60 * 60 * 1000), legalEntityVersionId: null,
  payoutAccountVersionId: null,
};

function serviceWith(prisma: any) {
  return new OwnershipService(prisma as PrismaService, {} as any);
}

describe('OwnershipService verification workflow', () => {
  it('blocks approval until both legal entity and payout versions are verified', async () => {
    const prisma = {
      ownershipTransfer: { findUnique: jest.fn().mockResolvedValue(transfer), update: jest.fn() },
      legalEntityVersion: { findFirst: jest.fn().mockResolvedValue({ id: 'legal-1' }) },
      payoutAccountVersion: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    await expect(serviceWith(prisma).review('transfer-1', 'platform-1', { approve: true, reason: 'Đã kiểm tra hồ sơ' }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(prisma.ownershipTransfer.update).not.toHaveBeenCalled();
  });

  it('snapshots verified version ids when platform approves', async () => {
    const update = jest.fn().mockImplementation(({ data }) => ({ ...transfer, ...data }));
    const prisma = {
      ownershipTransfer: { findUnique: jest.fn().mockResolvedValue(transfer), update },
      legalEntityVersion: { findFirst: jest.fn().mockResolvedValue({ id: 'legal-1' }) },
      payoutAccountVersion: { findFirst: jest.fn().mockResolvedValue({ id: 'payout-1' }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      notification: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    await serviceWith(prisma).review('transfer-1', 'platform-1', { approve: true, reason: 'Hai phiên bản đã xác minh' });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      legalEntityVersionId: 'legal-1', payoutAccountVersionId: 'payout-1', status: 'SCHEDULED',
    }) }));
  });

  it('marks a verified transfer due now as approved and ready to execute', async () => {
    const dueTransfer = { ...transfer, effectiveAt: new Date(Date.now() - 60_000) };
    const update = jest.fn().mockImplementation(({ data }) => ({ ...dueTransfer, ...data }));
    const prisma = {
      ownershipTransfer: { findUnique: jest.fn().mockResolvedValue(dueTransfer), update },
      legalEntityVersion: { findFirst: jest.fn().mockResolvedValue({ id: 'legal-1' }) },
      payoutAccountVersion: { findFirst: jest.fn().mockResolvedValue({ id: 'payout-1' }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      notification: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };

    await serviceWith(prisma).review('transfer-1', 'platform-1', { approve: true, reason: 'Đủ điều kiện thực thi' });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'APPROVED' }),
    }));
  });

  it('only lets the original requester resubmit a NEED_MORE_INFO case', async () => {
    const prisma = {
      ownershipTransfer: { findUnique: jest.fn().mockResolvedValue({ ...transfer, status: 'NEED_MORE_INFO' }), update: jest.fn() },
    };
    await expect(serviceWith(prisma).submitMoreInfo('transfer-1', 'unrelated-owner', { note: 'Đã bổ sung' }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(prisma.ownershipTransfer.update).not.toHaveBeenCalled();
  });
});
