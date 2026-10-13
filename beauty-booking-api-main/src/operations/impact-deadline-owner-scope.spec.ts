import { Prisma } from '@prisma/client';
import { ImpactDeadlineWorker } from './impact-deadline.worker';
import { NotificationsService } from '../notifications/notifications.service';
import { resolveBusinessIdsForUser } from '../common/utils/multi-tenancy';

type Row = Record<string, any>;
const DEADLINE = new Date('2020-01-01T00:00:00.000Z');
const PRIVATE_REASON = 'Private personnel reason added after access was removed';

// Interpret the actual worker's query predicates rather than returning a
// preselected authorized recipient. Unknown predicates fail the harness.
function matches(row: Row | null, where: Row = {}): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (key === 'AND') return expected.every((part: Row) => matches(row, part));
    if (key === 'OR') return expected.some((part: Row) => matches(row, part));
    const actual = row?.[key];
    if (expected === null || typeof expected !== 'object' || expected instanceof Date) {
      return actual instanceof Date && expected instanceof Date
        ? actual.getTime() === expected.getTime() : actual === expected;
    }
    return Object.entries(expected).every(([operator, value]: [string, any]) => {
      if (operator === 'in') return value.includes(actual);
      if (operator === 'gt') return actual != null && actual > value;
      if (operator === 'lte') return actual != null && actual <= value;
      if (operator === 'is') return matches(actual, value);
      if (actual && typeof actual === 'object') return matches(actual, { [operator]: value });
      throw new Error(`Unsupported harness predicate: ${key}.${operator}`);
    });
  });
}

function fixture(options: {
  beforeTransaction?: (state: Row) => void;
  conflictAfterWrite?: (state: Row) => void;
  outboxFault?: Error;
} = {}) {
  let committed: Row = {
    impact: { id: 'impact', businessId: 'business', ownerId: 'old-owner',
      subjectType: 'STAFF', action: 'OFFBOARD', reason: PRIVATE_REASON,
      status: 'IN_PROGRESS', deadlineAt: DEADLINE },
    business: { id: 'business', ownerId: 'owner-profile-old-owner', deletedAt: null,
      owner: { userId: 'old-owner' } },
    users: [{ id: 'old-owner', isActive: true, deletedAt: null },
      { id: 'new-owner', isActive: true, deletedAt: null }],
    grants: [{ userId: 'old-owner', businessId: 'business', branchId: null,
      role: { code: 'BUSINESS_OWNER' }, expiresAt: null }],
    outbox: [],
  };
  const reads: { model: string; inTransaction: boolean }[] = [];
  let conflicts = 0;
  const reader = (model: string, rows: () => Row[], inTransaction: boolean) => {
    const findMany = jest.fn(async ({ where = {}, orderBy, take }: Row = {}) => {
      reads.push({ model, inTransaction });
      let result = rows().filter(row => matches(row, where));
      if (orderBy?.deadlineAt === 'asc') result.sort((a, b) => +a.deadlineAt - +b.deadlineAt);
      if (take != null) result = result.slice(0, take);
      return structuredClone(result);
    });
    const findFirst = jest.fn(async (args: Row) => (await findMany(args))[0] ?? null);
    return { findMany, findFirst, findUnique: findFirst };
  };
  const client = (state: Row, inTransaction: boolean) => ({
    operationalImpactCase: reader('case', () => [state.impact], inTransaction),
    business: reader('business', () => [state.business], inTransaction),
    userRole: reader('grant', () => state.grants.map((grant: Row) => ({
      ...grant, user: state.users.find((user: Row) => user.id === grant.userId),
    })), inTransaction),
    notificationOutbox: { ...reader('outbox', () => state.outbox, inTransaction),
      createMany: jest.fn(async ({ data, skipDuplicates }: Row) => {
      if (options.outboxFault) throw options.outboxFault;
      let count = 0;
      for (const notice of data) {
        if (skipDuplicates && state.outbox.some((row: Row) => row.dedupeKey === notice.dedupeKey)) continue;
        state.outbox.push(structuredClone(notice));
        count++;
      }
      return { count };
    }) },
  });
  const prisma = {
    ...client(committed, false),
    $transaction: jest.fn(async (operation: (tx: any) => Promise<any>) => {
      options.beforeTransaction?.(committed);
      const pending = structuredClone(committed);
      const result = await operation(client(pending, true));
      if (options.conflictAfterWrite && conflicts++ === 0) {
        options.conflictAfterWrite(committed);
        throw new Prisma.PrismaClientKnownRequestError('Simulated serialization failure', {
          code: 'P2034', clientVersion: 'unit-test',
        });
      }
      // Commit only notification intent; history and case ownership are read-only.
      committed.outbox.splice(0, committed.outbox.length, ...pending.outbox);
      return result;
    }),
  };
  return { prisma, reads, state: () => committed,
    worker: new ImpactDeadlineWorker(prisma as never) };
}

