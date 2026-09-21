import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SavedServicesService } from './saved-services.service';

@Controller(['saved-services', 'customer/saved-services'])
@Roles('CUSTOMER')
@RequirePermission('service:read:public')
export class SavedServicesController {
  constructor(private readonly savedServices: SavedServicesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.savedServices.list(user);
  }

  @Post()
  save(@Body() body: { serviceId: string }, @CurrentUser() user: AuthUser) {
    return this.savedServices.save(user, body.serviceId);
  }

  @Post(':serviceId')
  saveByPath(@Param('serviceId') serviceId: string, @CurrentUser() user: AuthUser) {
    return this.savedServices.save(user, serviceId);
  }

  @Delete(':serviceId')
  remove(@Param('serviceId') serviceId: string, @CurrentUser() user: AuthUser) {
    return this.savedServices.remove(user, serviceId);
  }
}
