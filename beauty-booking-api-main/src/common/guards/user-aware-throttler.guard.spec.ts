import { throttleTracker } from './user-aware-throttler.guard';

describe('throttleTracker', () => {
  it('isolates login quotas by normalized account and IP', () => {
    const first = throttleTracker({
      ip: '127.0.0.1',
      originalUrl: '/api/v1/auth/login',
      body: { email: ' USER@example.com ' },
    });
    const sameAccount = throttleTracker({
      ip: '127.0.0.1',
      originalUrl: '/api/v1/auth/login',
      body: { email: 'user@example.com' },
    });
    const otherAccount = throttleTracker({
      ip: '127.0.0.1',
      originalUrl: '/api/v1/auth/login',
      body: { email: 'other@example.com' },
    });

    expect(first).toBe(sameAccount);
    expect(first).not.toBe(otherAccount);
    expect(first).not.toContain('user@example.com');
  });

  it('tracks authenticated requests by user and IP', () => {
    expect(throttleTracker({ ip: '10.0.0.7', user: { id: 'user-1' } }))
      .toBe('user:user-1:ip:10.0.0.7');
  });
});
