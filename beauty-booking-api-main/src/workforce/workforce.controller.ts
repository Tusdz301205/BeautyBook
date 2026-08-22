import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { Audited } from '../common/decorators/audit.decorator';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  ApproveTimesheetDto,
  AssignCompensationRuleDto,
  CalculateCompensationDto,
  CreateCompensationRuleDto,
  CreatePayRunDto,
  CreateTimesheetAdjustmentDto,
  GenerateTimesheetsDto,
  ReplaceAvailabilityDto,
  ReviewTimesheetAdjustmentDto,
  TransitionPayRunDto,
} from './workforce.dto';
import { WorkforceService } from './workforce.service';

@Controller('workforce')
export class WorkforceController {
  constructor(private readonly workforce: WorkforceService) {}

  @Get('availability')
  @Roles('STAFF', 'BRANCH_MANAGER', 'BUSINESS_OWNER')
  @RequirePermission('availability:read:self', 'availability:read:branch')
  availability(
    @CurrentUser() user: AuthUser,
    @Query('staffId') staffId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.workforce.listAvailability(user, staffId, branchId);
  }

  @Post('availability')
  @Roles('STAFF', 'BRANCH_MANAGER', 'BUSINESS_OWNER')
  @RequirePermission('availability:manage:self', 'availability:manage:branch', 'availability:manage:tenant')
  @Audited({ action: AuditAction.UPDATE, entityType: 'StaffAvailability' })
  replaceAvailability(@CurrentUser() user: AuthUser, @Body() body: ReplaceAvailabilityDto) {
    return this.workforce.replaceAvailability(user, body);
  }

  @Post('timesheets/generate')
  @Roles('BRANCH_MANAGER', 'BUSINESS_OWNER')
  @RequirePermission('timesheet:generate:branch', 'timesheet:generate:tenant')
  generate(@CurrentUser() user: AuthUser, @Body() body: GenerateTimesheetsDto) {
    return this.workforce.generateTimesheets(user, body);
  }

  @Get('timesheets')
  @Roles('STAFF', 'BRANCH_MANAGER', 'BUSINESS_OWNER')
  @RequirePermission('timesheet:read:self', 'timesheet:read:branch', 'timesheet:read:tenant')
  timesheets(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
    @Query('staffId') staffId?: string,
    @Query('status') status?: string,
  ) {
    return this.workforce.listTimesheets(user, { from, to, branchId, staffId, status });
  }

  @Patch('timesheets/:id/approve')
  @Roles('BRANCH_MANAGER', 'BUSINESS_OWNER')
  @RequirePermission('timesheet:review:branch', 'timesheet:review:tenant')
  approveTimesheet(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: ApproveTimesheetDto,
  ) {
    return this.workforce.approveTimesheet(user, id, body);
  }

  @Post('timesheets/:id/adjustments')
  @Roles('STAFF', 'BRANCH_MANAGER', 'BUSINESS_OWNER')
  @RequirePermission('timesheet:adjust:self', 'timesheet:review:branch', 'timesheet:review:tenant')
  createAdjustment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: CreateTimesheetAdjustmentDto,
  ) {
    return this.workforce.createTimesheetAdjustment(user, id, body);
  }

  @Patch('timesheet-adjustments/:id/review')
  @Roles('BRANCH_MANAGER', 'BUSINESS_OWNER')
  @RequirePermission('timesheet:review:branch', 'timesheet:review:tenant')
  reviewAdjustment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: ReviewTimesheetAdjustmentDto,
  ) {
    return this.workforce.reviewTimesheetAdjustment(user, id, body);
  }

  @Post('compensation/rules')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('compensation:manage:tenant')
  createRule(@CurrentUser() user: AuthUser, @Body() body: CreateCompensationRuleDto) {
    return this.workforce.createCompensationRule(user, body);
  }

  @Post('compensation/rules/:ruleId/assignments')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('compensation:manage:tenant')
  assignRule(
    @CurrentUser() user: AuthUser,
    @Param('ruleId') ruleId: string,
    @Body() body: AssignCompensationRuleDto,
  ) {
    return this.workforce.assignCompensationRule(user, ruleId, body);
  }

  @Post('compensation/calculate')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('compensation:manage:tenant')
  calculate(@CurrentUser() user: AuthUser, @Body() body: CalculateCompensationDto) {
    return this.workforce.calculateCompensation(user, body);
  }

  @Get('compensation')
  @Roles('STAFF', 'BUSINESS_OWNER')
  @RequirePermission('compensation:read:self', 'compensation:read:tenant')
  compensation(
    @CurrentUser() user: AuthUser,
    @Query('businessId') businessId?: string,
    @Query('staffId') staffId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.workforce.listCompensation(user, { businessId, staffId, from, to });
  }

  @Post('pay-runs')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('pay_run:manage:tenant')
  createPayRun(@CurrentUser() user: AuthUser, @Body() body: CreatePayRunDto) {
    return this.workforce.createPayRun(user, body);
  }

  @Get('pay-runs')
  @Roles('STAFF', 'BUSINESS_OWNER')
  @RequirePermission('pay_run:read:self', 'pay_run:manage:tenant')
  payRuns(@CurrentUser() user: AuthUser, @Query('businessId') businessId?: string) {
    return this.workforce.listPayRuns(user, businessId);
  }

  @Patch('pay-runs/:id/status')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('pay_run:manage:tenant')
  transitionPayRun(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: TransitionPayRunDto,
  ) {
    return this.workforce.transitionPayRun(user, id, body);
  }
}
