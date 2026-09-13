import { Logger } from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { SchedulerGateway, SOCKET_AUTHORIZATION_TIMEOUT_MS, SOCKET_REAUTHORIZE_INTERVAL_MS } from './scheduler.gateway';

const principal = (branchId = 'branch-a'): AuthUser => ({
  id: 'user-1', email: 'private@example.com', roles: ['BRANCH_MANAGER'],
  scopes: [{ code: 'BRANCH_MANAGER', businessId: 'business-a', branchId }],
  permissions: ['booking:read:branch'], sessionType: 'salon',
});
const booking = (branchId = 'branch-a') => ({ id: 'booking-1', branchId, businessId: 'business-a', status: 'CONFIRMED' });

function fixture() {
  let middleware!: (socket: any, next: (error?: Error) => void) => Promise<void>;
  const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', exp: Date.now() / 1000 + 3600 }) };
  const strategy = { validate: jest.fn().mockResolvedValue(principal()) };
  const gateway = new SchedulerGateway(jwt as never, strategy as never);
  gateway.afterInit({ use: jest.fn((handler) => { middleware = handler; }) } as never);
  const client = {
    id: 'socket-1', connected: true, data: {},
    handshake: { auth: { token: 'private-token' }, headers: {} },
    join: jest.fn(), leave: jest.fn(), emit: jest.fn(),
    disconnect: jest.fn(() => { client.connected = false; gateway.handleDisconnect(client as never); }),
  };
  return { gateway, client, jwt, strategy, connect: async () => {
    const next = jest.fn();
    await middleware(client, next);
    return next;
  } };
}

