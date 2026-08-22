import {
  Logger,
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
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(SchedulerGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly jwtStrategy: JwtStrategy,
  ) {}

  afterInit(server: Server): void {
    server.use(async (client, next) => {
      try {
        const token = this.extractToken(client);
        const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
        const user = await this.jwtStrategy.validate(payload);
        client.data.user = user;
        await client.join(bookingRoomsForUser(user));
        next();
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown error';
        this.logger.warn(`Rejected socket ${client.id}: ${reason}`);
        const authError = new Error('WebSocket authentication failed') as Error & {
          data?: { code: string };
        };
        authError.data = { code: 'WS_AUTH_FAILED' };
        next(authError);
      }
    });
  }

  handleConnection(client: Socket): void {
    const user = client.data.user as AuthUser | undefined;
    this.logger.log(`Authenticated socket connected: ${client.id} user=${user?.id ?? 'unknown'}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Socket disconnected: ${client.id}`);
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
    this.server.to(dispatch.rooms).emit(event, dispatch.payload);
    this.logger.log(`Emitted ${event} for booking ${booking.id} to scoped rooms`);
  }
}
