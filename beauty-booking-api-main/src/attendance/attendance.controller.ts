import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { AttendanceService } from './attendance.service';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('me/today')
  @Roles('STAFF', 'RECEPTIONIST', 'BRANCH_MANAGER')
  @RequirePermission('attendance:read:self')
  me(@CurrentUser() user: AuthUser, @Query('date') date?: string) { return this.attendance.myToday(user, date); }

  @Get('me/history')
  @Roles('STAFF', 'RECEPTIONIST', 'BRANCH_MANAGER')
  @RequirePermission('attendance:read:self')
  history(@CurrentUser() user: AuthUser, @Query('from') from?: string, @Query('to') to?: string) { return this.attendance.myHistory(user, from, to); }

  @Post('check-in')
  @Roles('STAFF', 'RECEPTIONIST', 'BRANCH_MANAGER')
  @RequirePermission('attendance:checkin:self')
  checkIn(@CurrentUser() user: AuthUser, @Body() body: { qrToken: string }, @Req() request: Request) {
    if (!body.qrToken) throw new BadRequestException('qrToken là bắt buộc');
    return this.attendance.checkIn(user, body.qrToken, { userAgent: request.headers['user-agent'], ipAddress: request.ip });
  }

  @Post('check-out')
  @Roles('STAFF', 'RECEPTIONIST', 'BRANCH_MANAGER')
  @RequirePermission('attendance:checkout:self')
  checkOut(@CurrentUser() user: AuthUser, @Body() body: { qrToken: string }, @Req() request: Request) {
    if (!body.qrToken) throw new BadRequestException('qrToken là bắt buộc');
    return this.attendance.checkOut(user, body.qrToken, { userAgent: request.headers['user-agent'], ipAddress: request.ip });
  }

  @Post('break/start')
  @Roles('STAFF', 'RECEPTIONIST', 'BRANCH_MANAGER')
  @RequirePermission('attendance:checkin:self')
  breakStart(@CurrentUser() user: AuthUser) {
    return this.attendance.breakPunch(user, 'START');
  }

  @Post('break/end')
  @Roles('STAFF', 'RECEPTIONIST', 'BRANCH_MANAGER')
  @RequirePermission('attendance:checkout:self')
  breakEnd(@CurrentUser() user: AuthUser) {
    return this.attendance.breakPunch(user, 'END');
  }

  @Get('qr/board-context')
  @Roles('RECEPTIONIST', 'BRANCH_MANAGER', 'BUSINESS_OWNER')
  @RequirePermission('attendance:qr_board:branch')
  context(@CurrentUser() user: AuthUser, @Query('branchId') branchId?: string) { return this.attendance.boardContext(user, branchId); }

  @Post('qr/generate')
  @Roles('RECEPTIONIST', 'BRANCH_MANAGER', 'BUSINESS_OWNER')
  @RequirePermission('attendance:qr_board:branch')
  generate(@CurrentUser() user: AuthUser, @Body() body: { branchId?: string; purpose?: 'CHECK_IN' | 'CHECK_OUT' | 'BOTH' }) { return this.attendance.generateQr(user, body.branchId, body.purpose); }

  @Get('branch/today')
  @Roles('BRANCH_MANAGER', 'BUSINESS_OWNER')
  @RequirePermission('attendance:read:branch', 'attendance:read:tenant')
  branch(@CurrentUser() user: AuthUser, @Query('branchId') branchId: string, @Query('date') date?: string) { if (!branchId) throw new BadRequestException('branchId là bắt buộc'); return this.attendance.branchToday(user, branchId, date); }

  @Get('tenant/report')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('attendance:read:tenant')
  report(@CurrentUser() user: AuthUser, @Query('from') from: string, @Query('to') to: string, @Query('branchId') branchId?: string) { return this.attendance.tenantReport(user, from, to, branchId); }

  @Post('exception-requests')
  @Roles('STAFF', 'RECEPTIONIST', 'BRANCH_MANAGER')
  @RequirePermission('attendance:read:self')
  createException(@CurrentUser() user: AuthUser, @Body() body: any) { return this.attendance.createException(user, body); }

  @Get('exception-requests')
  @Roles('BRANCH_MANAGER', 'BUSINESS_OWNER')
  @RequirePermission('attendance:approve_exception:branch', 'attendance:approve_exception:tenant')
  exceptions(@CurrentUser() user: AuthUser, @Query('branchId') branchId?: string, @Query('status') status?: any) { return this.attendance.listExceptions(user, branchId, status); }

  @Post('exception-requests/:id/approve')
  @Roles('BRANCH_MANAGER', 'BUSINESS_OWNER')
  @RequirePermission('attendance:approve_exception:branch', 'attendance:approve_exception:tenant')
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { reason: string }) { return this.attendance.reviewException(user, id, true, body.reason); }

  @Post('exception-requests/:id/reject')
  @Roles('BRANCH_MANAGER', 'BUSINESS_OWNER')
  @RequirePermission('attendance:approve_exception:branch', 'attendance:approve_exception:tenant')
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { reason: string }) { return this.attendance.reviewException(user, id, false, body.reason); }

  @Patch(':id/adjust')
  @Roles('BRANCH_MANAGER', 'BUSINESS_OWNER')
  @RequirePermission('attendance:adjust:branch', 'attendance:adjust:tenant')
  adjust(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) { return this.attendance.adjust(user, id, body); }

  @Post('absence/:staffId/mark')
  @Roles('BRANCH_MANAGER', 'BUSINESS_OWNER')
  @RequirePermission('attendance:mark_absent:branch', 'attendance:mark_absent:tenant')
  absent(@CurrentUser() user: AuthUser, @Param('staffId') staffId: string, @Body() body: { date: string; reason: string }) { return this.attendance.markAbsent(user, staffId, body.date, body.reason); }

  @Post(':id/restore-absent')
  @Roles('BRANCH_MANAGER', 'BUSINESS_OWNER')
  @RequirePermission('attendance:mark_absent:branch', 'attendance:mark_absent:tenant')
  restore(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { reason: string }) { return this.attendance.restoreAbsent(user, id, body.reason); }

  @Get('absence/:staffId/affected-bookings')
  @Roles('BRANCH_MANAGER', 'BUSINESS_OWNER')
  @RequirePermission('attendance:mark_absent:branch', 'attendance:mark_absent:tenant')
  affected(@CurrentUser() user: AuthUser, @Param('staffId') staffId: string, @Query('date') date: string) { return this.attendance.affectedBookings(user, staffId, date); }

  @Post('absence/:staffId/resolve-bookings/:bookingId')
  @Roles('BRANCH_MANAGER', 'BUSINESS_OWNER')
  @RequirePermission('attendance:mark_absent:branch', 'attendance:mark_absent:tenant')
  resolve(@CurrentUser() user: AuthUser, @Param('staffId') staffId: string, @Param('bookingId') bookingId: string, @Body() body: any) { return this.attendance.resolveAffectedBooking(user, staffId, bookingId, body); }
}
