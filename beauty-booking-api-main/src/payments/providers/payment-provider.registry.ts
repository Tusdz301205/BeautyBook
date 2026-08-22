import { BadRequestException, Injectable } from '@nestjs/common';
import type { PaymentMethod } from '@prisma/client';
import { CashPaymentAdapter } from './cash.adapter';
import { ManualBankTransferAdapter } from './manual-bank.adapter';
import type { PaymentProvider } from './payment-provider.port';

@Injectable()
export class PaymentProviderRegistry {
  private readonly providers: PaymentProvider[] = [
    new CashPaymentAdapter(),
    new ManualBankTransferAdapter(),
  ];

  resolve(method: PaymentMethod): PaymentProvider {
    const provider = this.providers.find((item) => item.methods.includes(method as never));
    if (!provider) {
      throw new BadRequestException(
        `${method} chưa có adapter/provider được cấu hình; hệ thống không giả lập thành công`,
      );
    }
    return provider;
  }

  capabilities() {
    return this.providers.map((provider) => ({
      code: provider.code,
      methods: provider.methods,
      requiresManualVerification: provider.requiresManualVerification,
    }));
  }
}
