import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  bookingRoomsForUser,
  buildBookingRealtimeDispatch,
  resolveWebSocketCorsOrigins,
  SchedulerGateway,
} from './scheduler.gateway';

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    email: 'user@example.com',
    roles: ['CUSTOMER'],
    scopes: [{ code: 'CUSTOMER' }],
    permissions: ['booking:read:self'],
    sessionType: 'customer',
    ...overrides,
  };
}

describe('SchedulerGateway security', () => {
  test('production CORS rejects wildcard origins', () => {
    expect(() =>
      resolveWebSocketCorsOrigins({ NODE_ENV: 'production', CORS_ORIGINS: '*' }),
    ).toThrow('must not contain');
  });

  test('customer only joins their own user room', () => {
    expect(bookingRoomsForUser(user())).toEqual(['user:user-1']);
  });

  test('branch-scoped booking reader cannot join another branch', () => {
    const rooms = bookingRoomsForUser(
      user({
        roles: ['STAFF'],
        scopes: [{ code: 'STAFF', businessId: 'business-a', branchId: 'branch-a' }],
        permissions: ['booking:read:branch'],
        sessionType: 'salon',
      }),
    );
    expect(rooms).toContain('branch:branch-a');
    expect(rooms).not.toContain('branch:branch-b');
    expect(rooms).not.toContain('business:business-a');
  });

  test('platform role without booking-read permission does not join platform room', () => {
    const rooms = bookingRoomsForUser(
      user({
        roles: ['MARKETING'],
        scopes: [{ code: 'MARKETING' }],
        permissions: ['promotion:manage:platform'],
        sessionType: 'admin',
      }),
    );
    expect(rooms).toEqual(['user:user-1']);
  });

  test('realtime payload excludes customer PII and internal booking data', () => {
    const dispatch = buildBookingRealtimeDispatch({
      id: 'booking-1',
      status: 'CONFIRMED',
      branchId: 'branch-a',
      branch: { business: { id: 'business-a' } },
      customer: { user: { id: 'customer-user-a' } },
      updatedAt: new Date('2026-07-15T09:00:00.000Z'),
      customerName: 'Sensitive name',
      phone: '0900000000',
      note: 'Sensitive internal note',
    } as never);

    expect(dispatch.rooms).toEqual(
      expect.arrayContaining([
        'branch:branch-a',
        'business:business-a',
        'user:customer-user-a',
        'platform',
      ]),
    );
    expect(dispatch.payload).toEqual({
      id: 'booking-1',
      status: 'CONFIRMED',
      branchId: 'branch-a',
      updatedAt: '2026-07-15T09:00:00.000Z',
    });
  });

  test('anonymous handshake is rejected before connection', async () => {
    let middleware: ((socket: any, next: (error?: Error) => void) => Promise<void>) | undefined;
    const server = { use: jest.fn((fn) => { middleware = fn; }) };
    const gateway = new SchedulerGateway(
      { verifyAsync: jest.fn() } as never,
      { validate: jest.fn() } as never,
    );
    gateway.afterInit(server as never);

    const next = jest.fn();
    await middleware?.(
      {
        id: 'anonymous-socket',
        data: {},
        handshake: { auth: {}, headers: {} },
        join: jest.fn(),
      },
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'WebSocket authentication failed' }),
    );
  });
});
