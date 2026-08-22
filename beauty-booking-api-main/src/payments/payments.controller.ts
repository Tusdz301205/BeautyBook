import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaymentsService } from './payments.service';
import {
  CollectPaymentDto,
  CreatePaymentIntentDto,
  CreatePaymentPolicyDto,
  CreateTreatmentPackageDto,
  GeneratePlatformStatementDto,
  PayPackageInstallmentDto,
  ProcessRefundDto,
  PurchaseTreatmentPackageDto,
  RequestRefundDto,
  ReservePackageSessionDto,
  ReversePaymentTransactionDto,
  ReviewRefundDto,
  TransitionPlatformStatementDto,
  VerifyPaymentTransactionDto,
} from './dto/payments.dto';
import { Audited } from '../common/decorators/audit.decorator';
import { AuditAction } from '@prisma/client';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @Roles('CUSTOMER', 'RECEPTIONIST', 'BUSINESS_OWNER', 'PLATFORM_ADMIN')
  @RequirePermission('payment:read:self', 'payment:read:branch', 'payment:read:tenant', 'payment:read:platform')
  list(@CurrentUser() user: AuthUser) {
    return this.payments.list(user);
  }

  @Post('collect')
  @Roles('RECEPTIONIST', 'BUSINESS_OWNER')
  @RequirePermission('payment:create:branch', 'payment:create:tenant')
  @Audited({ action: AuditAction.CREATE, entityType: 'Payment', idParam: 'bookingId' })
  collect(
    @Body() body: CollectPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.collect(body.bookingId, body.method, user, body);
  }

  @Get('providers')
  @Roles('CUSTOMER', 'RECEPTIONIST', 'BUSINESS_OWNER', 'PLATFORM_ADMIN')
  @RequirePermission('payment:read:self', 'payment:read:branch', 'payment:read:tenant', 'payment:read:platform')
  providerCapabilities() {
    return this.payments.providerCapabilities();
  }

  @Get('checkout/:bookingId')
  @Roles('CUSTOMER', 'RECEPTIONIST', 'BUSINESS_OWNER', 'PLATFORM_ADMIN')
  @RequirePermission('payment:read:self', 'payment:read:branch', 'payment:read:tenant', 'payment:read:platform')
  checkout(@Param('bookingId') bookingId: string, @CurrentUser() user: AuthUser) {
    return this.payments.checkoutContext(bookingId, user);
  }

  @Post('intents')
  @Roles('CUSTOMER', 'RECEPTIONIST', 'BUSINESS_OWNER')
  @RequirePermission('payment_intent:create:self', 'payment_intent:create:branch', 'payment_intent:create:tenant')
  createIntent(@Body() body: CreatePaymentIntentDto, @CurrentUser() user: AuthUser) {
    return this.payments.collect(body.bookingId, body.method, user, body);
  }

  @Post('transactions/:transactionId/verify')
  @Roles('RECEPTIONIST', 'BUSINESS_OWNER')
  @RequirePermission('payment_transaction:verify:branch', 'payment_transaction:verify:tenant')
  verifyTransaction(
    @Param('transactionId') transactionId: string,
    @Body() body: VerifyPaymentTransactionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.verifyTransaction(
      transactionId,
      body.settlementReference,
      body.evidence,
      user,
    );
  }

  @Post('transactions/:transactionId/reverse')
  @Roles('RECEPTIONIST', 'BUSINESS_OWNER', 'PLATFORM_ADMIN')
  @RequirePermission(
    'payment_transaction:verify:branch',
    'payment_transaction:verify:tenant',
    'refund:process:platform',
  )
  reverseTransaction(
    @Param('transactionId') transactionId: string,
    @Body() body: ReversePaymentTransactionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.reverseTransaction(
      transactionId,
      body.reason,
      body.idempotencyKey,
      user,
    );
  }

  @Get('policies')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('payment_policy:manage:tenant')
  policies(@Query('businessId') businessId: string, @CurrentUser() user: AuthUser) {
    return this.payments.listPaymentPolicies(user, businessId);
  }

  @Post('policies')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('payment_policy:manage:tenant')
  createPolicy(@Body() body: CreatePaymentPolicyDto, @CurrentUser() user: AuthUser) {
    return this.payments.createPaymentPolicy(user, body);
  }

  @Get('ledger')
  @Roles('BUSINESS_OWNER', 'PLATFORM_ADMIN')
  @RequirePermission('financial_ledger:read:tenant', 'financial_ledger:read:platform')
  ledger(
    @CurrentUser() user: AuthUser,
    @Query('businessId') businessId?: string,
    @Query('branchId') branchId?: string,
    @Query('bookingId') bookingId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.payments.ledger(user, { businessId, branchId, bookingId, from, to });
  }

  @Post('platform-statements/generate')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('platform_statement:manage:platform')
  generateStatement(
    @Body() body: GeneratePlatformStatementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.generatePlatformStatement(user, body);
  }

  @Get('platform-statements')
  @Roles('BUSINESS_OWNER', 'PLATFORM_ADMIN')
  @RequirePermission('platform_statement:read:tenant', 'platform_statement:manage:platform')
  statements(@CurrentUser() user: AuthUser, @Query('businessId') businessId?: string) {
    return this.payments.listPlatformStatements(user, businessId);
  }

  @Patch('platform-statements/:id/status')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('platform_statement:manage:platform')
  transitionStatement(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: TransitionPlatformStatementDto,
  ) {
    return this.payments.transitionPlatformStatement(user, id, body);
  }

  @Get('packages')
  @Roles('CUSTOMER', 'RECEPTIONIST', 'BUSINESS_OWNER')
  @RequirePermission('treatment_package:read:public')
  packages(
    @Query('businessId') businessId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.payments.listTreatmentPackages({ businessId, branchId });
  }

  @Post('packages')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('treatment_package:manage:tenant')
  @Audited({ action: AuditAction.CREATE, entityType: 'TreatmentPackage' })
  createPackage(
    @Body() body: CreateTreatmentPackageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.createTreatmentPackage(user, body);
  }

  @Post('packages/:packageId/purchases')
  @Roles('CUSTOMER', 'RECEPTIONIST', 'BUSINESS_OWNER')
  @RequirePermission(
    'package_purchase:create:self',
    'package_purchase:create:branch',
    'package_purchase:create:tenant',
  )
  purchasePackage(
    @Param('packageId') packageId: string,
    @Body() body: PurchaseTreatmentPackageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.purchaseTreatmentPackage(user, packageId, body);
  }

  @Get('package-purchases')
  @Roles('CUSTOMER', 'BUSINESS_OWNER')
  @RequirePermission('package_purchase:read:self', 'package_purchase:read:tenant')
  packagePurchases(
    @CurrentUser() user: AuthUser,
    @Query('businessId') businessId?: string,
  ) {
    return this.payments.listPackagePurchases(user, businessId);
  }

  @Post('package-installments/:installmentId/pay')
  @Roles('CUSTOMER', 'RECEPTIONIST', 'BUSINESS_OWNER')
  @RequirePermission(
    'package_purchase:create:self',
    'package_purchase:create:branch',
    'package_purchase:create:tenant',
  )
  payPackageInstallment(
    @Param('installmentId') installmentId: string,
    @Body() body: PayPackageInstallmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.payPackageInstallment(user, installmentId, body);
  }

  @Post('package-purchases/:purchaseId/sessions/reserve')
  @Roles('CUSTOMER', 'RECEPTIONIST', 'BUSINESS_OWNER')
  @RequirePermission(
    'package_purchase:create:self',
    'package_purchase:create:branch',
    'package_purchase:create:tenant',
  )
  reservePackageSession(
    @Param('purchaseId') purchaseId: string,
    @Body() body: ReservePackageSessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.reservePackageSession(user, purchaseId, body);
  }

  @Post(':paymentId/refund-requests')
  @Roles('BUSINESS_OWNER', 'PLATFORM_ADMIN')
  @RequirePermission('refund:create:tenant', 'refund:create:platform')
  @Audited({ action: AuditAction.REFUND, entityType: 'RefundRequest', idParam: 'paymentId' })
  requestRefund(
    @Param('paymentId') paymentId: string,
    @Body() body: RequestRefundDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.requestRefund(paymentId, body.amount, body.reason, body.evidence, user);
  }

  @Patch('refunds/:refundId/review')
  @Roles('BUSINESS_OWNER', 'PLATFORM_ADMIN')
  @RequirePermission('refund:approve:tenant', 'refund:approve:platform')
  @Audited({ action: AuditAction.STATUS_CHANGE, entityType: 'RefundRequest', idParam: 'refundId' })
  review(
    @Param('refundId') refundId: string,
    @Body() body: ReviewRefundDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.reviewRefund(refundId, body.approve, body.note, user);
  }

  @Post('refunds/:refundId/process')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('refund:process:platform')
  @Audited({ action: AuditAction.REFUND, entityType: 'RefundRequest', idParam: 'refundId' })
  process(
    @Param('refundId') refundId: string,
    @Body() body: ProcessRefundDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.processRefund(refundId, body, user);
  }
}
