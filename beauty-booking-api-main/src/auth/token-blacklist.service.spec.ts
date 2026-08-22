import { ConfigService } from '@nestjs/config';
import { TokenBlacklistService } from './token-blacklist.service';

function config(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}

describe('TokenBlacklistService production safety', () => {
  test('requires Redis in production instead of falling back to process memory', () => {
    expect(() => new TokenBlacklistService(config({ NODE_ENV: 'production' })))
      .toThrow('REDIS_URL is required for session revocation in production');
  });

  test('allows the in-memory fallback in development only', () => {
    expect(() => new TokenBlacklistService(config({ NODE_ENV: 'development' })))
      .not.toThrow();
  });
});
