import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ActualTimeCorrectionsService } from './actual-time-corrections.service';
import { bookingItemActualTiming, withBookingTiming } from './booking-actual-timing';
import { assertActualTimeCorrectionPermission, ACTUAL_TIME_CORRECT_PERMISSION } from '../common/permissions/actual-time-correction-permission';
import { canOnResource } from '../common/utils/policy';
import { PolicyGuard } from '../common/guards/policy.guard';
import { REQUIRES_PERMISSION_KEY } from '../common/decorators/permission.decorator';
import { BookingsController } from './bookings.controller';
import type { AuthUser } from '../common/decorators/current-user.decorator';

const owner: AuthUser = { id: 'owner', email: 'owner@test.local', roles: ['BUSINESS_OWNER'],
  scopes: [{ code: 'BUSINESS_OWNER', businessId: 'business' }], sessionType: 'salon', workspace: 'SALON' };
const receptionist: AuthUser = { ...owner, id: 'receptionist', roles: ['RECEPTIONIST'],
  scopes: [{ code: 'RECEPTIONIST', businessId: 'business', branchId: 'branch' }] };
const start = '2026-10-06T15:05:00Z', end = '2026-10-06T15:40:00Z';
const input = { expectedRevision: 3, actualStartedAt: start, actualCompletedAt: end, reason: 'Staff forgot to record service' };
const roleRow = (user: AuthUser) => ({ userId: user.id, businessId: 'business',
  branchId: user.roles[0] === 'BUSINESS_OWNER' ? null : 'branch', expiresAt: null, role: { code: user.roles[0] } });

function fixture(user: AuthUser = owner) {
  const corrections: any[] = [];
  const item: any = { id: 'item', bookingId: 'booking', revision: 3, status: 'SCHEDULED', staffId: 'provider',
    staff: { userId: 'provider-user' }, itemStartAt: new Date('2026-10-06T15:00:00Z'), itemEndAt: new Date('2026-10-06T15:30:00Z'),
    priceAtBooking: 100000, refs_BookingServiceAdjustment_bookingServiceId: [], actualTimeCorrections: [],
    booking: { id: 'booking', branchId: 'branch', status: 'CONFIRMED', finalAmount: 100000,
      branch: { businessId: 'business', business: { id: 'business' } } } };
  const roles: any[] = [roleRow(user)];
  const grants: any[] = [];
  const others: any[] = [];
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    userRole: { findMany: jest.fn().mockImplementation(async () => roles), findFirst: jest.fn().mockImplementation(async () => roles[0] ?? null) },
    // Unscoped legacy direct grants must never be consulted by this workflow.
    userPermission: { findFirst: jest.fn().mockResolvedValue({ permission: { code: ACTUAL_TIME_CORRECT_PERMISSION } }) },
    bookingActualTimeGrant: {
      findFirst: jest.fn().mockImplementation(async () => grants[0] ?? null),
      create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'grant', ...data })),
      findUnique: jest.fn().mockImplementation(async () => grants[0] ?? null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    bookingService: {
      findFirst: jest.fn().mockImplementation(async () => ({ ...item })),
      findMany: jest.fn().mockImplementation(async ({ where }: any) => where.id?.not ? others : [item]),
      updateMany: jest.fn().mockImplementation(async ({ data }: any) => { item.status = data.status; item.revision++; return { count: 1 }; }),
    },
    bookingServiceActualTimeCorrection: {
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const row = { id: `correction-${data.version}`, ...data };
        corrections.push(row); item.actualTimeCorrections = [row]; return row;
      }),
      findMany: jest.fn().mockImplementation(async () => [...corrections].reverse()),
    },
    booking: { update: jest.fn(), updateMany: jest.fn() },
    bookingServiceAdjustment: { create: jest.fn(), update: jest.fn() },
  };
  const prisma = { ...tx, $transaction: jest.fn(async (fn: (client: unknown) => Promise<unknown>) => fn(tx)) };
  const service = new ActualTimeCorrectionsService(prisma as never);
  const grant = (patch: Record<string, unknown> = {}) => grants.push({ id: 'grant', userId: user.id, businessId: 'business',
    branchId: 'branch', expiresAt: null, revokedAt: null, ...patch });
  return { service, prisma, tx, item, roles, grants, others, corrections, grant };
}

