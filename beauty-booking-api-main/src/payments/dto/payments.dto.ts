import { IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CollectPaymentDto {
  @IsUUID()
  bookingId!: string;

  @IsIn(['CASH', 'BANK_TRANSFER', 'MOMO', 'VNPAY', 'ZALOPAY', 'CREDIT_CARD'])
  method!: 'CASH' | 'BANK_TRANSFER' | 'MOMO' | 'VNPAY' | 'ZALOPAY' | 'CREDIT_CARD';

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  idempotencyKey?: string;

  @IsOptional()
  @IsObject()
  evidence?: Record<string, unknown>;
}

export class CreatePaymentIntentDto extends CollectPaymentDto {}

export class VerifyPaymentTransactionDto {
  @IsString()
  @MaxLength(200)
  settlementReference!: string;

  @IsObject()
  evidence!: Record<string, unknown>;
}

export class ReversePaymentTransactionDto {
  @IsString()
  @MaxLength(1000)
  reason!: string;

  @IsString()
  @MaxLength(200)
  idempotencyKey!: string;
}

export class CreatePaymentPolicyDto {
  @IsUUID()
  businessId!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsIn(['NONE', 'FIXED', 'PERCENTAGE', 'FULL_PREPAYMENT'])
  depositType!: 'NONE' | 'FIXED' | 'PERCENTAGE' | 'FULL_PREPAYMENT';

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  depositValue!: number;

  @IsBoolean()
  allowSplitPayment!: boolean;

  @IsBoolean()
  allowInstallments!: boolean;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class GeneratePlatformStatementDto {
  @IsUUID()
  businessId!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;
}

export class TransitionPlatformStatementDto {
  @IsIn(['REVIEW', 'ISSUED', 'PAID', 'OVERDUE'])
  status!: 'REVIEW' | 'ISSUED' | 'PAID' | 'OVERDUE';

  @IsString()
  @MaxLength(1000)
  reason!: string;
}

export class RequestRefundDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsString()
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsObject()
  evidence?: Record<string, unknown>;
}

export class ReviewRefundDto {
  @IsBoolean()
  approve!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ProcessRefundDto {
  @IsIn(['START', 'CONFIRM', 'FAIL'])
  action!: 'START' | 'CONFIRM' | 'FAIL';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  settlementReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  failureReason?: string;
}

export class CreateTreatmentPackageDto {
  @IsUUID()
  businessId!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  totalPrice!: number;

  @IsInt()
  @Min(1)
  @Max(100)
  sessionCount!: number;

  @IsInt()
  @Min(1)
  @Max(3650)
  validityDays!: number;
}

export class PurchaseTreatmentPackageDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsInt()
  @Min(1)
  @Max(12)
  installmentCount!: number;
}

export class PayPackageInstallmentDto {
  @IsIn(['CASH', 'BANK_TRANSFER', 'MOMO', 'VNPAY', 'ZALOPAY', 'CREDIT_CARD'])
  method!: 'CASH' | 'BANK_TRANSFER' | 'MOMO' | 'VNPAY' | 'ZALOPAY' | 'CREDIT_CARD';

  @IsString()
  @MaxLength(200)
  idempotencyKey!: string;

  @IsOptional()
  @IsObject()
  evidence?: Record<string, unknown>;
}

export class ReservePackageSessionDto {
  @IsUUID()
  bookingId!: string;

  @IsUUID()
  bookingServiceId!: string;
}
