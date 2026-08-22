import { Module } from '@nestjs/common';
import { ConsultationService } from './consultation.service';
import { PrivacyCenterService } from './privacy-center.service';
import { PrivacyController } from './privacy.controller';
import { SensitiveDataCipherService } from './sensitive-data-cipher.service';

@Module({
  controllers: [PrivacyController],
  providers: [
    SensitiveDataCipherService,
    ConsultationService,
    PrivacyCenterService,
  ],
  exports: [
    SensitiveDataCipherService,
    ConsultationService,
    PrivacyCenterService,
  ],
})
export class PrivacyModule {}
