import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateDataSubjectRequestDto, CreatePrivacyExportDto, MarketingPreferenceDto } from './dto/privacy.dto';
import { PrivacyCenterService } from './privacy-center.service';

@Controller('privacy')
export class PrivacyController {
  constructor(
    private readonly privacyCenter: PrivacyCenterService,
  ) {}

  @Get('center')
  @Roles('CUSTOMER')
  @RequirePermission('privacy_request:manage:self')
  center(@CurrentUser() user: AuthUser) {
    return this.privacyCenter.center(user);
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
}
