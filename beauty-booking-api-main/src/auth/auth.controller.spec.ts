import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';

describe('AuthController refresh cookie', () => {
  const tokenResult = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    user: { id: 'user-1' },
  };
  const user: AuthUser = {
    id: 'user-1',
    email: 'customer@example.com',
    roles: ['CUSTOMER'],
    scopes: [],
    sessionType: 'customer',
    sessionId: 'session-1',
  };

  function setup(environment = 'development', secure = false, cookie?: string) {
    const authService = {
      login: jest.fn().mockResolvedValue(tokenResult),
      register: jest.fn().mockResolvedValue(tokenResult),
      refresh: jest.fn().mockResolvedValue(tokenResult),
      logout: jest.fn().mockResolvedValue({ ok: true, revokedCount: 1 }),
    };
    const config = { get: jest.fn().mockReturnValue(environment) };
    const controller = new AuthController(
      authService as unknown as AuthService,
      config as unknown as ConfigService,
    );
    const request = {
      headers: { cookie, 'user-agent': 'test-agent' },
      ip: '127.0.0.1',
      secure,
    } as unknown as Request;
    const response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    } as unknown as Response;
    return { controller, authService, request, response };
  }

  describe.each([
    { environment: 'development', https: false, expectedSecure: false },
    { environment: 'development', https: true, expectedSecure: true },
    { environment: 'production', https: false, expectedSecure: true },
    { environment: 'production', https: true, expectedSecure: true },
  ])('$environment, request.secure=$https', ({ environment, https, expectedSecure }) => {
    const expectedOptions = {
      httpOnly: true,
      secure: expectedSecure,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    };

    it.each(['login', 'register', 'refresh'] as const)(
      '%s applies the transport policy and omits the refresh token from JSON',
      async (action) => {
        const { controller, request, response } = setup(environment, https, 'bb_refresh=old-token');
        const result = action === 'login'
          ? await controller.login({ email: user.email, password: 'Password123' }, request, response)
          : action === 'register'
            ? await controller.register({ email: user.email, password: 'Password123', fullName: 'Test User' }, request, response)
            : await controller.refresh({}, request, response);

        expect(response.cookie).toHaveBeenCalledWith('bb_refresh', 'refresh-token', expectedOptions);
        expect(result).toEqual({ accessToken: 'access-token', user: { id: 'user-1' } });
        expect(result).not.toHaveProperty('refreshToken');
      },
    );

    it('logout clears the same cookie attributes without extending its lifetime', async () => {
      const { controller, authService, request, response } = setup(environment, https);
      await controller.login({ email: user.email, password: 'Password123' }, request, response);

      await expect(controller.logout(user, request, response)).resolves.toEqual({ ok: true, revokedCount: 1 });

      const { maxAge: _maxAge, ...clearOptions } = expectedOptions;
      expect(authService.logout).toHaveBeenCalledWith('user-1', 'session-1');
      expect(response.cookie).toHaveBeenCalledWith('bb_refresh', 'refresh-token', expectedOptions);
      expect(response.clearCookie).toHaveBeenCalledWith('bb_refresh', clearOptions);
    });
  });

  it('does not directly trust a forwarded protocol header when Express reports HTTP', async () => {
    const { controller, request, response } = setup();
    request.headers['x-forwarded-proto'] = 'https';

    await controller.login({ email: user.email, password: 'Password123' }, request, response);

    expect(response.cookie).toHaveBeenCalledWith(
      'bb_refresh',
      'refresh-token',
      expect.objectContaining({ secure: false }),
    );
  });

  it('decodes the refresh cookie before passing it to the token verifier', async () => {
    const { controller, authService, request, response } = setup('development', false, 'other=value; bb_refresh=token%3Dvalue');

    await controller.refresh({}, request, response);

    expect(authService.refresh).toHaveBeenCalledWith('token=value');
  });

  it('rejects malformed refresh-cookie encoding as an authentication error', async () => {
    const { controller, authService, request, response } = setup('development', false, 'bb_refresh=%E0%A4%A');

    await expect(controller.refresh({}, request, response)).rejects.toBeInstanceOf(UnauthorizedException);

    expect(authService.refresh).not.toHaveBeenCalled();
    expect(response.cookie).not.toHaveBeenCalled();
  });

  it('preserves explicit body-token precedence for API clients', async () => {
    const { controller, authService, request, response } = setup('development', false, 'bb_refresh=%E0%A4%A');

    await controller.refresh({ refreshToken: 'body-token' }, request, response);

    expect(authService.refresh).toHaveBeenCalledWith('body-token');
  });
});
