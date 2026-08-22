import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ConsultationService } from './consultation.service';
import {
  CreateBreakGlassGrantDto,
  CreateConsultationTemplateDto,
  CreateConsultationVersionDto,
  CreateDataSubjectRequestDto,
  CreatePrivacyExportDto,
  MarketingPreferenceDto,
  RevokeConsultationConsentDto,
  SetConsultationRequirementDto,
  SubmitConsultationDto,
} from './dto/privacy.dto';
import { PrivacyCenterService } from './privacy-center.service';

@Controller('privacy')
export class PrivacyController {
  constructor(
    private readonly consultations: ConsultationService,
    private readonly privacyCenter: PrivacyCenterService,
  ) {}

  @Get('center')
  @Roles('CUSTOMER')
  @RequirePermission('privacy_request:manage:self')
  center(@CurrentUser() user: AuthUser) {
    return this.privacyCenter.center(user);
  }

  @Get('consultations/bookings/:bookingId/requirements')
  @Roles('CUSTOMER')
  @RequirePermission('consultation:read:self')
  requirements(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.consultations.requirementsForBooking(bookingId, user);
  }

  @Get('consultations/bookings/:bookingId/status')
  @Roles('RECEPTIONIST', 'BRANCH_MANAGER')
  @RequirePermission('consultation:status:branch')
  status(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.consultations.bookingConsultationStatus(bookingId, user);
  }

  @Post('consultations/bookings/:bookingId/submissions')
  @Roles('CUSTOMER')
  @RequirePermission('consultation:submit:self')
  submit(
    @Param('bookingId') bookingId: string,
    @Body() body: SubmitConsultationDto,
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
  ) {
    return this.consultations.submit(
      bookingId,
      body,
      user,
      this.metadata(request, 'CUSTOMER_CONSULTATION_SUBMISSION'),
    );
  }

  @Get('consultations/submissions/:id')
  @Roles(
    'CUSTOMER',
    'STAFF',
    'RECEPTIONIST',
    'BRANCH_MANAGER',
    'PLATFORM_ADMIN',
    
  )
  @RequirePermission(
    'consultation:read:self',
    'consultation:read:assigned',
    'consultation:status:branch',
    'health_record:break_glass:branch',
    'health_record:break_glass:platform',
  )
  readSubmission(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
  ) {
    return this.consultations.readSubmission(
      id,
      user,
      this.metadata(request),
    );
  }

  @Post('consultations/consents/revoke')
  @Roles('CUSTOMER')
  @RequirePermission('health_record:consent:manage:self')
  revoke(
    @Body() body: RevokeConsultationConsentDto,
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
  ) {
    return this.consultations.revokeConsent(
      body,
      user,
      this.metadata(request, 'CUSTOMER_CONSENT_REVOCATION'),
    );
  }

  @Post('break-glass')
  @Roles('BRANCH_MANAGER', 'PLATFORM_ADMIN')
  @RequirePermission(
    'health_record:break_glass:branch',
    'health_record:break_glass:platform',
  )
  breakGlass(
    @Body() body: CreateBreakGlassGrantDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.consultations.createBreakGlassGrant(body, user);
  }

  @Get('consultation-templates')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission(
    'consultation:template:manage:tenant',
    'consultation:template:manage:branch',
  )
  templates(
    @Query('businessId') businessId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.consultations.listTemplates(user, businessId);
  }

  @Post('consultation-templates')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission(
    'consultation:template:manage:tenant',
    'consultation:template:manage:branch',
  )
  createTemplate(
    @Body() body: CreateConsultationTemplateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.consultations.createTemplate(body, user);
  }

  @Post('consultation-templates/:id/versions')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission(
    'consultation:template:manage:tenant',
    'consultation:template:manage:branch',
  )
  createVersion(
    @Param('id') id: string,
    @Body() body: CreateConsultationVersionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.consultations.createVersion(id, body, user);
  }

  @Post('consultation-templates/:id/versions/:versionId/publish')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission(
    'consultation:template:manage:tenant',
    'consultation:template:manage:branch',
  )
  publishVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.consultations.publishVersion(id, versionId, user);
  }

  @Put('consultation-requirements')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission(
    'consultation:template:manage:tenant',
    'consultation:template:manage:branch',
  )
  requirement(
    @Body() body: SetConsultationRequirementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.consultations.setRequirement(body, user);
  }

  @Get('consultations/aggregate')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('consultation:aggregate:tenant')
  aggregate(
    @Query('businessId') businessId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.consultations.aggregate(user, businessId);
  }

  @Post('data-requests')
  @Roles('CUSTOMER')
  @RequirePermission('privacy_request:manage:self')
  createDataRequest(
    @Body() body: CreateDataSubjectRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.privacyCenter.createDataRequest(body, user);
  }

  @Get('data-requests')
  @Roles('CUSTOMER')
  @RequirePermission('privacy_request:manage:self')
  dataRequests(@CurrentUser() user: AuthUser) {
    return this.privacyCenter.listDataRequests(user);
  }

  @Get('marketing-preferences')
  @Roles('CUSTOMER')
  @RequirePermission('marketing_preference:manage:self')
  marketingPreferences(@CurrentUser() user: AuthUser) {
    return this.privacyCenter.getMarketingPreferences(user);
  }

  @Put('marketing-preferences')
  @Roles('CUSTOMER')
  @RequirePermission('marketing_preference:manage:self')
  updateMarketingPreferences(
    @Body() body: MarketingPreferenceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.privacyCenter.updateMarketingPreferences(body, user);
  }

  @Post('exports')
  @Roles('CUSTOMER')
  @RequirePermission('privacy_request:manage:self')
  export(
    @Body() body: CreatePrivacyExportDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.privacyCenter.createExport(body, user);
  }

  @Get('exports/:id/download')
  @Roles('CUSTOMER')
  @RequirePermission('privacy_request:manage:self')
  async download(
    @Param('id') id: string,
    @Headers('x-privacy-download-token') token: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const payload = await this.privacyCenter.downloadExport(id, token, user);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="beautybook-data-${id}.json"`,
    );
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    return payload;
  }

  private metadata(request: Request, purpose?: string) {
    return {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      purpose,
    };
  }
}
