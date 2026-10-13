import { ConflictException } from '@nestjs/common';
import { ImpactService } from './impact.service';
import { NotificationsService } from '../notifications/notifications.service';

const BOOKING = '72ad21bb-d811-4bfa-9c37-a2148f8487e9';
const BUSINESS = 'impact-business';
const BRANCH = 'source-branch';
const CUSTOMER = 'customer-user';
const CODE = 'PRIVATE-BOOKING-20261012';
const REASON = 'Customer confidential accommodation: private medical and family details.';
const NOW = new Date('2026-10-13T10:00:00Z');
type Row = Record<string, any>;

// Small Prisma-shaped data seam: predicates are evaluated against domain rows,
// rather than returning only authorized rows regardless of the query supplied.
// Unsupported operators fail explicitly as harness errors.
function matches(row: any, where: Row = {}): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    const clauses = Array.isArray(value) ? value : [value];
    if (key === 'AND') return clauses.every(clause => matches(row, clause));
    if (key === 'OR') return clauses.some(clause => matches(row, clause));
    if (key === 'NOT') return clauses.every(clause => !matches(row, clause));
    const actual = row?.[key];
    if (value === null || typeof value !== 'object' || value instanceof Date) {
      return actual instanceof Date && value instanceof Date
        ? actual.getTime() === value.getTime() : actual === value;
    }
    return Object.entries(value).every(([operator, operand]: [string, any]) => {
      switch (operator) {
        case 'in': return operand.includes(actual);
        case 'notIn': return !operand.includes(actual);
        case 'equals': return matches({ actual }, { actual: operand });
        case 'not': return !matches({ actual }, { actual: operand });
        case 'gt': return actual != null && actual > operand;
        case 'gte': return actual != null && actual >= operand;
        case 'lt': return actual != null && actual < operand;
        case 'lte': return actual != null && actual <= operand;
        case 'is': return matches(actual, operand);
        case 'isNot': return !matches(actual, operand);
        case 'some': return actual.some((entry: Row) => matches(entry, operand));
        default:
          if (actual && typeof actual === 'object') return matches(actual, { [operator]: operand });
          throw new Error(`Harness unsupported predicate: ${key}.${operator}`);
      }
    });
  });
}

function profile(id: string, branchId = BRANCH): Row {
  return { id, userId: `${id}-user`, branchId, status: 'ACTIVE', deletedAt: null,
    branch: { id: branchId, businessId: BUSINESS }, user: { isActive: true, deletedAt: null } };
}
function grant(p: Row, overrides: Row = {}): Row {
  return { id: `grant-${p.id}`, userId: p.userId, businessId: BUSINESS,
    branchId: p.branchId, role: { code: 'STAFF' }, expiresAt: null,
    user: { isActive: true, deletedAt: null }, ...overrides };
}

