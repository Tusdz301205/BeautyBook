import { Module } from '@nestjs/common';
import { PrivacyCenterService } from './privacy-center.service';
import { PrivacyController } from './privacy.controller';
import { SensitiveDataCipherService } from './sensitive-data-cipher.service';

@Module({
  controllers: [PrivacyController],
  providers: [
    SensitiveDataCipherService,
    PrivacyCenterService,
  ],
  exports: [
    SensitiveDataCipherService,
    PrivacyCenterService,
  ],
})
export class PrivacyModule {}
