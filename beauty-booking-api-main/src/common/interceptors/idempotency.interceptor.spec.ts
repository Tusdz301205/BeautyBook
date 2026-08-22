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
    await new Promise((resolve) => setImmediate(resolve));

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
    await new Promise((resolve) => setImmediate(resolve));

    await expect(
      lastValueFrom(interceptor.intercept(context({ amount: 200 }).execution, handler)),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  test('the same key is isolated between concrete resource ids', async () => {
    const interceptor = new IdempotencyInterceptor(config);
    const handler = { handle: jest.fn(() => of({ ok: true })) } as CallHandler;
    await lastValueFrom(interceptor.intercept(
      context({ amount: 10 }, 'shared-key', '/api/v1/payments/payment-a/refund-requests').execution,
      handler,
    ));
    await new Promise((resolve) => setImmediate(resolve));
    await lastValueFrom(interceptor.intercept(
      context({ amount: 10 }, 'shared-key', '/api/v1/payments/payment-b/refund-requests').execution,
      handler,
    ));
    expect(handler.handle).toHaveBeenCalledTimes(2);
  });
});
