import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Get,
  Delete,
  Param,
  Req,
  Res,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private refreshCookieOptions(request: Request) {
    return {
      httpOnly: true,
      // Express applies the configured trust-proxy boundary to request.secure.
      secure: this.config.get<string>('NODE_ENV') === 'production' || request.secure,
      sameSite: 'lax' as const,
      path: '/api/v1/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    };
  }

  private readCookie(request: Request, name: string): string | undefined {
    const raw = request.headers.cookie;
    if (!raw) return undefined;
    for (const part of raw.split(';')) {
      const [key, ...value] = part.trim().split('=');
      if (key === name) {
        try {
          return decodeURIComponent(value.join('='));
        } catch {
          throw new UnauthorizedException('Refresh token không hợp lệ');
        }
      }
    }
    return undefined;
  }

  private withRefreshCookie(request: Request, response: Response, result: Awaited<ReturnType<AuthService['login']>>) {
    response.cookie('bb_refresh', result.refreshToken, this.refreshCookieOptions(request));
    const { refreshToken: _refreshToken, ...safeResult } = result;
    return safeResult;
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(
      body.email,
      body.password,
      {
        workspace: body.workspace,
        businessId: body.businessId,
        branchId: body.branchId,
      },
      {
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
      },
    );
    return this.withRefreshCookie(request, response, result);
  }

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() body: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(body, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    });
    return this.withRefreshCookie(request, response, result);
  }

  @Public()
  @Post('refresh')
  // Refresh requires a valid rotating HttpOnly token, so it is not a password
  // guessing surface. Keep a bounded limit, but allow normal reloads, multiple
  // tabs and browser-driven regression suites without invalidating sessions.
  @Throttle({ default: { limit: 120, ttl: 15 * 60_000 } })
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: { refreshToken?: string },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = body.refreshToken ?? this.readCookie(request, 'bb_refresh') ?? '';
    const result = await this.authService.refresh(token);
    response.cookie('bb_refresh', result.refreshToken, this.refreshCookieOptions(request));
    const { refreshToken: _refreshToken, ...safeResult } = result;
    return safeResult;
  }

  @Public()
  @Post('verify-email')
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  verifyEmail(@Body() body: VerifyEmailDto) {
    return this.authService.verifyEmail(body.token);
  }

  @Public()
  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body.email);
  }

  @Public()
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.logout(user.id, user.sessionId);
    // Cookie identity and security attributes match issuance, without a new TTL.
    const { maxAge: _maxAge, ...clearOptions } = this.refreshCookieOptions(request);
    response.clearCookie('bb_refresh', clearOptions);
    return result;
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      user.id,
      body.currentPassword,
      body.newPassword,
      user.sessionId,
    );
  }

  @Get('sessions')
  sessions(@CurrentUser() user: AuthUser) {
    return this.authService.listSessions(user.id, user.sessionId);
  }

  @Delete('sessions/:sessionId')
  revokeSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    if (sessionId === user.sessionId) throw new BadRequestException('Không thể thu hồi phiên đang sử dụng. Hãy đăng xuất thay thế.');
    return this.authService.revokeSession(user.id, sessionId, user.id);
  }

  @Delete('sessions')
  revokeOtherSessions(@CurrentUser() user: AuthUser) {
    return this.authService.revokeOtherSessions(user.id, user.sessionId);
  }

  @Get('security-history')
  securityHistory(@CurrentUser() user: AuthUser) {
    return this.authService.securityHistory(user.id);
  }
}