describe('Scheduler socket authorization renewal', () => {
  let gateway: SchedulerGateway | undefined;
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-08T00:00:00Z'));
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => { gateway?.onModuleDestroy(); jest.restoreAllMocks(); jest.useRealTimers(); });

  it('delivers once to an authorized socket even if several target rooms match', async () => {
    const f = fixture(); gateway = f.gateway;
    f.strategy.validate.mockResolvedValue({ ...principal(), scopes: [{ code: 'PLATFORM_ADMIN' }], permissions: ['booking:read:platform'] });
    expect(await f.connect()).toHaveBeenCalledWith();
    gateway.notifyBookingUpdated({ ...booking(), customerUserId: 'user-1' });
    expect(f.client.emit).toHaveBeenCalledTimes(1);
    expect(f.client.emit).toHaveBeenCalledWith('booking_updated', { id: 'booking-1', status: 'CONFIRMED', branchId: 'branch-a', updatedAt: null });
  });

  it('rechecks the current session and disconnects a revoked socket at the next interval', async () => {
    const f = fixture(); gateway = f.gateway;
    await f.connect();
    f.strategy.validate.mockRejectedValue(new Error('session revoked'));
    await jest.advanceTimersByTimeAsync(SOCKET_REAUTHORIZE_INTERVAL_MS);
    expect(f.strategy.validate).toHaveBeenCalledTimes(2);
    expect(f.client.disconnect).toHaveBeenCalledWith(true);
    f.client.emit.mockClear();
    gateway.notifyBookingUpdated(booking());
    expect(f.client.emit).not.toHaveBeenCalled();
  });

  it('replaces branch rooms after membership changes, without retaining the old branch', async () => {
    const f = fixture(); gateway = f.gateway;
    await f.connect();
    f.strategy.validate.mockResolvedValue(principal('branch-b'));
    await gateway.reauthorizeSockets();
    expect(f.client.leave).toHaveBeenCalledWith('branch:branch-a');
    expect(f.client.join).toHaveBeenLastCalledWith(['user:user-1', 'branch:branch-b']);
    expect(f.client.emit).toHaveBeenCalledWith('scheduler_access_changed');
    f.client.emit.mockClear();
    gateway.notifyBookingUpdated(booking());
    expect(f.client.emit).not.toHaveBeenCalled();
    gateway.notifyBookingUpdated(booking('branch-b'));
    expect(f.client.emit).toHaveBeenCalledTimes(1);
  });

  it('blocks delivery from an expired lease even when the interval has not run', async () => {
    const f = fixture(); gateway = f.gateway;
    await f.connect();
    jest.setSystemTime(Date.now() + 30_001);
    gateway.notifyBookingCreated(booking());
    expect(f.client.disconnect).toHaveBeenCalledWith(true);
    expect(f.client.emit).not.toHaveBeenCalledWith('booking_created', expect.anything());
  });

  it('never extends a lease past the signed JWT expiry', async () => {
    const f = fixture(); gateway = f.gateway;
    f.jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', exp: Date.now() / 1000 + 2 });
    await f.connect();
    jest.setSystemTime(Date.now() + 2001);
    gateway.notifyBookingUpdated(booking());
    expect(f.client.disconnect).toHaveBeenCalledWith(true);
  });

  it('never extends a lease past a scoped role expiry', async () => {
    const f = fixture(); gateway = f.gateway;
    const user = principal();
    user.scopes[0].expiresAt = new Date(Date.now() + 2000).toISOString();
    f.strategy.validate.mockResolvedValue(user);
    await f.connect();
    jest.setSystemTime(Date.now() + 2001);
    gateway.notifyBookingUpdated(booking());
    expect(f.client.disconnect).toHaveBeenCalledWith(true);
  });

  it('does not send booking data during revalidation and requests a resync after successful renewal', async () => {
    const f = fixture(); gateway = f.gateway;
    await f.connect();
    let resolve!: (user: AuthUser) => void;
    f.strategy.validate.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const renewal = gateway.reauthorizeSockets();
    await Promise.resolve();
    gateway.notifyBookingUpdated(booking());
    expect(f.client.emit).not.toHaveBeenCalled();
    resolve(principal());
    await renewal;
    expect(f.client.emit).toHaveBeenCalledWith('scheduler_resync');
    gateway.notifyBookingUpdated(booking());
    expect(f.client.emit).toHaveBeenCalledWith('booking_updated', expect.anything());
  });

  it('times out a stalled auth lookup and a late response cannot rejoin rooms', async () => {
    const f = fixture(); gateway = f.gateway;
    await f.connect();
    let resolve!: (user: AuthUser) => void;
    f.strategy.validate.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const renewal = gateway.reauthorizeSockets();
    await jest.advanceTimersByTimeAsync(SOCKET_AUTHORIZATION_TIMEOUT_MS);
    await renewal;
    expect(f.client.disconnect).toHaveBeenCalledWith(true);
    resolve(principal());
    await Promise.resolve(); await Promise.resolve();
    expect(f.client.join).toHaveBeenCalledTimes(1);
  });

  it('cannot resurrect a disconnected socket while authorization is pending', async () => {
    const f = fixture(); gateway = f.gateway;
    await f.connect();
    let resolve!: (user: AuthUser) => void;
    f.strategy.validate.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const renewal = gateway.reauthorizeSockets();
    await Promise.resolve();
    f.client.disconnect();
    resolve(principal());
    await renewal;
    expect(f.client.join).toHaveBeenCalledTimes(1);
    gateway.notifyBookingUpdated(booking());
    expect(f.client.emit).not.toHaveBeenCalled();
  });

  it('rejects a token without expiry instead of granting a forever connection', async () => {
    const f = fixture(); gateway = f.gateway;
    f.jwt.verifyAsync.mockResolvedValue({ sub: 'user-1' } as never);
    expect(await f.connect()).toHaveBeenCalledWith(expect.objectContaining({ data: { code: 'WS_AUTH_FAILED' } }));
    expect(f.client.join).not.toHaveBeenCalled();
  });

  it('stops renewal and clears delivery authorization on module shutdown', async () => {
    const f = fixture(); gateway = f.gateway;
    await f.connect();
    gateway.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(f.strategy.validate).toHaveBeenCalledTimes(1);
    expect(f.client.disconnect).toHaveBeenCalledWith(true);
  });
});
