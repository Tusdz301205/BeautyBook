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

  private refreshCookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
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
      if (key === name) return decodeURIComponent(value.join('='));
    }
    return undefined;
  }

  private withRefreshCookie(response: Response, result: Awaited<ReturnType<AuthService['login']>>) {
    response.cookie('bb_refresh', result.refreshToken, this.refreshCookieOptions());
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
    return this.withRefreshCookie(response, result);
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
    return this.withRefreshCookie(response, result);
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 15 * 60_000 } })
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: { refreshToken?: string },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = body.refreshToken ?? this.readCookie(request, 'bb_refresh') ?? '';
    const result = await this.authService.refresh(token);
    response.cookie('bb_refresh', result.refreshToken, this.refreshCookieOptions());
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
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.logout(user.id, user.sessionId);
    response.clearCookie('bb_refresh', this.refreshCookieOptions());
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