describe('Append-only actual-time correction workflow', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-10-06T15:52:00Z')));
  afterEach(() => jest.useRealTimers());
  it('delegated Staff cannot correct their own START after reassignment to another profile', async () => {
    const staff: AuthUser = { ...receptionist, id: 'staff', roles: ['STAFF'], scopes: [{ code: 'STAFF', businessId: 'business', branchId: 'branch' }] };
    const f = fixture(staff); f.grant();
    f.item.staff.userId = 'different-provider';
    f.item.refs_BookingServiceAdjustment_bookingServiceId = [{ action: 'START', actorId: staff.id, createdAt: new Date(start), version: 1,
      beforeSnapshot: { status: 'SCHEDULED' }, afterSnapshot: { status: 'IN_PROGRESS' } }];
    await expect(f.service.correct('booking', 'item', staff, input)).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.tx.bookingService.updateMany).not.toHaveBeenCalled(); expect(f.corrections).toHaveLength(0);
  });
  it('former provider is still excluded when Owner pressed START and assignment later changed', async () => {
    const staff: AuthUser = { ...receptionist, id: 'former-provider', roles: ['STAFF'], scopes: [{ code: 'STAFF', businessId: 'business', branchId: 'branch' }] };
    const f = fixture(staff); f.grant(); f.item.staff.userId = 'new-provider';
    f.item.refs_BookingServiceAdjustment_bookingServiceId = [{ action: 'START', actorId: owner.id, version: 1, createdAt: new Date(start),
      beforeSnapshot: { status: 'SCHEDULED', staffId: 'old-profile' }, afterSnapshot: { status: 'IN_PROGRESS', staffId: 'old-profile' } }];
    f.tx.staffProfile = { findMany: jest.fn().mockResolvedValue([{ id: 'old-profile' }]) };
    await expect(f.service.correct('booking', 'item', staff, input)).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.tx.staffProfile.findMany).toHaveBeenCalledWith({ where: { id: { in: ['old-profile'] }, userId: staff.id }, select: { id: true } });
    expect(f.tx.bookingService.updateMany).not.toHaveBeenCalled();
  });
  it('snapshot provider identity remains protected even if the old profile link changes', async () => {
    const f = fixture(receptionist); f.grant();
    f.item.refs_BookingServiceAdjustment_bookingServiceId = [{ action: 'START', actorId: owner.id, version: 1, createdAt: new Date(start),
      beforeSnapshot: { status: 'SCHEDULED', staffId: 'old-profile', staffUserId: receptionist.id }, afterSnapshot: { status: 'IN_PROGRESS' } }];
    await expect(f.service.correct('booking', 'item', receptionist, input)).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.tx.bookingService.updateMany).not.toHaveBeenCalled();
  });
  it('Owner acting as an operator can correct another provider even with a Staff role', async () => {
    const operator: AuthUser = { ...owner, roles: ['BUSINESS_OWNER', 'STAFF'], scopes: [...owner.scopes, { code: 'STAFF', businessId: 'business', branchId: 'branch' }] };
    const f = fixture(operator); f.item.status = 'IN_PROGRESS'; f.item.booking.status = 'IN_PROGRESS';
    f.item.refs_BookingServiceAdjustment_bookingServiceId = [{ action: 'START', actorId: owner.id, version: 1, createdAt: new Date(start),
      beforeSnapshot: { status: 'SCHEDULED', staffId: 'provider', staffUserId: 'provider-user' },
      afterSnapshot: { status: 'IN_PROGRESS', staffId: 'provider', staffUserId: 'provider-user' } }];
    await expect(f.service.correct('booking', 'item', operator, input)).resolves.toMatchObject({ status: 'COMPLETED' });
  });

  it('owner records past facts and server attribution, completing only the item', async () => {
    const f = fixture(); const planned = [f.item.itemStartAt, f.item.itemEndAt];
    const result = await f.service.correct('booking', 'item', owner, input);
    expect(result).toMatchObject({ status: 'COMPLETED', revision: 4, actualTimingSource: 'ACTUAL_TIME_CORRECTION', actualTimingStatus: 'KNOWN' });
    expect(result.correction).toMatchObject({ version: 1, actorId: owner.id, correctedAt: new Date(),
      actualStartedAt: new Date(start), actualCompletedAt: new Date(end),
      oldActualStartedAt: null, oldActualCompletedAt: null, oldItemStatus: 'SCHEDULED', newItemStatus: 'COMPLETED', reason: input.reason });
    expect([f.item.itemStartAt, f.item.itemEndAt]).toEqual(planned);
    expect(f.item.priceAtBooking).toBe(100000); expect(f.item.booking.status).toBe('CONFIRMED');
    expect(f.tx.bookingService.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'COMPLETED', revision: { increment: 1 } } }));
    expect(f.tx.booking.update).not.toHaveBeenCalled(); expect(f.tx.booking.updateMany).not.toHaveBeenCalled();
    expect(f.tx.bookingServiceAdjustment.create).not.toHaveBeenCalled(); expect(f.tx.bookingServiceAdjustment.update).not.toHaveBeenCalled();
    expect(f.tx.userPermission.findFirst).not.toHaveBeenCalled();
  });

  it('null/null explicitly records UNKNOWN, without filling planned times', async () => {
    const f = fixture();
    const result = await f.service.correct('booking', 'item', owner, { ...input, actualStartedAt: null, actualCompletedAt: null });
    expect(result).toMatchObject({ status: 'COMPLETED', actualStartedAt: null, actualCompletedAt: null,
      actualStoppedAt: null, actualTimingStatus: 'UNKNOWN', actualTimingSource: 'ACTUAL_TIME_CORRECTION' });
    expect(f.item.booking.status).toBe('CONFIRMED');
  });

  it('subsequent corrections append old/new facts and monotonic versions; UNKNOWN can replace known times', async () => {
    const f = fixture();
    await f.service.correct('booking', 'item', owner, input);
    await f.service.correct('booking', 'item', owner, { ...input, expectedRevision: 4,
      actualStartedAt: '2026-10-06T15:10:00Z', actualCompletedAt: '2026-10-06T15:45:00Z', reason: 'Correct customer recollection' });
    await f.service.correct('booking', 'item', owner, { ...input, expectedRevision: 5, actualStartedAt: null,
      actualCompletedAt: null, reason: 'Exact times cannot be established' });
    expect(f.corrections.map(c => c.version)).toEqual([1, 2, 3]);
    expect(f.corrections[1]).toMatchObject({ oldActualStartedAt: new Date(start), oldActualCompletedAt: new Date(end) });
    expect(f.corrections[2]).toMatchObject({ oldActualStartedAt: new Date('2026-10-06T15:10:00Z'), actualTimingStatus: 'UNKNOWN' });
    expect((await f.service.history('booking', 'item', owner)).data.map(c => c.version)).toEqual([3, 2, 1]);
    expect(bookingItemActualTiming(f.item).actualStartedAt).toBeNull();
  });

  it.each([
    { reason: '' }, { reason: '  ' }, { reason: 'x'.repeat(2001) }, { expectedRevision: 0 },
    { actualStartedAt: end, actualCompletedAt: start }, { actualStartedAt: start, actualCompletedAt: start },
    { actualCompletedAt: '2026-10-06T15:52:01Z' }, { actualStartedAt: null }, { actualCompletedAt: null },
    { actualStartedAt: undefined }, { actualStartedAt: 'not-a-date' }, { actualStartedAt: '2026-10-06T15:05:00' },
    { actualTimingStatus: 'UNKNOWN' },
  ])('rejects invalid reason, revision or interval before appending (%#)', async patch => {
    const f = fixture();
    await expect(f.service.correct('booking', 'item', owner, { ...input, ...patch } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(f.tx.bookingService.updateMany).not.toHaveBeenCalled(); expect(f.corrections).toEqual([]);
  });

  it('completion at the exact current instant is allowed when start is earlier', async () => {
    const f = fixture();
    await expect(f.service.correct('booking', 'item', owner, { ...input, actualCompletedAt: new Date().toISOString() })).resolves.toMatchObject({ status: 'COMPLETED' });
  });
  it('stale revision and competing compare-and-swap failures append no correction', async () => {
    const f = fixture();
    await expect(f.service.correct('booking', 'item', owner, { ...input, expectedRevision: 2 })).rejects.toBeInstanceOf(ConflictException);
    expect(f.tx.bookingService.updateMany).not.toHaveBeenCalled();
    f.tx.bookingService.updateMany.mockResolvedValue({ count: 0 });
    await expect(f.service.correct('booking', 'item', owner, input)).rejects.toBeInstanceOf(ConflictException);
    expect(f.corrections).toEqual([]);
  });
  it.each(['CANCELLED', 'SKIPPED'])('rejects terminal non-completed item %s', async status => {
    const f = fixture(); f.item.status = status;
    await expect(f.service.correct('booking', 'item', owner, input)).rejects.toBeInstanceOf(ConflictException);
  });
  it.each(['NO_SHOW', 'CANCELLED', 'REJECTED', 'EXPIRED'])('rejects correction in parent %s', async status => {
    const f = fixture(); f.item.booking.status = status;
    await expect(f.service.correct('booking', 'item', owner, input)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects overlapping latest corrected actual interval on the same provider across days', async () => {
    const f = fixture(); f.others.push({ status: 'COMPLETED', actualTimeCorrections: [{ version: 2,
      actualStartedAt: new Date('2026-10-06T15:20:00Z'), actualCompletedAt: new Date('2026-10-06T15:50:00Z'), actualTimingStatus: 'KNOWN' }] });
    await expect(f.service.correct('booking', 'item', owner, input)).rejects.toThrow('trùng');
    expect(f.tx.bookingService.updateMany).not.toHaveBeenCalled(); expect(f.corrections).toEqual([]);
    expect(f.tx.bookingService.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { staffId: 'provider', id: { not: 'item' } } }));
  });
  it('rejects conflict with observed START/COMPLETE audits, accepting adjacent intervals', async () => {
    const f = fixture();
    const events = (a: string, b: string) => ({ status: 'COMPLETED', refs_BookingServiceAdjustment_bookingServiceId: [
      { action: 'START', version: 1, createdAt: new Date(a), beforeSnapshot: { status: 'SCHEDULED' }, afterSnapshot: { status: 'IN_PROGRESS' } },
      { action: 'COMPLETE', version: 2, createdAt: new Date(b), beforeSnapshot: { status: 'IN_PROGRESS' }, afterSnapshot: { status: 'COMPLETED' } },
    ] });
    f.others.push(events('2026-10-06T15:00:00Z', '2026-10-06T15:10:00Z'));
    await expect(f.service.correct('booking', 'item', owner, input)).rejects.toThrow('trùng');
    f.others[0] = events('2026-10-06T14:50:00Z', start);
    await expect(f.service.correct('booking', 'item', owner, input)).resolves.toMatchObject({ status: 'COMPLETED' });
  });
  it('UNKNOWN on another service never invents an actual interval', async () => {
    const f = fixture(); f.others.push({ status: 'COMPLETED', actualTimeCorrections: [{ version: 1,
      actualStartedAt: null, actualCompletedAt: null, actualTimingStatus: 'UNKNOWN' }] });
    await expect(f.service.correct('booking', 'item', owner, input)).resolves.toMatchObject({ actualTimingStatus: 'KNOWN' });
  });
  it('observed cancellation releases conflict capacity without fabricating an actual end', async () => {
    const f = fixture();
    const cancelled = { status: 'CANCELLED', refs_BookingServiceAdjustment_bookingServiceId: [{ action: 'START', actorId: 'other', version: 1,
      createdAt: new Date('2026-10-06T14:00:00Z'), beforeSnapshot: { status: 'SCHEDULED' }, afterSnapshot: { status: 'IN_PROGRESS' } }],
      booking: { statusHistory: [{ createdAt: new Date('2026-10-06T15:00:00Z') }] } };
    f.others.push(cancelled);
    await expect(f.service.correct('booking', 'item', owner, input)).resolves.toMatchObject({ actualTimingStatus: 'KNOWN' });
    expect(bookingItemActualTiming(cancelled).actualStoppedAt).toBeNull();
    const blocked = fixture(); blocked.others.push(cancelled);
    await expect(blocked.service.correct('booking', 'item', owner, { ...input, actualStartedAt: '2026-10-06T14:30:00Z' })).rejects.toThrow('trùng');
  });
  it('a terminal legacy unknown stop cannot block an interval entirely before its known start', async () => {
    const f = fixture(); f.others.push({ status: 'CANCELLED', refs_BookingServiceAdjustment_bookingServiceId: [{ action: 'START', version: 1,
      createdAt: new Date('2026-10-06T15:45:00Z'), beforeSnapshot: { status: 'SCHEDULED' }, afterSnapshot: { status: 'IN_PROGRESS' } }], booking: { statusHistory: [] } });
    await expect(f.service.correct('booking', 'item', owner, input)).resolves.toMatchObject({ actualTimingStatus: 'KNOWN' });
  });

  it('default receptionist and unscoped direct grants cannot correct or read history', async () => {
    const f = fixture(receptionist);
    await expect(f.service.correct('booking', 'item', receptionist, input)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(f.service.history('booking', 'item', receptionist)).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.tx.userPermission.findFirst).not.toHaveBeenCalled();
  });
  it('explicit scoped receptionist delegation permits correction and authorized history', async () => {
    const f = fixture(receptionist); f.grant();
    await expect(f.service.correct('booking', 'item', receptionist, input)).resolves.toMatchObject({ revision: 4 });
    expect((await f.service.history('booking', 'item', receptionist)).data[0].actorId).toBe('receptionist');
  });
  it.each([{ businessId: 'foreign' }, { branchId: 'foreign' }, { businessId: null, branchId: null },
    { revokedAt: new Date('2026-10-06T15:00:00Z') }, { expiresAt: new Date('2026-10-06T15:52:00Z') }])(
    'rejects foreign, unscoped, revoked or expired delegation %#', async patch => {
      const f = fixture(receptionist); f.grant(patch);
      await expect(f.service.correct('booking', 'item', receptionist, input)).rejects.toBeInstanceOf(ForbiddenException);
    },
  );
  it('multi-business role holder cannot carry a business-A delegation into business B', async () => {
    const f = fixture(receptionist); f.grant();
    f.roles.push({ ...roleRow(receptionist), businessId: 'business-B', branchId: 'branch-B' });
    f.item.booking.branchId = 'branch-B'; f.item.booking.branch.businessId = 'business-B';
    await expect(f.service.correct('booking', 'item', receptionist, input)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it.each([owner, { ...receptionist, id: 'provider-user', roles: ['STAFF'], scopes: [{ code: 'STAFF', businessId: 'business', branchId: 'branch' }] } as AuthUser])(
    'assigned self cannot correct even with owner/default or explicit delegated authority %#', async user => {
      const f = fixture(user); f.item.staff.userId = user.id; f.grant();
      await expect(f.service.correct('booking', 'item', user, input)).rejects.toBeInstanceOf(ForbiddenException);
    },
  );
  it('customer, platform and revoked salon role cannot correct', async () => {
    for (const user of [{ ...owner, sessionType: 'customer' }, { ...owner, sessionType: 'admin' }] as AuthUser[]) {
      const f = fixture(user);
      await expect(f.service.correct('booking', 'item', user, input)).rejects.toBeInstanceOf(ForbiddenException);
    }
    const f = fixture(); f.roles.length = 0;
    await expect(f.service.correct('booking', 'item', owner, input)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('item capability comes from live resource grants, state and provider identity', async () => {
    const f = fixture(receptionist); const booking = { id: 'booking', bookingServices: [{ id: 'item' }] };
    expect((await f.service.withCapabilities(booking, receptionist)).bookingServices[0].canCorrectActualTime).toBe(false);
    f.grant();
    expect((await f.service.withCapabilities(booking, receptionist)).bookingServices[0].canCorrectActualTime).toBe(true);
    f.item.staff.userId = receptionist.id;
    expect((await f.service.withCapabilities(booking, receptionist)).bookingServices[0].canCorrectActualTime).toBe(false);
  });
  it('public timing projection uses latest version and strips correction actor/reason/history', () => {
    const item: any = { status: 'COMPLETED', actualTimeCorrections: [
      { version: 1, actualStartedAt: new Date(start), actualCompletedAt: new Date(end), actualTimingStatus: 'KNOWN', reason: 'private', actorId: 'private' },
      { version: 2, actualStartedAt: null, actualCompletedAt: null, actualTimingStatus: 'UNKNOWN', reason: 'private2' },
    ] };
    const projected = withBookingTiming({ bookingServices: [item] }).bookingServices[0];
    expect(projected).toMatchObject({ actualStartedAt: null, actualCompletedAt: null, actualTimingStatus: 'UNKNOWN', actualTimingSource: 'ACTUAL_TIME_CORRECTION' });
    expect(projected).not.toHaveProperty('actualTimeCorrections'); expect(JSON.stringify(projected)).not.toContain('private');
  });
  it('operational booking detail attaches capability and customer detail strips it/history', async () => {
    const f = fixture();
    const booking: any = { id: 'booking', branchId: 'branch', branch: { business: { id: 'business' } },
      bookingServices: [{ id: 'item', canCorrectActualTime: true, actualTimeCorrections: [{ reason: 'secret' }] }] };
    const access = { rolesAtResource: jest.fn().mockReturnValue(['BUSINESS_OWNER']), loadAndAssert: jest.fn().mockResolvedValue({}), canReadBranch: jest.fn().mockReturnValue(true) };
    const controller = new BookingsController({ findOne: jest.fn().mockResolvedValue(booking) } as never, access as never,
      f.prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, f.service);
    expect((await controller.findOne('booking', owner)).bookingServices[0].canCorrectActualTime).toBe(true);
    const customer = { id: 'customer', roles: ['CUSTOMER'], scopes: [{ code: 'CUSTOMER' }], sessionType: 'customer' } as AuthUser;
    const result = await controller.findOne('booking', customer);
    expect(result.bookingServices[0]).not.toHaveProperty('canCorrectActualTime');
    expect(result.bookingServices[0]).not.toHaveProperty('actualTimeCorrections');
  });
  it('permission guard supports scoped delegation on the exact correction resource while global direct RBAC stays closed', async () => {
    const f = fixture(receptionist); f.grant();
    const reflector = { getAllAndOverride: jest.fn((key: string) => key === REQUIRES_PERMISSION_KEY ? [ACTUAL_TIME_CORRECT_PERMISSION] : undefined) };
    const guard = new PolicyGuard(reflector as never, f.prisma as never);
    const context = { getHandler: () => ({}), getClass: () => ({}), switchToHttp: () => ({ getRequest: () => ({ user: receptionist,
      params: { id: 'booking', itemId: 'item' }, body: { branchId: 'forged' } }) }) };
    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(f.tx.bookingService.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'item', bookingId: 'booking' }) }));
    expect(canOnResource({ ...receptionist, permissions: [ACTUAL_TIME_CORRECT_PERMISSION] }, ACTUAL_TIME_CORRECT_PERMISSION,
      { businessId: 'business', branchId: 'branch' })).toBe(false);
    f.grants[0].revokedAt = new Date();
    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('grant and revoke operations are limited to live owner scope and retain actor/reason', async () => {
    const f = fixture();
    const granted = await f.service.grant(owner, { userId: 'receptionist', businessId: 'business', reason: 'Delegate manager work' });
    expect(granted).toMatchObject({ userId: 'receptionist', businessId: 'business', branchId: null, grantedBy: 'owner', reason: 'Delegate manager work' });
    f.grants.push(granted);
    await f.service.revokeGrant(owner, granted.id, { reason: 'Assignment ended' });
    expect(f.tx.bookingActualTimeGrant.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: {
      revokedAt: new Date(), revokedBy: 'owner', revokeReason: 'Assignment ended' } }));
    const other = fixture(receptionist);
    await expect(other.service.grant(receptionist, { userId: 'staff', businessId: 'business', reason: 'Unauthorized delegation' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(f.service.grant(owner, { userId: 'staff', businessId: 'foreign', reason: 'Cross scope' })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('live branch-matching role and delegated scope are both required', async () => {
    const f = fixture(receptionist); f.grant(); f.roles[0].branchId = 'other-branch';
    await expect(assertActualTimeCorrectionPermission(f.tx, receptionist, { businessId: 'business', branchId: 'branch' }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});
