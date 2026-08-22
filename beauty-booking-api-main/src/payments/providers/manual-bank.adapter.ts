import type { PaymentProvider } from './payment-provider.port';

export class ManualBankTransferAdapter implements PaymentProvider {
  readonly code = 'MANUAL_BANK_TRANSFER';
  readonly methods = ['BANK_TRANSFER'] as const;
  readonly requiresManualVerification = true;

  async initiate(input: { intentId: string }) {
    return {
      status: 'PENDING' as const,
      providerReference: `BB-BANK-${input.intentId.slice(0, 8).toUpperCase()}`,
      instructions: {
        verificationRequired: true,
        message: 'Giao dịch chỉ được ghi nhận sau khi nhân sự có quyền xác minh chứng từ.',
      },
    };
  }
}