function transfer(state: Row) {
  state.business.ownerId = 'owner-profile-new-owner';
  state.business.owner.userId = 'new-owner';
  state.grants = [{ userId: 'new-owner', businessId: 'business', branchId: null,
    role: { code: 'BUSINESS_OWNER' }, expiresAt: null }];
}

describe('ImpactDeadlineWorker current owner privacy', () => {
  it('warns the authorized current owner once across scans and worker instances', async () => {
    const f = fixture();
    await expect(f.worker.enqueueOverdueWarnings()).resolves.toEqual({ queued: 1 });
    await expect(f.worker.enqueueOverdueWarnings()).resolves.toEqual({ queued: 0 });
    await expect(new ImpactDeadlineWorker(f.prisma as never).enqueueOverdueWarnings()).resolves.toEqual({ queued: 0 });
    expect(f.state().outbox).toEqual([expect.objectContaining({
      userId: 'old-owner', severity: 'CRITICAL', targetType: 'OPERATIONAL_IMPACT',
      targetId: 'impact', body: `Chuyên viên — Ngừng làm việc: ${PRIVATE_REASON}`,
      actionUrl: '/salon/operations?impactCase=impact',
    })]);
  });

  it('excludes a transferred former owner whose current resolver denies case scope', async () => {
    const f = fixture();
    transfer(f.state());
    // Mirrors the ownership workflow: business/profile/grant change, case owner stays historical.
    const businessIds = await resolveBusinessIdsForUser(f.prisma as never, {
      id: 'old-owner', email: 'old@example.test', sessionType: 'salon', roles: [], scopes: [],
    });
    expect(businessIds).toEqual([]);
    await f.worker.enqueueOverdueWarnings();
    expect(f.state().outbox.filter((row: Row) => row.userId === 'old-owner')).toEqual([]);
    expect(f.state().outbox.map((row: Row) => row.userId)).toEqual(['new-owner']);
    expect(f.state().impact.ownerId).toBe('old-owner');
  });

  it.each([
    ['revoked role', (s: Row) => { s.grants = []; }],
    ['expired role', (s: Row) => { s.grants[0].expiresAt = new Date(0); }],
    ['inactive account', (s: Row) => { s.users[0].isActive = false; }],
    ['deleted account', (s: Row) => { s.users[0].deletedAt = new Date(0); }],
    ['owner role for another business', (s: Row) => { s.grants[0].businessId = 'other'; }],
    ['staff role', (s: Row) => { s.grants[0].role.code = 'STAFF'; }],
    ['receptionist role', (s: Row) => { s.grants[0].role.code = 'RECEPTIONIST'; }],
    ['legacy manager label', (s: Row) => { s.grants[0].role.code = 'MANAGER'; }],
  ])('does not expose a fresh reason after %s', async (_label, revoke) => {
    const f = fixture();
    revoke(f.state());
    await expect(f.worker.enqueueOverdueWarnings()).resolves.toEqual({ queued: 0 });
    expect(f.state().outbox).toEqual([]);
  });

  it('uses actual business ownership even when a stale former-owner grant remains', async () => {
    const f = fixture();
    const oldGrant = structuredClone(f.state().grants[0]);
    transfer(f.state());
    f.state().grants.push(oldGrant);
    await f.worker.enqueueOverdueWarnings();
    expect(f.state().outbox.map((row: Row) => row.userId)).toEqual(['new-owner']);
  });

  it('gives a new rightful owner their own warning without rewriting the historical notice', async () => {
    const f = fixture();
    await f.worker.enqueueOverdueWarnings();
    const historical = structuredClone(f.state().outbox[0]);
    transfer(f.state());
    f.state().impact.reason = 'Fresh reason after transfer';
    await expect(f.worker.enqueueOverdueWarnings()).resolves.toEqual({ queued: 1 });
    await expect(f.worker.enqueueOverdueWarnings()).resolves.toEqual({ queued: 0 });
    expect(f.state().outbox[0]).toEqual(historical);
    expect(f.state().outbox[1]).toEqual(expect.objectContaining({
      userId: 'new-owner', body: 'Chuyên viên — Ngừng làm việc: Fresh reason after transfer',
    }));
    expect(f.state().outbox[1].dedupeKey).not.toBe(historical.dedupeKey);
  });

  it('does not replay a legacy warning already queued for the same current owner', async () => {
    const f = fixture();
    const historical = { userId: 'old-owner', body: 'Original historical reason',
      dedupeKey: `impact-overdue:impact:${DEADLINE.toISOString()}` };
    f.state().outbox.push(structuredClone(historical));
    await expect(f.worker.enqueueOverdueWarnings()).resolves.toEqual({ queued: 0 });
    expect(f.state().outbox).toEqual([historical]);
  });

  it('does not let a legacy former-owner warning suppress the new owner', async () => {
    const f = fixture();
    const historical = { userId: 'old-owner', body: 'Original historical reason',
      dedupeKey: `impact-overdue:impact:${DEADLINE.toISOString()}` };
    f.state().outbox.push(structuredClone(historical));
    transfer(f.state());
    await expect(f.worker.enqueueOverdueWarnings()).resolves.toEqual({ queued: 1 });
    expect(f.state().outbox[0]).toEqual(historical);
    expect(f.state().outbox[1].userId).toBe('new-owner');
  });

  it('preserves business-scoped owner access accepted by the current resolver', async () => {
    const f = fixture();
    f.state().grants[0].branchId = 'branch';
    f.state().grants[0].expiresAt = new Date('9999-01-01');
    await expect(f.worker.enqueueOverdueWarnings()).resolves.toEqual({ queued: 1 });
  });

  it('preserves the verified onboarding owner fallback', async () => {
    const f = fixture();
    f.state().grants[0].businessId = null;
    await expect(f.worker.enqueueOverdueWarnings()).resolves.toEqual({ queued: 1 });
    expect(f.state().outbox[0].userId).toBe('old-owner');
  });

  it.each(['unscoped branch grant', 'deleted onboarding business'])(
    'does not invent access for %s', async (scenario) => {
      const f = fixture();
      f.state().grants[0].businessId = null;
      if (scenario === 'unscoped branch grant') f.state().grants[0].branchId = 'branch';
      else f.state().business.deletedAt = new Date(0);
      await expect(f.worker.enqueueOverdueWarnings()).resolves.toEqual({ queued: 0 });
    });

  it.each(['OPEN', 'IN_PROGRESS', 'READY_TO_COMPLETE'])('still warns for overdue %s', async (status) => {
    const f = fixture();
    f.state().impact.status = status;
    await expect(f.worker.enqueueOverdueWarnings()).resolves.toEqual({ queued: 1 });
  });

  it.each(['COMPLETED', 'CANCELLED', 'future deadline'])('does not warn for %s', async (scenario) => {
    const f = fixture();
    if (scenario === 'future deadline') f.state().impact.deadlineAt = new Date('9999-01-01');
    else f.state().impact.status = scenario;
    await expect(f.worker.enqueueOverdueWarnings()).resolves.toEqual({ queued: 0 });
    expect(f.state().outbox).toEqual([]);
  });

  it('reads current deadline, status, owner and grants within the enqueue transaction', async () => {
    const f = fixture({ beforeTransaction: transfer });
    await f.worker.enqueueOverdueWarnings();
    expect(f.state().outbox.map((row: Row) => row.userId)).toEqual(['new-owner']);
    expect(f.reads).toEqual(expect.arrayContaining([
      { model: 'case', inTransaction: true }, { model: 'business', inTransaction: true },
      { model: 'grant', inTransaction: true },
    ]));
    expect(f.reads.every(read => read.inTransaction)).toBe(true);
    expect(f.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'Serializable' }));
  });

  it('observes completion committed before enqueue', async () => {
    const f = fixture({ beforeTransaction: state => { state.impact.status = 'COMPLETED'; } });
    await expect(f.worker.enqueueOverdueWarnings()).resolves.toEqual({ queued: 0 });
  });

  it('uses the current deadline read at enqueue rather than a stale candidate', async () => {
    const f = fixture({ beforeTransaction: state => { state.impact.deadlineAt = new Date('9999-01-01'); } });
    await expect(f.worker.enqueueOverdueWarnings()).resolves.toEqual({ queued: 0 });
  });

  it.each(['transfer', 'completion'])('rereads scope/status after a serialization retry with %s', async (change) => {
    // Exercise the real retry helper while executing its short jitter callback
    // immediately; no worker lifecycle or live timer is started.
    const jitter = jest.spyOn(global, 'setTimeout').mockImplementation(((callback: () => void) => {
      callback();
      return {} as NodeJS.Timeout;
    }) as typeof setTimeout);
    try {
      const f = fixture({ conflictAfterWrite: state => {
        if (change === 'transfer') transfer(state);
        else state.impact.status = 'COMPLETED';
      } });
      await expect(f.worker.enqueueOverdueWarnings()).resolves.toEqual({ queued: change === 'transfer' ? 1 : 0 });
      expect(f.prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(f.state().outbox.map((row: Row) => row.userId)).toEqual(change === 'transfer' ? ['new-owner'] : []);
    } finally {
      jitter.mockRestore();
    }
  });

  it('rolls back failed enqueue and releases its running guard for recovery', async () => {
    const options = { outboxFault: new Error('Unit outbox write failed') as Error | undefined };
    const f = fixture(options);
    const logger = jest.spyOn((f.worker as any).logger, 'error').mockImplementation(() => undefined);
    try {
      await expect(f.worker.enqueueOverdueWarnings()).rejects.toThrow('Unit outbox write failed');
      expect(f.state().outbox).toEqual([]);
      options.outboxFault = undefined;
      await expect(f.worker.enqueueOverdueWarnings()).resolves.toEqual({ queued: 1 });
    } finally {
      logger.mockRestore();
    }
  });

  it('keeps the authorized reason visible with human labels in ordinary notification presentation', async () => {
    const f = fixture();
    await f.worker.enqueueOverdueWarnings();
    const stored = { id: 'notice', ...f.state().outbox[0] };
    const prisma = { notification: { findMany: jest.fn().mockResolvedValue([stored]), count: jest.fn().mockResolvedValue(1) } };
    const shown = await new NotificationsService(prisma as never).findByUser('old-owner');
    expect(shown.data[0].body).toBe(`Chuyên viên — Ngừng làm việc: ${PRIVATE_REASON}`);
    expect(stored.body).toBe(shown.data[0].body);
  });
});
