import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHash } from 'crypto';

export function throttleTracker(req: Record<string, any>): string {
  const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  const route = String(req.originalUrl ?? req.url ?? '');
  const email = typeof req.body?.email === 'string'
    ? req.body.email.trim().toLowerCase()
    : '';

  // Login happens before authentication, so tracking only by IP makes every
  // account behind the same office/salon NAT consume one shared quota. Keep
  // the brute-force limit account-aware without storing email addresses in
  // the throttle backend.
  if (/\/auth\/login(?:[/?#]|$)/i.test(route) && email) {
    const account = createHash('sha256').update(email).digest('hex').slice(0, 24);
    return `login:${account}:ip:${ip}`;
  }

  return req.user?.id ? `user:${req.user.id}:ip:${ip}` : `ip:${ip}`;
}

@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return throttleTracker(req);
  }
}
