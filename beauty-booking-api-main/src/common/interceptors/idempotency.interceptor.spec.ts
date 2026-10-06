import { CallHandler, ConflictException, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom, of } from 'rxjs';
import {
  IdempotencyInterceptor,
  requestFingerprint,
  requiresIdempotency,
} from './idempotency.interceptor';

function context(body: unknown, key = 'same-key', originalUrl = '/api/v1/payments/collect') {
  const response = { statusCode: 201, status: jest.fn().mockReturnThis() };
  const request = {
    method: 'POST',
    headers: { 'idempotency-key': key },
    user: { id: 'user-1' },
    body,
    route: { path: '/collect' },
    baseUrl: '/api/v1/payments',
    originalUrl,
  };
  return {
    response,
    execution: {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as ExecutionContext,
  };
}

describe('IdempotencyInterceptor', () => {
  const config = { get: jest.fn(() => undefined) } as unknown as ConfigService;

  test('fingerprint is stable across object key order', () => {
    expect(requestFingerprint('POST', '/x', { a: 1, b: 2 })).toBe(
      requestFingerprint('POST', '/x', { b: 2, a: 1 }),
    );
  });

  test('never stores authentication responses in the idempotency store', async () => {
    expect(requiresIdempotency('POST', '/api/v1/auth/login')).toBe(false);
    expect(requiresIdempotency('POST', '/api/v1/auth/refresh')).toBe(false);

    const interceptor = new IdempotencyInterceptor(config);
    const response = { statusCode: 200, status: jest.fn().mockReturnThis() };
    const execution = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          headers: {},
          body: { email: 'admin@example.test', password: 'secret' },
          route: { path: '/login' },
          baseUrl: '/api/v1/auth',
        }),
        getResponse: () => response,
      }),
    } as ExecutionContext;
    const handler = {
      handle: jest.fn(() => of({ accessToken: 'must-not-be-cached' })),
    } as CallHandler;

    await expect(lastValueFrom(interceptor.intercept(execution, handler))).resolves.toEqual({
      accessToken: 'must-not-be-cached',
    });
    expect(handler.handle).toHaveBeenCalledTimes(1);
  });

  test('requires idempotency for financial package and settlement writes', () => {
    expect(requiresIdempotency('POST', '/api/v1/bookings')).toBe(true);
    expect(requiresIdempotency('POST', '/api/v1/bookings/guest')).toBe(true);
    expect(requiresIdempotency('POST', '/api/v1/recurring')).toBe(true);
    expect(requiresIdempotency('POST', '/api/v1/payments/packages/pkg-1/purchases')).toBe(true);
    expect(requiresIdempotency('POST', '/api/v1/payments/package-installments/i-1/pay')).toBe(true);
    expect(requiresIdempotency('POST', '/api/v1/payments/package-purchases/p-1/sessions/reserve')).toBe(true);
    expect(requiresIdempotency('POST', '/api/v1/payments/transactions/t-1/verify')).toBe(true);
    expect(requiresIdempotency('POST', '/api/v1/payments/platform-statements/generate')).toBe(true);
  });

  test('same key and same payload replays the completed response', async () => {
    const interceptor = new IdempotencyInterceptor(config);
    const first = context({ amount: 100 });
    const handler = { handle: jest.fn(() => of({ id: 'payment-1' })) } as CallHandler;
    await expect(lastValueFrom(interceptor.intercept(first.execution, handler))).resolves.toEqual({
      id: 'payment-1',
    });
    const second = context({ amount: 100 });
    await expect(lastValueFrom(interceptor.intercept(second.execution, handler))).resolves.toEqual({
      id: 'payment-1',
    });
    expect(handler.handle).toHaveBeenCalledTimes(1);
    expect(second.response.status).toHaveBeenCalledWith(201);
  });

  test('same key with a different payload is rejected', async () => {
    const interceptor = new IdempotencyInterceptor(config);
    const handler = { handle: jest.fn(() => of({ ok: true })) } as CallHandler;
    await lastValueFrom(interceptor.intercept(context({ amount: 100 }).execution, handler));
    await expect(
      lastValueFrom(interceptor.intercept(context({ amount: 200 }).execution, handler)),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  test('a recurring create retry replays the whole saved result without creating another series', async () => {
    const interceptor = new IdempotencyInterceptor(config);
    const body = { branchId: 'branch', count: 2, appointmentDate: '2026-12-01T03:00:00Z' };
    const handler = { handle: jest.fn(() => of({ id: 'series', bookings: [{ id: 'first' }, { id: 'second' }] })) } as CallHandler;
    const url = '/api/v1/recurring';
    const first = await lastValueFrom(interceptor.intercept(context(body, 'series-key', url).execution, handler));
    const replay = await lastValueFrom(interceptor.intercept(context(body, 'series-key', url).execution, handler));
    expect(replay).toEqual(first);
    expect(handler.handle).toHaveBeenCalledTimes(1);
    await expect(lastValueFrom(interceptor.intercept(context({ ...body, count: 3 }, 'series-key', url).execution, handler)))
      .rejects.toBeInstanceOf(ConflictException);
    expect(handler.handle).toHaveBeenCalledTimes(1);
  });

  test('healthy Redis in-flight conflict does not fall back to memory or run handler', async () => {
    const interceptor = new IdempotencyInterceptor(config);
    const fingerprint = requestFingerprint('POST', '/api/v1/payments/collect', { amount: 100 });
    (interceptor as any).redis = {
      status: 'ready',
      set: jest.fn().mockResolvedValue(null),
      get: jest.fn().mockResolvedValue(JSON.stringify({ fingerprint, owner: 'other', status: 'in_flight' })),
    };
    const handler = { handle: jest.fn(() => of({ ok: true })) } as CallHandler;
    await expect(lastValueFrom(interceptor.intercept(context({ amount: 100 }).execution, handler)))
      .rejects.toBeInstanceOf(ConflictException);
    expect(handler.handle).not.toHaveBeenCalled();
    expect((interceptor as any).memory.size).toBe(0);
  });

  test('completion and release compare the reservation owner inside Redis', async () => {
    const interceptor = new IdempotencyInterceptor(config);
    const evalMock = jest.fn().mockResolvedValue(0);
    (interceptor as any).redis = { eval: evalMock };
    await (interceptor as any).complete('key', 'fingerprint', 'stale-owner', 200, { ok: true });
    await (interceptor as any).release('key', 'stale-owner');
    expect(evalMock).toHaveBeenCalledTimes(2);
    expect(evalMock.mock.calls[0][0]).toContain("r.owner~=ARGV[1]");
    expect(evalMock.mock.calls[1][0]).toContain("r.owner~=ARGV[1]");
  });

  test('the same key is isolated between concrete resource ids', async () => {
    const interceptor = new IdempotencyInterceptor(config);
    const handler = { handle: jest.fn(() => of({ ok: true })) } as CallHandler;
    await lastValueFrom(interceptor.intercept(
      context({ amount: 10 }, 'shared-key', '/api/v1/payments/payment-a/refund-requests').execution,
      handler,
    ));
    await lastValueFrom(interceptor.intercept(
      context({ amount: 10 }, 'shared-key', '/api/v1/payments/payment-b/refund-requests').execution,
      handler,
    ));
    expect(handler.handle).toHaveBeenCalledTimes(2);
  });
});
