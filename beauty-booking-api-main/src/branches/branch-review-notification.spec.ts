import { BadRequestException, ConflictException } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { BranchStateService } from './branch-state.service';

function fixture(failOutbox = false) {
  const before = { id: 'branch', businessId: 'business', name: 'QA branch', status: 'PENDING', reviewStatus: 'PENDING_REVIEW', operationalStatus: 'INACTIVE', updatedAt: new Date('2026-10-01'), deletedAt: null, business: { status: 'APPROVED' }, reviewRequests: [{ id: 'request' }] };
  let persisted = { ...before }, committed = 0;
  const create = jest.fn(async (_args: unknown) => { if (failOutbox) throw new Error('QA outbox fault'); return { id: 'outbox' }; });
  const tx: any = {
    $queryRaw: jest.fn(), branch: { findUniqueOrThrow: jest.fn(async () => ({ ...persisted })), update: jest.fn(async ({ data }) => ({ ...persisted, ...data })) },
    branchStateTransition: { count: jest.fn().mockResolvedValue(0), create: jest.fn() }, auditLog: { create: jest.fn() },
    branchReviewRequest: { update: jest.fn() }, branchReviewEvent: { create: jest.fn().mockResolvedValue({ id: 'event' }) },
    branchDocument: { updateMany: jest.fn() }, userRole: { findMany: jest.fn().mockResolvedValue([{ userId: 'owner' }, { userId: 'owner' }]) },
    notificationOutbox: { create },
  };
  const prisma: any = { branch: { findFirst: jest.fn(async () => before) }, $transaction: jest.fn(async fn => {
    const answer = await fn(tx); persisted = { ...answer.branch }; committed++; return answer;
  }) };
  const service = new BranchesService(prisma, {} as never, new BranchStateService(prisma));
  return { service, tx, prisma, create, before, persisted: () => persisted, committed: () => committed };
}

describe('branch review transaction and owner result delivery', () => {
  test.each(['APPROVE', 'REQUEST_INFO', 'REJECT'] as const)('%s commits state/history/document result/outbox once', async decision => {
    const f = fixture();
    const result = await f.service.review('branch', decision, 'QA reason', 'admin');
    expect(result.reviewStatus).toBe(decision === 'APPROVE' ? 'APPROVED' : decision === 'REQUEST_INFO' ? 'NEED_MORE_INFO' : 'REJECTED');
    expect(f.committed()).toBe(1); expect(f.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(f.tx.branchReviewRequest.update).toHaveBeenCalledTimes(1);
    expect(f.tx.branchStateTransition.create).toHaveBeenCalledTimes(1);
    expect(f.create).toHaveBeenCalledTimes(1);
    expect(f.create.mock.calls[0][0]).toMatchObject({ data: { userId: 'owner', targetType: 'BRANCH', targetId: 'branch', actionUrl: '/salon/branches/branch/setup', dedupeKey: 'branch-review:event:owner' } });
    expect(f.tx.userRole.findMany.mock.calls[0][0].where).toMatchObject({ businessId: 'business', role: { code: 'BUSINESS_OWNER' }, user: { isActive: true, deletedAt: null } });
  });
  test('outbox failure leaves decision uncommitted rather than retaining an approved branch', async () => {
    const f = fixture(true);
    await expect(f.service.review('branch', 'APPROVE', 'QA reason', 'admin')).rejects.toThrow('QA outbox fault');
    expect(f.committed()).toBe(0); expect(f.persisted().reviewStatus).toBe('PENDING_REVIEW');
  });
  test('stale dossier snapshot cannot add review history or outbox', async () => {
    const f = fixture();
    f.tx.branch.findUniqueOrThrow.mockResolvedValue({ ...f.before, updatedAt: new Date('2026-10-02') });
    await expect(f.service.review('branch', 'APPROVE', 'QA reason', 'admin')).rejects.toBeInstanceOf(ConflictException);
    expect(f.committed()).toBe(0); expect(f.create).not.toHaveBeenCalled();
    expect(f.tx.branchReviewEvent.create).not.toHaveBeenCalled();
  });
  test.each([{ decision: 'INVALID', reason: 'QA' }, { decision: 'REQUEST_INFO', reason: '   ' }, { decision: 'REJECT', reason: 10 }])('invalid input is rejected before reads/mutations %j', async input => {
    const f = fixture();
    await expect(f.service.review('branch', input.decision as never, input.reason as never, 'admin')).rejects.toBeInstanceOf(BadRequestException);
    expect(f.prisma.branch.findFirst).not.toHaveBeenCalled(); expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });
});
