import type { PaymentProvider } from './payment-provider.port';

export class CashPaymentAdapter implements PaymentProvider {
  readonly code = 'CASH_INTERNAL';
  readonly methods = ['CASH'] as const;
  readonly requiresManualVerification = false;

  async initiate() {
    return { status: 'VERIFIED' as const };
  }
}
