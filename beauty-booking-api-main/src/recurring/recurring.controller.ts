import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { Audited } from '../common/decorators/audit.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { CreateRecurringPlanDto, RecurringPreviewDto, UpdateRecurringStatusDto } from './dto/recurring.dto';
import { RecurringService } from './recurring.service';

@Controller('recurring')
@Roles('CUSTOMER')
export class RecurringController {
  constructor(private readonly recurring: RecurringService) {}

  @Post('preview')
  @RequirePermission('booking:create:self')
  preview(@Body() body: RecurringPreviewDto, @CurrentUser() user: AuthUser) {
    return this.recurring.preview(body, user);
  }

  @Post()
  @RequirePermission('booking:create:self')
  @Audited({ action: AuditAction.CREATE, entityType: 'RecurringBookingPlan' })
  create(@Body() body: CreateRecurringPlanDto, @CurrentUser() user: AuthUser) {
    return this.recurring.create(body, user);
  }

  @Get('mine')
  @RequirePermission('booking:read:self')
  mine(@CurrentUser() user: AuthUser) {
    return this.recurring.mine(user);
  }

  @Patch(':id/status')
  @RequirePermission('booking:update:self')
  @Audited({ action: AuditAction.STATUS_CHANGE, entityType: 'RecurringBookingPlan' })
  status(@Param('id') id: string, @Body() body: UpdateRecurringStatusDto, @CurrentUser() user: AuthUser) {
    return this.recurring.changeStatus(id, body.status, user);
  }

  @Delete(':id/occurrences/:bookingId')
  @RequirePermission('booking:cancel:self')
  @Audited({ action: AuditAction.CANCEL, entityType: 'Booking' })
  cancelOccurrence(@Param('id') id: string, @Param('bookingId') bookingId: string, @CurrentUser() user: AuthUser) {
    return this.recurring.cancelOccurrence(id, bookingId, user);
  }

  @Delete(':id')
  @RequirePermission('booking:cancel:self')
  @Audited({ action: AuditAction.CANCEL, entityType: 'RecurringBookingPlan' })
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.recurring.cancel(id, user);
  }
}
