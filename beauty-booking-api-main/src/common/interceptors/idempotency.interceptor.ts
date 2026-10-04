import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import Redis from 'ioredis';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';

interface IdempotencyRecord {
  fingerprint: string;
  owner: string;
  status: 'in_flight' | 'done';
  responseStatus?: number;
  responseBody?: unknown;
}

type Reservation =
  | { kind: 'acquired'; storeKey: string; fingerprint: string; owner: string }
  | { kind: 'replay'; responseStatus: number; responseBody: unknown };

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((out, key) => {
        out[key] = stableValue((value as Record<string, unknown>)[key]);
        return out;
      }, {});
  }
  return value;
}

export function requestFingerprint(method: string, route: string, body: unknown): string {
  return createHash('sha256')
    .update(`${method.toUpperCase()}\n${route}\n${JSON.stringify(stableValue(body ?? null))}`)
    .digest('hex');
}

/**
 * Authentication and other sensitive responses are intentionally excluded:
 * access/refresh tokens must never be serialized into the shared Redis store.
 * Add a route only when replay is safe and prevents a duplicate business write.
 */
export function requiresIdempotency(method: string, route: string): boolean {
  if (method.toUpperCase() !== 'POST') return false;
  const normalized = `/${route}`.replace(/\/+/g, '/').replace(/\/$/, '');
  return [
    /^\/(?:api\/v1\/)?bookings(?:\/guest)?$/,
    /^\/(?:api\/v1\/)?bookings\/[^/]+\/(?:change-requests|refund)$/,
    /^\/(?:api\/v1\/)?payments\/collect$/,
    /^\/(?:api\/v1\/)?payments\/intents$/,
    /^\/(?:api\/v1\/)?payments\/[^/]+\/refund-requests$/,
    /^\/(?:api\/v1\/)?payments\/refunds\/[^/]+\/process$/,
    /^\/(?:api\/v1\/)?payments\/packages\/[^/]+\/purchases$/,
    /^\/(?:api\/v1\/)?payments\/package-installments\/[^/]+\/pay$/,
    /^\/(?:api\/v1\/)?payments\/package-purchases\/[^/]+\/sessions\/reserve$/,
    /^\/(?:api\/v1\/)?bookings\/[^/]+\/items$/,
    /^\/(?:api\/v1\/)?payments\/transactions\/[^/]+\/(?:verify|reverse)$/,
    /^\/(?:api\/v1\/)?payments\/platform-statements\/generate$/,
    /^\/(?:api\/v1\/)?vouchers\/[^/]+\/grant$/,
  ].some((pattern) => pattern.test(normalized));
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor, OnModuleDestroy {
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  private readonly redis: Redis | null;
  private readonly memory = new Map<string, { record: IdempotencyRecord; expiresAt: number }>();
  private readonly ttlSeconds: number;
  private readonly production: boolean;

  constructor(config: ConfigService) {
    this.ttlSeconds = Number(config.get('IDEMPOTENCY_TTL_SECONDS') ?? 86_400);
    this.production = config.get<string>('NODE_ENV') === 'production';
    const redisUrl = config.get<string>('REDIS_URL');
    this.redis = redisUrl
      ? new Redis(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: 2,
          enableOfflineQueue: false,
        })
      : null;
    this.redis?.on('error', (error) =>
      this.logger.error(`Redis idempotency error: ${error.message}`),
    );
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    const routeTemplate = req.route?.path
      ? `${req.baseUrl ?? ''}/${req.route.path}`
      : req.originalUrl?.split('?')[0] ?? req.path;
    const resourcePath = req.originalUrl?.split('?')[0] ?? routeTemplate;
    if (
      !requiresIdempotency(req.method, routeTemplate) &&
      !requiresIdempotency(req.method, resourcePath)
    ) {
      return next.handle();
    }

    const key = req.headers['idempotency-key'];
    if (!key || typeof key !== 'string') {
      throw new BadRequestException('Thiếu header Idempotency-Key (bắt buộc cho POST)');
    }
    if (key.length > 128) {
      throw new BadRequestException('Idempotency-Key quá dài (tối đa 128 ký tự)');
    }

    const actor = req.user?.id ?? req.ip ?? 'anonymous';
    // Use the concrete resource path, not the route template. Otherwise
    // /payments/A/refund and /payments/B/refund can collide under one key.
    const fingerprint = requestFingerprint(req.method, resourcePath, req.body);
    const storeKey = `idempotency:${createHash('sha256')
      .update(`${actor}:${req.method}:${resourcePath}:${key}`)
      .digest('hex')}`;

    return from(this.reserve(storeKey, fingerprint)).pipe(
      mergeMap((reservation) => {
        if (reservation.kind === 'replay') {
          if (reservation.responseStatus) res.status(reservation.responseStatus);
          return of(reservation.responseBody);
        }

        return next.handle().pipe(
          mergeMap((responseBody) =>
            from(this.complete(
                reservation.storeKey,
                reservation.fingerprint,
                reservation.owner,
                res.statusCode,
                responseBody,
              )).pipe(mergeMap(() => of(responseBody))),
          ),
          catchError((error) =>
            from(this.release(reservation.storeKey, reservation.owner)).pipe(
              mergeMap(() => throwError(() => error)),
            ),
          ),
        );
      }),
    );
  }

  private async reserve(storeKey: string, fingerprint: string): Promise<Reservation> {
    const owner = randomUUID();
    const record: IdempotencyRecord = { fingerprint, owner, status: 'in_flight' };
    if (this.redis) {
      try {
        if (this.redis.status === 'wait') await this.redis.connect();
        const acquired = await this.redis.set(
          storeKey,
          JSON.stringify(record),
          'EX',
          this.ttlSeconds,
          'NX',
        );
        if (acquired === 'OK') return { kind: 'acquired', storeKey, fingerprint, owner };
        const existingRaw = await this.redis.get(storeKey);
        // Semantic conflicts are not Redis I/O errors and must never fall back
        // to the process-local store while Redis is healthy.
        return this.resolveExisting(existingRaw, fingerprint);
      } catch (error) {
        if (error instanceof ConflictException) throw error;
        if (this.production) {
          throw new ServiceUnavailableException('Idempotency store unavailable');
        }
        this.logger.warn('Redis unavailable; using development-only in-memory idempotency');
      }
    } else if (this.production) {
      throw new ServiceUnavailableException('REDIS_URL is required for idempotency in production');
    }

    this.evictMemory();
    const existing = this.memory.get(storeKey)?.record;
    if (existing) return this.resolveExisting(JSON.stringify(existing), fingerprint);
    this.memory.set(storeKey, {
      record,
      expiresAt: Date.now() + this.ttlSeconds * 1000,
    });
    return { kind: 'acquired', storeKey, fingerprint, owner };
  }

  private resolveExisting(raw: string | null, fingerprint: string): Reservation {
    if (!raw) throw new ConflictException('Idempotency state changed, vui lòng thử lại');
    let existing: IdempotencyRecord;
    try {
      existing = JSON.parse(raw) as IdempotencyRecord;
    } catch {
      throw new ConflictException('Idempotency record không hợp lệ');
    }
    if (existing.fingerprint !== fingerprint) {
      throw new ConflictException('Idempotency-Key đã được dùng cho payload khác');
    }
    if (existing.status === 'in_flight') {
      throw new ConflictException('Request trùng đang được xử lý — vui lòng chờ');
    }
    return {
      kind: 'replay',
      responseStatus: existing.responseStatus ?? 200,
      responseBody: existing.responseBody,
    };
  }

  private async complete(
    storeKey: string,
    fingerprint: string,
    owner: string,
    responseStatus: number,
    responseBody: unknown,
  ): Promise<void> {
    const record: IdempotencyRecord = {
      fingerprint,
      owner,
      status: 'done',
      responseStatus,
      responseBody,
    };
    if (this.redis) {
      try {
        await this.redis.eval(
          "local v=redis.call('GET',KEYS[1]); if not v then return 0 end; local r=cjson.decode(v); if r.owner~=ARGV[1] or r.status~='in_flight' then return 0 end; redis.call('SET',KEYS[1],ARGV[2],'EX',ARGV[3]); return 1",
          1, storeKey, owner, JSON.stringify(record), this.ttlSeconds,
        );
        return;
      } catch (error) {
        this.logger.error(`Failed to complete idempotency record: ${(error as Error).message}`);
      }
    }
    const existing = this.memory.get(storeKey);
    if (existing?.record.owner === owner && existing.record.status === 'in_flight') {
      this.memory.set(storeKey, { record, expiresAt: Date.now() + this.ttlSeconds * 1000 });
    }
  }

  private async release(storeKey: string, owner: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.eval(
          "local v=redis.call('GET',KEYS[1]); if not v then return 0 end; local r=cjson.decode(v); if r.owner~=ARGV[1] or r.status~='in_flight' then return 0 end; return redis.call('DEL',KEYS[1])",
          1, storeKey, owner,
        );
      } catch (error) {
        this.logger.error(`Failed to release idempotency record: ${(error as Error).message}`);
      }
    }
    const existing = this.memory.get(storeKey);
    if (existing?.record.owner === owner && existing.record.status === 'in_flight') this.memory.delete(storeKey);
  }

  private evictMemory(): void {
    const now = Date.now();
    for (const [key, value] of this.memory) {
      if (value.expiresAt <= now) this.memory.delete(key);
    }
  }

  onModuleDestroy(): void {
    this.redis?.disconnect();
  }
}
