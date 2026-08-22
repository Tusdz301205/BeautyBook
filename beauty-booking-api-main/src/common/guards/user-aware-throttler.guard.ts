import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    return req.user?.id ? `user:${req.user.id}:ip:${ip}` : `ip:${ip}`;
  }
}
