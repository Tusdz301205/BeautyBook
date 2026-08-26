import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { assertBranchAccess, assertBusinessAccess, resolveBranchIdsForUser, resolveBusinessIdsForUser } from '../common/utils/multi-tenancy';
import { PrismaService } from '../prisma/prisma.service';
import { FinanceService } from './finance.service';

@Controller('finance-operations')
export class FinanceController {
  constructor(private readonly finance: FinanceService, private readonly prisma: PrismaService) {}

  @Post('invoices')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST')
  @RequirePermission('payment:create:tenant', 'payment:create:branch')
  async issue(@Body() body: any, @CurrentUser() user: AuthUser) {
    const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id: body.bookingId }, select: { branchId: true } });
    await assertBranchAccess(this.prisma, user, booking.branchId);
    return this.finance.issueInvoice(body.bookingId, user.id, {
      ...body,
      buyer: body.buyer ?? (body.buyerName || body.buyerTaxCode || body.buyerAddress
        ? { name: body.buyerName, taxCode: body.buyerTaxCode, address: body.buyerAddress, email: body.buyerEmail }
        : undefined),
    });
  }

  @Post('invoice-requests')
  @Roles('CUSTOMER')
  @RequirePermission('payment:read:self')
  async requestInvoice(@Body() body: any, @CurrentUser() user: AuthUser) {
    const customer = await this.prisma.customerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!customer) throw new BadRequestException('Tài khoản chưa có hồ sơ khách hàng');
    return this.finance.requestInvoiceInformation(customer.id, body);
  }

  @Get('invoice-requests')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST', 'CUSTOMER')
  @RequirePermission('payment:read:self', 'payment:read:tenant', 'payment:read:branch')
  async invoiceRequests(@CurrentUser() user: AuthUser) {
    if (user.roles.includes('CUSTOMER') && !user.roles.some((role) => ['BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST'].includes(role))) {
      const customer = await this.prisma.customerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (!customer) throw new BadRequestException('Tài khoản chưa có hồ sơ khách hàng');
      return this.finance.listInvoiceInformationRequests({ customerId: customer.id });
    }
    const businessIds = await resolveBusinessIdsForUser(this.prisma, user);
    const branchIds = user.roles.includes('BUSINESS_OWNER')
      ? undefined
      : (await Promise.all(businessIds.map((businessId) => resolveBranchIdsForUser(this.prisma, user, businessId))))
          .flatMap((ids) => ids ?? []);
    return this.finance.listInvoiceInformationRequests({ businessIds, branchIds });
  }

  @Patch('invoice-requests/:id/cancel')
  @Roles('CUSTOMER')
  @RequirePermission('payment:read:self')
  async cancelInvoiceRequest(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const customer = await this.prisma.customerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!customer) throw new BadRequestException('Tài khoản chưa có hồ sơ khách hàng');
    return this.finance.cancelInvoiceInformationRequest(id, customer.id);
  }

  @Patch('invoice-requests/:id/reject')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('payment:create:tenant', 'payment:create:branch')
  async rejectInvoiceRequest(@Param('id') id: string, @Body() body: { reason: string }, @CurrentUser() user: AuthUser) {
    const request = await this.prisma.invoiceInformationRequest.findUniqueOrThrow({ where: { id }, select: { branchId: true } });
    await assertBranchAccess(this.prisma, user, request.branchId);
    return this.finance.rejectInvoiceInformationRequest(id, user.id, await resolveBusinessIdsForUser(this.prisma, user), body.reason);
  }

  @Get('invoices')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST', 'CUSTOMER')
  @RequirePermission('payment:read:self', 'payment:read:tenant', 'payment:read:branch')
  async invoices(@CurrentUser() user: AuthUser) {
    if (user.roles.includes('CUSTOMER') && !user.roles.some((role) => ['BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST'].includes(role))) {
      const customer = await this.prisma.customerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (!customer) throw new BadRequestException('Tài khoản chưa có hồ sơ khách hàng');
      return this.finance.listInvoices({ customerId: customer.id });
    }
    const businessIds = await resolveBusinessIdsForUser(this.prisma, user);
    const branchIds = user.roles.includes('BUSINESS_OWNER')
      ? undefined
      : (await Promise.all(businessIds.map((businessId) => resolveBranchIdsForUser(this.prisma, user, businessId))))
          .flatMap((ids) => ids ?? []);
    return this.finance.listInvoices({ businessIds, branchIds });
  }

  @Patch('invoices/:id/cancel')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('payment:create:tenant')
  async cancelInvoice(@Param('id') id: string, @Body() body: { reason: string }, @CurrentUser() user: AuthUser) {
    const invoice = await this.prisma.invoice.findUniqueOrThrow({ where: { id }, select: { businessId: true } });
    await assertBusinessAccess(this.prisma, user, invoice.businessId);
    return this.finance.cancelInvoice(id, user.id, body.reason);
  }

  @Post('invoices/:id/reissue')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('payment:create:tenant')
  async reissueInvoice(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    const invoice = await this.prisma.invoice.findUniqueOrThrow({ where: { id }, select: { businessId: true } });
    await assertBusinessAccess(this.prisma, user, invoice.businessId);
    return this.finance.reissueInvoice(id, user.id, {
      reason: body.reason,
      buyer: body.buyer ?? (body.buyerName || body.buyerTaxCode || body.buyerAddress
        ? { name: body.buyerName, taxCode: body.buyerTaxCode, address: body.buyerAddress, email: body.buyerEmail }
        : undefined),
    });
  }

  @Post('cash-shifts')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST')
  @RequirePermission('payment:create:branch', 'payment:create:tenant')
  async open(@Body() body: { branchId: string; openingBalance: number }, @CurrentUser() user: AuthUser) {
    await assertBranchAccess(this.prisma, user, body.branchId);
    return this.finance.openShift(body.branchId, user.id, body.openingBalance);
  }

  @Get('cash-shifts')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST')
  @RequirePermission('payment:read:branch', 'payment:read:tenant')
  async shifts(@Query('branchId') branchId: string | undefined, @CurrentUser() user: AuthUser) {
    if (branchId) {
      await assertBranchAccess(this.prisma, user, branchId);
      return this.finance.listShifts([branchId]);
    }
    const businessIds = await resolveBusinessIdsForUser(this.prisma, user);
    const branches = await this.prisma.branch.findMany({
      where: { businessId: { in: businessIds }, deletedAt: null },
      select: { id: true },
    });
    return this.finance.listShifts(branches.map((branch) => branch.id));
  }

  @Post('cash-shifts/:id/movements')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST')
  @RequirePermission('payment:create:branch', 'payment:create:tenant')
  async movement(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    const shift = await this.prisma.cashShift.findUniqueOrThrow({ where: { id }, select: { branchId: true } });
    await assertBranchAccess(this.prisma, user, shift.branchId);
    return this.finance.addCashMovement(id, user.id, body);
  }

  @Patch('cash-shifts/:id/close')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST')
  @RequirePermission('payment:create:branch', 'payment:create:tenant')
  async close(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    const shift = await this.prisma.cashShift.findUniqueOrThrow({ where: { id }, select: { branchId: true } });
    await assertBranchAccess(this.prisma, user, shift.branchId);
    return this.finance.closeShift(id, user.id, body);
  }

  @Patch('cash-shifts/:id/approve')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('payment:create:branch', 'payment:create:tenant')
  async approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const shift = await this.prisma.cashShift.findUniqueOrThrow({ where: { id }, select: { branchId: true } });
    await assertBranchAccess(this.prisma, user, shift.branchId);
    return this.finance.approveShift(id, user.id);
  }

  @Get('cash-shifts/:id')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST')
  @RequirePermission('payment:read:branch', 'payment:read:tenant')
  async shift(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const shift = await this.prisma.cashShift.findUniqueOrThrow({ where: { id }, select: { branchId: true } });
    await assertBranchAccess(this.prisma, user, shift.branchId);
    return this.finance.shiftDetail(id);
  }
}
