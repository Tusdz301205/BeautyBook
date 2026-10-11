import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { ReviewsService } from './reviews.service';

const baseline = process.env.QA_REVIEW_APPEAL_BASELINE === '1';
const Service: typeof ReviewsService = baseline ? require(process.env.QA_REVIEW_APPEAL_BASELINE_MODULE!).ReviewsService : ReviewsService;
const customer: AuthUser = { id: 'author', email: 'qa@example.test', roles: ['CUSTOMER'], scopes: [{ code: 'CUSTOMER' }], sessionType: 'customer' };
const admin: AuthUser = { id: 'admin', email: 'qa-admin@example.test', roles: ['PLATFORM_ADMIN'], scopes: [{ code: 'PLATFORM_ADMIN' }], sessionType: 'admin' };
const owner = (businessId: string, expiresAt?: string): AuthUser => ({ id: 'owner', email: 'qa-owner@example.test', roles: ['BUSINESS_OWNER'], scopes: [{ code: 'BUSINESS_OWNER', businessId, expiresAt }], sessionType: 'salon' });

// Controlled transactional model, not a PostgreSQL integration. The old compiled
// service skips the lock/CAS and reproduces both concurrent winners.
function fixture(pending = true, notificationFails = false) {
  let state: any = { review: { id: 'review', status: 'HIDDEN', customer: { userId: 'author' }, booking: { branch: { id: 'branch-A', businessId: 'A' } } }, appeals: pending ? [{ id: 'appeal', reviewId: 'review', appellantId: 'author', status: 'PENDING' }] : [], events: [], notifications: [] };
  let tail: Promise<void> = Promise.resolve();
  const prisma: any = {
    review: { findUnique: jest.fn(async () => structuredClone(state.review)) },
    userRole: { findFirst: jest.fn(async () => ({ id: 'historical-owner-grant' })) },
    reviewAppeal: { findFirst: jest.fn(async () => state.appeals.find((a: any) => a.status === 'PENDING') ?? null) },
    $transaction: jest.fn(async (fn: (tx: any) => Promise<unknown>) => {
      let draft = structuredClone(state), unlock: (() => void) | undefined;
      const readAppeal = (id: string) => structuredClone(draft.appeals.find((a: any) => a.id === id) ?? null);
      const tx: any = {
        $queryRaw: jest.fn(async () => { const previous = tail; tail = new Promise<void>(resolve => { unlock = resolve; }); await previous; draft = structuredClone(state); return [{ id: 'review' }]; }),
        review: { findUnique: jest.fn(async () => structuredClone(draft.review)), findUniqueOrThrow: jest.fn(async () => structuredClone(draft.review)), update: jest.fn(async ({ data }: any) => Object.assign(draft.review, data)) },
        reviewAppeal: {
          findUnique: jest.fn(async ({ where }: any) => readAppeal(where.id)),
          findUniqueOrThrow: jest.fn(async ({ where }: any) => readAppeal(where.id)),
          findFirst: jest.fn(async () => draft.appeals.find((a: any) => a.status === 'PENDING') ?? null),
          create: jest.fn(async ({ data }: any) => { const appeal = { id: 'appeal-' + draft.appeals.length, status: 'PENDING', ...data }; draft.appeals.push(appeal); return appeal; }),
          update: jest.fn(async ({ where, data }: any) => Object.assign(draft.appeals.find((a: any) => a.id === where.id), data)),
          updateMany: jest.fn(async ({ where, data }: any) => { const matches = draft.appeals.filter((a: any) => a.id === where.id && a.status === where.status); matches.forEach((a: any) => Object.assign(a, data)); return { count: matches.length }; }),
        },
        reviewModerationEvent: { create: jest.fn(async ({ data }: any) => { draft.events.push(data); return { id: 'event-' + draft.events.length }; }) },
        notification: { create: jest.fn(async ({ data }: any) => { if (notificationFails) throw Error('Controlled notification persistence fault'); draft.notifications.push(data); return { id: 'notice' }; }) },
      };
      try { const result = await fn(tx); state = draft; return result; } finally { unlock?.(); }
    }),
  };
  const service = new Service(prisma, {} as never);
  return { service, prisma, state: () => state, submit: (user: AuthUser) => service.appeal('review', (baseline ? user.id : user) as never, 'QA explanation') };
}

describe('Review appeal current-session scope and transactional integrity', () => {
  test.each([
    ['expired A plus active B', { ...owner('B'), scopes: [...owner('B').scopes, ...owner('A', '2000-01-01T00:00:00Z').scopes] }],
    ['stored A grant outside selected B session', owner('B')],
    ['another customer', { ...customer, id: 'other-author' }],
  ])('denies %s without writes', async (_label, user) => {
    const f = fixture(false);
    await expect(f.submit(user as AuthUser)).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.state().appeals).toHaveLength(0); expect(f.state().events).toHaveLength(0);
  });
  test.each([customer, owner('A')])('accepts the author or current A owner', async user => {
    const f = fixture(false); await f.submit(user); expect(f.state().appeals).toHaveLength(1); expect(f.state().events[0].actorId).toBe(user.id);
  });
  test('competing submissions produce one pending appeal and one event', async () => {
    const f = fixture(false), outcomes = await Promise.allSettled([f.submit(customer), f.submit(customer)]);
    expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(1);
    const loser = outcomes.find(o => o.status === 'rejected') as PromiseRejectedResult; expect(loser.reason).toBeInstanceOf(ConflictException);
    expect(f.state().appeals).toHaveLength(1); expect(f.state().events).toHaveLength(1);
  });
  test('competing terminal decisions cannot overwrite each other or double-notify', async () => {
    const f = fixture(), outcomes = await Promise.allSettled([f.service.resolveAppeal('appeal', true, 'First decision', admin), f.service.resolveAppeal('appeal', false, 'Second decision', admin)]);
    expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(1);
    const loser = outcomes.find(o => o.status === 'rejected') as PromiseRejectedResult; expect(loser.reason).toBeInstanceOf(ConflictException);
    const state = f.state(); expect(state.events).toHaveLength(1); expect(state.notifications).toHaveLength(1);
    expect(state.review.status).toBe(state.appeals[0].status === 'APPROVED' ? 'APPROVED' : 'HIDDEN');
  });
  test.each([true, false])('decision %s notifies the appellant without raw resolution/PII', async approve => {
    const f = fixture(); await f.service.resolveAppeal('appeal', approve, 'Private moderator explanation', admin);
    expect(f.state().notifications).toEqual([expect.objectContaining({ userId: 'author', targetType: 'REVIEW', targetId: 'review' })]);
    expect(JSON.stringify(f.state().notifications)).not.toContain('Private moderator explanation');
  });
  test('notification persistence fault rolls back decision, review and history', async () => {
    const f = fixture(true, true); await expect(f.service.resolveAppeal('appeal', true, 'QA decision', admin)).rejects.toThrow('Controlled notification persistence fault');
    expect(f.state().appeals[0].status).toBe('PENDING'); expect(f.state().review.status).toBe('HIDDEN'); expect(f.state().events).toHaveLength(0);
  });
  test('a new appeal remains possible after a terminal decision', async () => {
    const f = fixture(); await f.service.resolveAppeal('appeal', false, 'QA decision', admin); await f.submit(customer);
    expect(f.state().appeals.filter((a: any) => a.status === 'PENDING')).toHaveLength(1);
  });
});
