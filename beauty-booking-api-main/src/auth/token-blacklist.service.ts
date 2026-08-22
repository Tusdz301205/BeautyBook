import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Token Revocation (Security Rule 9).
 *
 * Khi khóa tài khoản (Admin khóa / Nhân viên nghỉ việc) — BẮT BUỘC đưa
 * JWT hiện tại vào blacklist để vô hiệu hóa phiên lập tức thay vì chờ hết hạn.
 *
 * Chiến lược: blacklist THEO USER (revoke-all-sessions). Lưu mốc thời gian
 * `revokedAt` cho user_id; mọi JWT có `iat` < revokedAt bị từ chối.
 * Cách này không cần lưu từng token và tự hết hạn sau JWT_EXPIRES.
 *
 * Backend: Redis (`REDIS_URL`). Nếu Redis không cấu hình, fallback in-memory
 * (đủ dùng cho single-instance dev; production BẮT BUỘC có Redis).
 */
@Injectable()
export class TokenBlacklistService implements OnModuleDestroy {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private redis: Redis | null = null;
  private readonly memoryStore = new Map<string, number>(); // userId -> revokedAt epoch(s)
  private readonly ttlSeconds: number;
  private readonly production: boolean;

  constructor(config: ConfigService) {
    // TTL = JWT lifetime; sau đó mọi token cũ tự hết hạn nên khỏi cần giữ key
    this.ttlSeconds = Number(config.get('JWT_EXPIRES_SECONDS') ?? 7 * 24 * 3600);
    this.production = config.get<string>('NODE_ENV') === 'production';

    const redisUrl = config.get<string>('REDIS_URL');
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 2,
        lazyConnect: true,
        enableOfflineQueue: !this.production,
      });
      this.redis.on('error', (err) =>
        this.logger.error(`Redis blacklist error: ${err.message}`),
      );
      void this.redis.connect().catch((err) => {
        if (this.production) {
          this.logger.error(`Không kết nối được Redis (${err.message}); session revocation fail-closed`);
        } else {
          this.logger.error(`Không kết nối được Redis (${err.message}); fallback in-memory cho development`);
          this.redis = null;
        }
      });
    } else {
      if (this.production) {
        throw new Error('REDIS_URL is required for session revocation in production');
      }
      this.logger.warn(
        'REDIS_URL chưa cấu hình — dùng in-memory blacklist (chỉ phù hợp dev)',
      );
    }
  }

  private key(userId: string): string {
    return `auth:revoked:${userId}`;
  }

  /** Vô hiệu hóa TẤT CẢ JWT hiện tại của user (khóa tài khoản, nghỉ việc, đổi mật khẩu). */
  async revokeAllForUser(userId: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    if (this.redis) {
      await this.redis.set(this.key(userId), String(now), 'EX', this.ttlSeconds);
    } else {
      this.memoryStore.set(userId, now);
    }
    this.logger.log(`Revoked all sessions for user ${userId}`);
  }

  /**
   * Token có bị thu hồi không?
   * @param iat JWT issued-at (epoch seconds)
   */
  async isRevoked(userId: string, iat?: number): Promise<boolean> {
    let revokedAt: number | null = null;
    if (this.redis) {
      const v = await this.redis.get(this.key(userId));
      revokedAt = v ? Number(v) : null;
    } else {
      revokedAt = this.memoryStore.get(userId) ?? null;
    }
    if (revokedAt === null) return false;
    // Token phát hành TRƯỚC thời điểm revoke → chết. Token mới (re-login) sống.
    return iat === undefined || iat <= revokedAt;
  }

  onModuleDestroy(): void {
    this.redis?.disconnect();
  }
}
