import { Module } from '@nestjs/common';
import { SavedServicesController } from './saved-services.controller';
import { SavedServicesService } from './saved-services.service';

@Module({ controllers: [SavedServicesController], providers: [SavedServicesService] })
export class SavedServicesModule {}