function fixture(options: {
  profiles?: Row[]; grants?: Row[]; replacement?: Row; duplicateItems?: boolean;
  initialStatus?: string; staleFinalClaim?: boolean; outboxFault?: Error;
  beforeFinalTx?: (profiles: Row[], grants: Row[]) => void;
} = {}) {
  const profiles = structuredClone(options.profiles ?? [profile('booked')]);
  if (options.replacement) profiles.push(structuredClone(options.replacement));
  const grants = structuredClone(options.grants ?? profiles.map(p => grant(p)));
  const bookingServices = (options.profiles ?? [profile('booked')]).map((p, index) => ({
    id: `service-${index}`, bookingId: BOOKING, staffId: p.id, status: 'SCHEDULED', revision: 1,
    staff: structuredClone(p),
  }));
  if (options.duplicateItems) bookingServices.push({ ...bookingServices[0], id: 'duplicate-service' });
  const booking = { id: BOOKING, bookingCode: CODE, branchId: BRANCH,
    branch: { id: BRANCH, businessId: BUSINESS }, status: 'CONFIRMED', deletedAt: null,
    customer: { userId: CUSTOMER }, bookingServices, payments: [], appointmentDate: NOW };
  let committed = {
    item: { id: 'impact-item', caseId: 'impact-case', bookingId: BOOKING, status: options.initialStatus ?? 'PENDING' } as Row,
    impact: { id: 'impact-case', businessId: BUSINESS, branchId: BRANCH, status: 'IN_PROGRESS' } as Row,
    outbox: [] as Row[], audits: [] as Row[],
  };
  const reads: { model: string; inTx: boolean }[] = [];
  const txAttempts: { committed: boolean }[] = [];
  function client(state: typeof committed, inTx: boolean): any {
    function reader(model: string, source: () => Row[]) {
      const many = jest.fn(async (args: Row = {}) => {
        reads.push({ model, inTx });
        return structuredClone(source().filter(row => matches(row, args.where)));
      });
      const one = jest.fn(async (args: Row) => (await many(args))[0] ?? null);
      return { findMany: many, findUnique: one, findFirst: one,
        findUniqueOrThrow: jest.fn(async (args: Row) => {
          const row = await one(args);
          if (!row) throw new Error(`Harness missing ${model} row`);
          return row;
        }) };
    }
    return {
      $queryRaw: jest.fn().mockResolvedValue([]),
      staffProfile: reader('staffProfile', () => profiles),
      userRole: reader('userRole', () => grants),
      booking: reader('booking', () => [booking]),
      bookingService: reader('bookingService', () => bookingServices),
      operationalImpactItem: {
        ...reader('operationalImpactItem', () => [state.item]),
        updateMany: jest.fn(async ({ where, data }: Row) => {
          if (inTx && options.staleFinalClaim && data.status === 'RESOLVED') return { count: 0 };
          if (!matches(state.item, where)) return { count: 0 };
          Object.assign(state.item, data);
          return { count: 1 };
        }),
        count: jest.fn(async ({ where }: Row) => Number(matches(state.item, where))),
      },
      operationalImpactCase: {
        ...reader('operationalImpactCase', () => [state.impact]),
        update: jest.fn(async ({ data }: Row) => Object.assign(state.impact, data)),
      },
      notificationOutbox: { createMany: jest.fn(async ({ data, skipDuplicates }: Row) => {
        if (options.outboxFault) throw options.outboxFault;
        let count = 0;
        for (const row of data) {
          if (skipDuplicates && state.outbox.some(old => old.dedupeKey === row.dedupeKey)) continue;
          state.outbox.push(structuredClone(row)); count++;
        }
        return { count };
      }) },
      auditLog: { create: jest.fn(async ({ data }: Row) => { state.audits.push(data); return data; }) },
    };
  }
  const prisma = client(committed, false);
  prisma.$transaction = jest.fn(async (operation: (tx: any) => Promise<unknown>) => {
    options.beforeFinalTx?.(profiles, grants);
    const draft = structuredClone(committed);
    const attempt = { committed: false }; txAttempts.push(attempt);
    const result = await operation(client(draft, true));
    // Commit atomically, retaining root-client references for subsequent detail reads.
    Object.assign(committed, draft); attempt.committed = true;
    return result;
  });
  const bookingItems = { update: jest.fn() };
  const bookings = { moveBooking: jest.fn(), updateStatus: jest.fn() };
  const payments = { requestRefund: jest.fn() };
  const service = new ImpactService(prisma, bookingItems as never, bookings as never, payments as never, {} as never);
  const resolve = () => service.resolveItem('impact-case', 'impact-item', { id: 'actor', roles: ['BUSINESS_OWNER'] } as never,
    { resolution: 'APPROVED_EXCEPTION', reason: `  ${REASON}  `, replacementStaffId: options.replacement?.id });
  return { resolve, prisma, reads, txAttempts, state: () => committed,
    providers: () => committed.outbox.filter(row => row.userId !== CUSTOMER), bookingItems, bookings, payments };
}

