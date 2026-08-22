import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /api/notifications
   * Lấy thông báo của user hiện tại (phân trang).
   */
  @Get()
  @RequirePermission('notification:read:self')
  findMy(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('state') state?: 'all' | 'unread' | 'read',
    @Query('type') type?: string,
    @Query('severity') severity?: string,
    @Query('search') search?: string,
  ) {
    return this.notificationsService.findByUser(user.id, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      unreadOnly: unreadOnly === 'true',
      state,
      type,
      severity,
      search,
    });
  }

  /**
   * GET /api/notifications/unread-count
   * Đếm thông báo chưa đọc.
   */
  @Get('unread-count')
  @RequirePermission('notification:read:self')
  getUnreadCount(@CurrentUser() user: AuthUser) {
    return this.notificationsService.getUnreadCount(user.id).then((count) => ({ count }));
  }

  /**
   * PATCH /api/notifications/:id/read
   * Đánh dấu 1 thông báo đã đọc.
   */
  @Patch(':id/read')
  @RequirePermission('notification:read:self')
  markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notificationsService.markAsRead(id, user.id);
  }

  /**
   * Patch /api/notifications/read-all
   * Đánh dấu tất cả đã đọc.
   */
  @Patch('read-all')
  @RequirePermission('notification:read:self')
  markAllAsRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  /**
   * POST /api/notifications/device-token
   * Đăng ký device token cho push notification.
   */
  @Post('device-token')
  registerDeviceToken(
    @CurrentUser() user: AuthUser,
    @Body() body: { token: string; platform: 'IOS' | 'ANDROID' | 'WEB' },
  ) {
    if (!body.token || !body.platform) {
      throw new BadRequestException('token và platform là bắt buộc');
    }
    return this.notificationsService.registerDeviceToken(
      user.id,
      body.token,
      body.platform,
    );
  }

  /**
   * POST /api/notifications/device-token/remove
   * Xóa device token (đăng xuất).
   */
  @Post('device-token/remove')
  removeDeviceToken(@Body() body: { token: string }) {
    if (!body.token) {
      throw new BadRequestException('token là bắt buộc');
    }
    return this.notificationsService.removeDeviceToken(body.token);
  }
}
