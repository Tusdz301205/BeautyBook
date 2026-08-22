import type { PaymentMethod } from '@prisma/client';

export interface ProviderInitiation {
  providerReference?: string;
  status: 'PENDING' | 'VERIFIED';
  instructions?: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly code: string;
  readonly methods: readonly PaymentMethod[];
  readonly requiresManualVerification: boolean;
  initiate(input: {
    intentId: string;
    amount: number;
    currency: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  }): Promise<ProviderInitiation>;
}