describe('ImpactService APPROVED_EXCEPTION notification privacy and authorization', () => {
  // Fix grant-expiry boundaries while allowing serializable retry waits to finish.
  beforeEach(() => { jest.useFakeTimers({ doNotFake: ['setTimeout', 'clearTimeout'] }); jest.setSystemTime(NOW); });
  afterEach(() => jest.useRealTimers());

  test('customer retains the intended booking relation, code, and full private reason without finance work', async () => {
    const f = fixture(); await f.resolve();
    expect(f.state().outbox.filter(row => row.userId === CUSTOMER)).toEqual([
      expect.objectContaining({ relatedBookingId: BOOKING, targetId: BOOKING,
        title: expect.stringContaining(CODE), body: expect.stringContaining(REASON) }),
    ]);
    expect(f.state().item).toMatchObject({ status: 'RESOLVED', reason: REASON });
    expect(f.state().impact.status).toBe('READY_TO_COMPLETE');
    expect(f.bookingItems.update).not.toHaveBeenCalled();
    expect(f.bookings.moveBooking).not.toHaveBeenCalled();
    expect(f.bookings.updateStatus).not.toHaveBeenCalled();
    expect(f.payments.requestRefund).not.toHaveBeenCalled();
  });

  test('provider notice points to the booking UUID without a live booking relation', async () => {
    const f = fixture(); await f.resolve();
    expect(f.providers()).toHaveLength(1);
    expect(f.providers()[0]).toMatchObject({ targetType: 'BOOKING', targetId: BOOKING });
    expect(f.providers()[0]).not.toHaveProperty('relatedBookingId');
  });

  test('provider payload contains neither booking code nor full private reason', async () => {
    const f = fixture(); await f.resolve();
    expect(f.providers()).toHaveLength(1);
    expect(JSON.stringify(f.providers())).not.toContain(CODE);
    expect(JSON.stringify(f.providers())).not.toContain(REASON);
  });

  test('listing a provider notice cannot project a current booking summary after access is revoked', async () => {
    const f = fixture(); await f.resolve();
    const listing = new NotificationsService({ notification: {
      findMany: jest.fn(async ({ where, include }: Row) => f.state().outbox.filter(row => row.userId === where.userId)
        .map(row => ({ ...row, relatedBooking: include?.relatedBooking && row.relatedBookingId
          ? { id: BOOKING, bookingCode: 'CURRENT-PRIVATE-CODE', status: 'CONFIRMED', appointmentDate: NOW } : null }))),
      count: jest.fn().mockResolvedValue(1),
    } } as never);
    const result = await listing.findByUser('booked-user');
    expect(result.data).toHaveLength(1);
    expect(result.data[0].relatedBooking).toBeNull();
    expect(JSON.stringify(result.data)).not.toContain('CURRENT-PRIVATE-CODE');
  });

  const exclusions: [string, (p: Row, g: Row) => void][] = [
    ['inactive profile', p => { p.status = 'INACTIVE'; }],
    ['deleted profile', p => { p.deletedAt = NOW; }],
    ['inactive linked user', (p, g) => { p.user.isActive = false; g.user.isActive = false; }],
    ['deleted linked user', (p, g) => { p.user.deletedAt = NOW; g.user.deletedAt = NOW; }],
    ['unlinked profile', p => { p.userId = null; p.user = null; }],
    ['profile belonging to another tenant', p => { p.branch.businessId = 'other-business'; }],
    ['expired grant', (_p, g) => { g.expiresAt = new Date(NOW.getTime() - 1); }],
    ['grant expiring exactly now', (_p, g) => { g.expiresAt = NOW; }],
    ['grant for another tenant', (_p, g) => { g.businessId = 'other-business'; }],
    ['STAFF grant for a sibling branch', (_p, g) => { g.branchId = 'sibling-branch'; }],
    ['STAFF grant with no exact branch', (_p, g) => { g.branchId = null; }],
    ['branch-scoped owner grant', (_p, g) => { g.role.code = 'BUSINESS_OWNER'; }],
    ['unrelated role', (_p, g) => { g.role.code = 'CUSTOMER'; }],
  ];
  test.each(exclusions)('excludes %s while preserving customer delivery', async (_label, change) => {
    const p = profile('excluded'), g = grant(p); change(p, g);
    const f = fixture({ profiles: [p], grants: [g] }); await f.resolve();
    expect(f.state().outbox.filter(row => row.userId === CUSTOMER)).toHaveLength(1);
    expect(f.providers()).toEqual([]);
  });

  test('absence of current grants does not fall back to pre-operation profile membership', async () => {
    const f = fixture({ grants: [] }); await f.resolve(); expect(f.providers()).toEqual([]);
  });

  test('accepts each active profile exact branch and tenant owner, with unique recipients', async () => {
    const source = profile('source'), sibling = profile('sibling', 'sibling-branch'), owner = profile('owner');
    const replacement = profile('replacement', 'destination-branch');
    const grants = [grant(source), grant(source, { id: 'second-grant', expiresAt: new Date(NOW.getTime() + 1) }),
      grant(sibling), grant(owner, { role: { code: 'BUSINESS_OWNER' }, branchId: null }), grant(replacement)];
    const f = fixture({ profiles: [source, sibling, owner], replacement, grants, duplicateItems: true }); await f.resolve();
    expect(f.providers().map(row => row.userId).sort()).toEqual([source, sibling, owner, replacement].map(p => p.userId).sort());
    expect(new Set(f.providers().map(row => row.dedupeKey)).size).toBe(4);
  });

  test('current profile and grant recipient selection runs inside the final transaction', async () => {
    const f = fixture(); await f.resolve();
    expect(f.reads.filter(read => read.model === 'staffProfile' && read.inTx).length).toBeGreaterThan(0);
    expect(f.reads.filter(read => read.model === 'userRole' && read.inTx).length).toBeGreaterThan(0);
    expect(f.reads.filter(read => read.model === 'userRole' && !read.inTx)).toEqual([]);
  });

  test('grant revocation at final transaction entry prevents delivery to stale recipients', async () => {
    const f = fixture({ beforeFinalTx: (_profiles, grants) => { grants.splice(0); } });
    await f.resolve(); expect(f.providers()).toEqual([]);
  });

  test('profile relinking at final transaction entry delivers only to the currently authorized user', async () => {
    const f = fixture({ beforeFinalTx: (profiles, grants) => {
      profiles[0].userId = 'current-linked-user'; grants[0].userId = 'current-linked-user';
    } });
    await f.resolve(); expect(f.providers().map(row => row.userId)).toEqual(['current-linked-user']);
  });

  test('outbox failure rolls back item resolution, case status, audit, and notices', async () => {
    const error = new Error('injected outbox failure'), f = fixture({ outboxFault: error });
    await expect(f.resolve()).rejects.toBe(error);
    expect(f.txAttempts).toEqual([{ committed: false }]);
    expect(f.state().item).toMatchObject({ status: 'PENDING' });
    expect(f.state().item).not.toHaveProperty('resolution');
    expect(f.state().impact.status).toBe('IN_PROGRESS');
    expect(f.state().audits).toEqual([]); expect(f.state().outbox).toEqual([]);
  });

  test('stale initial claim sends no notices and does not enter the final transaction', async () => {
    const f = fixture({ initialStatus: 'RESOLVED' });
    await expect(f.resolve()).rejects.toBeInstanceOf(ConflictException);
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
    expect(f.state().outbox).toEqual([]); expect(f.state().audits).toEqual([]);
  });

  test('lost final claim rolls back without customer or provider notices', async () => {
    const f = fixture({ staleFinalClaim: true });
    await expect(f.resolve()).rejects.toBeInstanceOf(ConflictException);
    expect(f.txAttempts).toEqual([{ committed: false }]);
    expect(f.state().outbox).toEqual([]); expect(f.state().audits).toEqual([]);
    expect(f.state().item.status).toBe('PENDING');
  });
});
