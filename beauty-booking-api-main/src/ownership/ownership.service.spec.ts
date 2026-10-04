import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { OwnershipService } from './ownership.service';

const transfer = {
  id: 'transfer-1', businessId: 'business-1', requestedBy: 'old-owner-user', newOwnerUserId: 'new-owner-user',
  status: 'UNDER_REVIEW', effectiveAt: new Date(Date.now() + 24 * 60 * 60 * 1000), legalEntityVersionId: null,
  payoutAccountVersionId: null, updatedAt: new Date('2026-09-01T00:00:00.000Z'),
};

function serviceWith(prisma: any) {
  return new OwnershipService(prisma as PrismaService, {} as any);
}

describe('Ownership command input boundaries', () => {
  test.each(['legalName', 'taxCode', 'registrationNumber', 'representativeName'])('numeric %s cannot create a legal version or cause a server error', async (field) => {
    await expect(serviceWith({}).createLegalVersion('business', 'owner', { legalName: 'QA legal', [field]: 42 })).rejects.toBeInstanceOf(BadRequestException);
  });
  test('payout creation stores encryption material but only returns masked account data', async () => {
    const row = { id: 'payout', maskedAccountNumber: '****1234', accountNumberCiphertext: 'cipher', accountNumberIv: 'iv', authenticationTag: 'tag' };
    const tx = { $queryRaw: jest.fn(), payoutAccountVersion: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(row) } };
    const prisma = { $transaction: jest.fn((work) => work(tx)) };
    const cipher = { encrypt: jest.fn().mockReturnValue({ valueCiphertext: 'cipher', encryptionIv: 'iv', authenticationTag: 'tag', keyVersion: 1 }) };
    const result = await new OwnershipService(prisma as never, cipher as never).createPayoutVersion('business', 'owner', { bankName: 'QA bank', accountHolder: 'QA owner', accountNumber: '001234' });
    expect(result).toEqual({ id: 'payout', maskedAccountNumber: '****1234' });
    expect(tx.payoutAccountVersion.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ accountNumberCiphertext: 'cipher' }) }));
  });
  test.each(['false', 0, null])('invalid approve value %j never reaches review or verification persistence', async (approve) => {
    const service = serviceWith({});
    await expect(service.review('transfer', 'admin', { approve, reason: 'Kiểm tra' } as never)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.verifyVersion('LEGAL_ENTITY', 'version', 'admin', { approve, reason: 'Kiểm tra' } as never)).rejects.toBeInstanceOf(BadRequestException);
  });
  test('a non-boolean request-more-info flag cannot change transfer status', async () => {
    await expect(serviceWith({}).review('transfer', 'admin', { approve: false, needMoreInfo: 'false', reason: 'Kiểm tra' } as never)).rejects.toBeInstanceOf(BadRequestException);
  });
  test('malformed owner email is rejected before lookup or mutation', async () => {
    await expect(serviceWith({}).create('business', 'owner', { newOwnerEmail: 123, effectiveAt: '2099-01-01', reason: 'Kiểm tra' } as never)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('OwnershipService verification workflow', () => {
  it('blocks approval until both legal entity and payout versions are verified', async () => {
    const prisma = {
      ownershipTransfer: { findUnique: jest.fn().mockResolvedValue(transfer), updateMany: jest.fn() },
      legalEntityVersion: { findFirst: jest.fn().mockResolvedValue({ id: 'legal-1' }) },
      payoutAccountVersion: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    await expect(serviceWith(prisma).review('transfer-1', 'platform-1', { approve: true, reason: 'Đã kiểm tra hồ sơ' }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(prisma.ownershipTransfer.updateMany).not.toHaveBeenCalled();
  });

  it('snapshots verified version ids when platform approves', async () => {
    const update = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      ownershipTransfer: { findUnique: jest.fn().mockResolvedValue(transfer), findUniqueOrThrow: jest.fn().mockResolvedValue({ ...transfer, status: 'SCHEDULED' }), updateMany: update },
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
    const update = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      ownershipTransfer: { findUnique: jest.fn().mockResolvedValue(dueTransfer), findUniqueOrThrow: jest.fn().mockResolvedValue({ ...dueTransfer, status: 'APPROVED' }), updateMany: update },
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
      ownershipTransfer: { findUnique: jest.fn().mockResolvedValue({ ...transfer, status: 'NEED_MORE_INFO' }), updateMany: jest.fn() },
    };
    await expect(serviceWith(prisma).submitMoreInfo('transfer-1', 'unrelated-owner', { note: 'Đã bổ sung' }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(prisma.ownershipTransfer.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a stale cancel after execution has changed the status', async () => {
    const prisma = {
      ownershipTransfer: {
        findUnique: jest.fn().mockResolvedValue({ ...transfer, status: 'SCHEDULED' }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn(),
      },
    };
    await expect(serviceWith(prisma).cancel('transfer-1', transfer.requestedBy, 'Hủy yêu cầu'))
      .rejects.toBeInstanceOf(ConflictException);
    expect(prisma.ownershipTransfer.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'transfer-1', requestedBy: transfer.requestedBy, status: 'SCHEDULED', updatedAt: transfer.updatedAt },
    }));
    expect(prisma.ownershipTransfer.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
