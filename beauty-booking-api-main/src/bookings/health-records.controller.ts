import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { HealthRecordsService } from './health-records.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { Audited } from '../common/decorators/audit.decorator';
import { AuditInterceptor } from '../common/interceptors/audit.interceptor';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { SensitiveDataField, ConsentScope, AuditAction } from '@prisma/client';
import type { Request } from 'express';

/**
 * Endpoints tied to PDPA-sensitive data. Layered:
 *   1. JwtAuthGuard (authN)
 *   2. RolesGuard (role coarse)
 *   3. PolicyGuard / RequirePermission (perm coarse)
 *   4. Service-level `assertCanRead` (ownership + scope)
 *   5. AuditInterceptor (append-only log of sensitive access)
 */
@Controller('health-records')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
export class HealthRecordsController {
  constructor(private readonly service: HealthRecordsService) {}

  @Get('consent')
  @Roles('CUSTOMER')
  @RequirePermission('health_record:consent:manage:self')
  listConsents(@CurrentUser() user: AuthUser) {
    return this.service.listConsents(user);
  }

  /**
   * Customer creates their own health record for a booking. Requires
   * `health_record:create:self` and an un-revoked consent for the field.
   */
  @Post()
  @Roles('CUSTOMER', 'STAFF')
  @RequirePermission('health_record:create:self', 'health_record:create:branch')
  @Audited({
    action: AuditAction.CREATE,
    entityType: 'BookingHealthRecord',
    note: 'PDPA sensitive data',
  })
  async create(
    @Body()
    body: {
      bookingId: string;
      field: SensitiveDataField;
      payload: Record<string, unknown>;
    },
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.create(user, body.bookingId, body.field, body.payload);
  }

  /** Read a single record (masked for callers without read perm). */
  @Get(':id')
  @Roles('CUSTOMER', 'STAFF', 'BRANCH_MANAGER', 'PLATFORM_ADMIN')
  @RequirePermission(
    'health_record:read:self',
    'health_record:read:branch',
    'health_record:break_glass:branch',
    'health_record:break_glass:platform',
  )
  async read(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
  ) {
    return this.service.read(user, id, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  /** List records for a booking. */
  @Get('by-booking/:bookingId')
  @Roles('CUSTOMER', 'STAFF', 'BRANCH_MANAGER', 'PLATFORM_ADMIN')
  @RequirePermission(
    'health_record:read:self',
    'health_record:read:branch',
    'health_record:break_glass:branch',
    'health_record:break_glass:platform',
  )
  async listForBooking(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
  ) {
    return this.service.listForBooking(user, bookingId, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  /** Hard-delete (right to erasure). Platforms only. */
  @Delete(':id')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('health_record:delete:sensitive')
  @Audited({
    action: AuditAction.DELETE,
    entityType: 'BookingHealthRecord',
    note: 'PDPA right-to-erasure',
  })
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.hardDelete(user, id);
  }

  /** Consent grants. */
  @Post('consent/grant')
  @Roles('CUSTOMER')
  @RequirePermission('health_record:consent:manage:self')
  @Audited({ action: AuditAction.CREATE, entityType: 'SensitiveConsent' })
  async grantConsent(
    @Body() body: { scope: ConsentScope },
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.grantConsent(user, body.scope);
  }

  @Post('consent/revoke')
  @Roles('CUSTOMER')
  @RequirePermission('health_record:consent:manage:self')
  @Audited({ action: AuditAction.UPDATE, entityType: 'SensitiveConsent' })
  async revokeConsent(
    @Body() body: { scope: ConsentScope },
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.revokeConsent(user, body.scope);
  }
}
