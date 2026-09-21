import {
  Logger,
  OnModuleDestroy,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload, JwtStrategy } from '../auth/jwt.strategy';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { can } from '../common/utils/policy';

const LOCAL_ORIGINS = ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080'];
export const SOCKET_REAUTHORIZE_INTERVAL_MS = 15_000;
export const SOCKET_AUTHORIZATION_LEASE_MS = 30_000;
export const SOCKET_AUTHORIZATION_TIMEOUT_MS = 5_000;

interface SocketAuthorization {
  client: Socket;
  user: AuthUser;
  token: string;
  rooms: Set<string>;
  validUntil: number;
  refreshing: boolean;
  needsResync: boolean;
}

export function resolveWebSocketCorsOrigins(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const configured = (env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const origins = configured.length > 0 ? configured : LOCAL_ORIGINS;
  if (env.NODE_ENV === 'production' && origins.includes('*')) {
    throw new Error('CORS_ORIGINS must not contain "*" in production');
  }
  return origins.filter((origin) => origin !== '*');
}

export function bookingRoomsForUser(user: AuthUser): string[] {
  const rooms = new Set<string>([`user:${user.id}`]);
  const now = Date.now();

  if (can(user, 'booking:read:platform')) {
    rooms.add('platform');
  }

  for (const scope of user.scopes ?? []) {
    if (scope.expiresAt && new Date(scope.expiresAt).getTime() <= now) continue;

    if (
      scope.branchId &&
      can(user, 'booking:read:branch', {
        tenantId: scope.businessId ?? undefined,
        branchId: scope.branchId,
      })
    ) {
      rooms.add(`branch:${scope.branchId}`);
    }

    if (
      scope.businessId &&
      !scope.branchId &&
      can(user, 'booking:read:tenant', { tenantId: scope.businessId })
    ) {
      rooms.add(`business:${scope.businessId}`);
    }
  }

  return [...rooms];
}

interface BookingRealtimeSource {
  id: string;
  status?: string | null;
  branchId?: string | null;
  businessId?: string | null;
  updatedAt?: Date | string | null;
  branch?: {
    businessId?: string | null;
    business?: { id?: string | null } | null;
  } | null;
  customerUserId?: string | null;
  customer?: { user?: { id?: string | null } | null } | null;
}

export function mayReceiveBookingEvent(user: AuthUser, booking: BookingRealtimeSource): boolean {
  const customerId = booking.customerUserId ?? booking.customer?.user?.id;
  if (customerId === user.id && can(user, 'booking:read:self', { ownerId: customerId })) return true;
  if (can(user, 'booking:read:platform')) return true;
  const businessId = booking.businessId ?? booking.branch?.businessId ?? booking.branch?.business?.id;
  // Staff subscribe to branch invalidations, but details must come from the
  // assigned-bookings API; a branch room is not permission to read every booking.
  const operators = { ...user, scopes: user.scopes.filter((scope) =>
    scope.code === 'BUSINESS_OWNER' || scope.code === 'RECEPTIONIST'),
  };
  return Boolean(businessId && can(operators, 'booking:read:tenant', { tenantId: businessId })) ||
    Boolean(booking.branchId && can(operators, 'booking:read:branch', { tenantId: businessId ?? undefined, branchId: booking.branchId }));
}

interface BookingRealtimePayload {
  id: string;
  status: string | null;
  branchId: string;
  updatedAt: string | null;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function buildBookingRealtimeDispatch(booking: BookingRealtimeSource): {
  rooms: string[];
  payload: BookingRealtimePayload;
} {
  const branchId = booking.branchId ?? '';
  const businessId =
    booking.businessId ?? booking.branch?.businessId ?? booking.branch?.business?.id ?? null;
  const customerUserId = booking.customerUserId ?? booking.customer?.user?.id ?? null;
  const rooms = new Set<string>();

  if (branchId) rooms.add(`branch:${branchId}`);
  if (businessId) rooms.add(`business:${businessId}`);
  if (customerUserId) rooms.add(`user:${customerUserId}`);
  rooms.add('platform');

  return {
    rooms: [...rooms],
    payload: {
      id: booking.id,
      status: booking.status ?? null,
      branchId,
      updatedAt: toIso(booking.updatedAt),
    },
  };
}

@WebSocketGateway({
  cors: {
    origin: resolveWebSocketCorsOrigins(),
    credentials: true,
  },
})
export class SchedulerGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(SchedulerGateway.name);
  private readonly authorizations = new Map<string, SocketAuthorization>();
  private timer?: NodeJS.Timeout;
  private reauthorizing = false;

  constructor(
    private readonly jwtService: JwtService,
    private readonly jwtStrategy: JwtStrategy,
  ) {}

  afterInit(server: Server): void {
    server.use(async (client, next) => {
      try {
        const token = this.extractToken(client);
        const { user, rooms, validUntil } = await this.authorize(token);
        client.data.user = user;
        await client.join([...rooms]);
        this.authorizations.set(client.id, { client, user, token, rooms, validUntil, refreshing: false, needsResync: false });
        next();
      } catch (error) {
        this.authorizations.delete(client.id);
        this.logger.warn(`Rejected socket ${client.id}: authentication failed`);
        const authError = new Error('WebSocket authentication failed') as Error & {
          data?: { code: string };
        };
        authError.data = { code: 'WS_AUTH_FAILED' };
        next(authError);
      }
    });
    if (!this.timer) {
      this.timer = setInterval(() => void this.reauthorizeSockets(), SOCKET_REAUTHORIZE_INTERVAL_MS);
      this.timer.unref?.();
    }
  }

  handleConnection(client: Socket): void {
    const user = client.data.user as AuthUser | undefined;
    this.logger.log(`Authenticated socket connected: ${client.id} user=${user?.id ?? 'unknown'}`);
  }

  handleDisconnect(client: Socket): void {
    this.authorizations.delete(client.id);
    this.logger.log(`Socket disconnected: ${client.id}`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    for (const entry of this.authorizations.values()) entry.client.disconnect(true);
    this.authorizations.clear();
  }

  async reauthorizeSockets(): Promise<void> {
    if (this.reauthorizing) return;
    this.reauthorizing = true;
    try {
      const entries = [...this.authorizations.values()];
      // Bound simultaneous DB/session lookups. Delivery checks the lease even
      // when a delayed batch or stalled dependency prevents timely renewal.
      for (let offset = 0; offset < entries.length; offset += 20) {
        await Promise.all(entries.slice(offset, offset + 20).map((entry) => this.refreshAuthorization(entry)));
      }
    } finally {
      this.reauthorizing = false;
    }
  }

  private async authorize(token: string) {
    const startedAt = Date.now();
    let timeout: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        (async () => {
          const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
          if (!Number.isFinite(payload.exp) || payload.exp! * 1000 <= Date.now()) {
            throw new UnauthorizedException('Expired WebSocket access token');
          }
          // Reloads session revocation, blacklist, account state and role grants
          // from the same authoritative checks used by HTTP authentication.
          const user = await this.jwtStrategy.validate(payload);
          const expiries = (user.scopes ?? []).map((scope) => scope.expiresAt ? new Date(scope.expiresAt).getTime() : Infinity);
          const validUntil = Math.min(startedAt + SOCKET_AUTHORIZATION_LEASE_MS, payload.exp! * 1000, ...expiries);
          if (!Number.isFinite(validUntil) || validUntil <= Date.now()) throw new UnauthorizedException('Expired authorization');
          return { user, rooms: new Set(bookingRoomsForUser(user)), validUntil };
        })(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new UnauthorizedException('WebSocket authorization timeout')), SOCKET_AUTHORIZATION_TIMEOUT_MS);
          timeout.unref?.();
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private async refreshAuthorization(entry: SocketAuthorization): Promise<void> {
    if (this.authorizations.get(entry.client.id) !== entry || entry.refreshing) return;
    if (!entry.client.connected) { this.authorizations.delete(entry.client.id); return; }
    entry.refreshing = true;
    try {
      const fresh = await this.authorize(entry.token);
      if (this.authorizations.get(entry.client.id) !== entry || !entry.client.connected) return;
      const changed = fresh.rooms.size !== entry.rooms.size || [...entry.rooms].some((room) => !fresh.rooms.has(room));
      for (const room of entry.rooms) if (!fresh.rooms.has(room)) await entry.client.leave(room);
      await entry.client.join([...fresh.rooms]);
      // A disconnect while awaiting an adapter must not resurrect authorization.
      if (this.authorizations.get(entry.client.id) !== entry || !entry.client.connected) return;
      entry.rooms = fresh.rooms;
      entry.user = fresh.user;
      entry.validUntil = fresh.validUntil;
      entry.client.data.user = fresh.user;
      if (changed) entry.client.emit('scheduler_access_changed');
    } catch {
      if (this.authorizations.get(entry.client.id) === entry) this.rejectConnectedSocket(entry);
    } finally {
      entry.refreshing = false;
      if (entry.needsResync && this.authorizations.get(entry.client.id) === entry && entry.client.connected) {
        entry.needsResync = false;
        entry.client.emit('scheduler_resync');
      }
    }
  }

  private rejectConnectedSocket(entry: SocketAuthorization): void {
    this.authorizations.delete(entry.client.id);
    entry.client.emit('scheduler_auth_failed', { code: 'WS_AUTH_FAILED' });
    entry.client.disconnect(true);
  }

  notifyBookingUpdated(booking: BookingRealtimeSource): void {
    this.emitBookingEvent('booking_updated', booking);
  }

  notifyBookingCreated(booking: BookingRealtimeSource): void {
    this.emitBookingEvent('booking_created', booking);
  }

  notifyBookingDeleted(booking: BookingRealtimeSource): void {
    this.emitBookingEvent('booking_deleted', booking);
  }

  private extractToken(client: Socket): string {
    const authToken = client.handshake.auth?.token;
    const authorization = client.handshake.headers.authorization;
    const headerToken =
      typeof authorization === 'string' && authorization.startsWith('Bearer ')
        ? authorization.slice(7)
        : null;
    const token = typeof authToken === 'string' ? authToken : headerToken;
    if (!token) throw new UnauthorizedException('Missing WebSocket access token');
    return token;
  }

  private emitBookingEvent(
    event: 'booking_created' | 'booking_updated' | 'booking_deleted',
    booking: BookingRealtimeSource,
  ): void {
    const dispatch = buildBookingRealtimeDispatch(booking);
    if (!booking.id || !dispatch.payload.branchId) {
      this.logger.warn(`Skipped ${event}: missing booking id or branch scope`);
      return;
    }
    // Never broadcast solely by previously joined rooms: their authorization
    // can have expired while a DB recheck or the interval is delayed.
    for (const entry of this.authorizations.values()) {
      if (entry.refreshing) {
        if (dispatch.rooms.some((room) => entry.rooms.has(room))) entry.needsResync = true;
        continue;
      }
      if (entry.validUntil <= Date.now()) { this.rejectConnectedSocket(entry); continue; }
      if (entry.client.connected && dispatch.rooms.some((room) => entry.rooms.has(room))) {
        if (mayReceiveBookingEvent(entry.user, booking)) {
          entry.client.emit(event, dispatch.payload);
        } else {
          entry.client.emit('scheduler_resync');
        }
      }
    }
    this.logger.log(`Emitted ${event} for booking ${booking.id} to scoped rooms`);
  }
}
