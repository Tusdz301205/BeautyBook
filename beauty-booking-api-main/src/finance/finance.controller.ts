import { BadRequestException, Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { assertBranchAccess, assertBusinessAccess, resolveBranchIdsForUser, resolveBusinessIdsForUser, restrictToRoles } from '../common/utils/multi-tenancy';
import { PrismaService } from '../prisma/prisma.service';
import { FinanceService } from './finance.service';

@Controller('finance-operations')
export class FinanceController {
  constructor(private readonly finance: FinanceService, private readonly prisma: PrismaService) {}

  private async counterScope(user: AuthUser) {
    const operator = restrictToRoles(user, ['BUSINESS_OWNER', 'RECEPTIONIST']);
    const businessIds = await resolveBusinessIdsForUser(this.prisma, operator);
    const branchIds = (await Promise.all(businessIds.map((businessId) =>
      resolveBranchIdsForUser(this.prisma, operator, businessId),
    ))).flatMap((ids) => ids ?? []);
    return { businessIds, branchIds };
  }

  @Post('invoices')
  @Roles('BUSINESS_OWNER', 'RECEPTIONIST')
  @RequirePermission('payment:create:tenant', 'payment:create:branch')
  async issue(@Body() body: any, @CurrentUser() user: AuthUser) {
    const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id: body.bookingId }, select: { branchId: true } });
    await assertBranchAccess(this.prisma, restrictToRoles(user, ['BUSINESS_OWNER', 'RECEPTIONIST']), booking.branchId);
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
  @Roles('BUSINESS_OWNER', 'RECEPTIONIST', 'CUSTOMER')
  @RequirePermission('payment:read:self', 'payment:read:tenant', 'payment:read:branch')
  async invoiceRequests(@CurrentUser() user: AuthUser) {
    if (user.roles.includes('CUSTOMER') && !user.roles.some((role) => ['BUSINESS_OWNER', 'RECEPTIONIST'].includes(role))) {
      const customer = await this.prisma.customerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (!customer) throw new BadRequestException('Tài khoản chưa có hồ sơ khách hàng');
      return this.finance.listInvoiceInformationRequests({ customerId: customer.id });
    }
    return this.finance.listInvoiceInformationRequests(await this.counterScope(user));
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
  @Roles('BUSINESS_OWNER')
  @RequirePermission('payment:create:tenant', 'payment:create:branch')
  async rejectInvoiceRequest(@Param('id') id: string, @Body() body: { reason: string }, @CurrentUser() user: AuthUser) {
    const request = await this.prisma.invoiceInformationRequest.findUniqueOrThrow({ where: { id }, select: { branchId: true } });
    const owner = restrictToRoles(user, ['BUSINESS_OWNER']);
    await assertBranchAccess(this.prisma, owner, request.branchId);
    return this.finance.rejectInvoiceInformationRequest(id, user.id, await resolveBusinessIdsForUser(this.prisma, owner), body.reason);
  }

  @Get('invoices')
  @Roles('BUSINESS_OWNER', 'RECEPTIONIST', 'CUSTOMER')
  @RequirePermission('payment:read:self', 'payment:read:tenant', 'payment:read:branch')
  async invoices(@CurrentUser() user: AuthUser) {
    if (user.roles.includes('CUSTOMER') && !user.roles.some((role) => ['BUSINESS_OWNER', 'RECEPTIONIST'].includes(role))) {
      const customer = await this.prisma.customerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (!customer) throw new BadRequestException('Tài khoản chưa có hồ sơ khách hàng');
      return this.finance.listInvoices({ customerId: customer.id });
    }
    return this.finance.listInvoices(await this.counterScope(user));
  }

  @Patch('invoices/:id/cancel')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('payment:create:tenant')
  async cancelInvoice(@Param('id') id: string, @Body() body: { reason: string }, @CurrentUser() user: AuthUser) {
    const invoice = await this.prisma.invoice.findUniqueOrThrow({ where: { id }, select: { businessId: true } });
    await assertBusinessAccess(this.prisma, restrictToRoles(user, ['BUSINESS_OWNER']), invoice.businessId);
    return this.finance.cancelInvoice(id, user.id, body.reason);
  }

  @Post('invoices/:id/reissue')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('payment:create:tenant')
  async reissueInvoice(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    const invoice = await this.prisma.invoice.findUniqueOrThrow({ where: { id }, select: { businessId: true } });
    await assertBusinessAccess(this.prisma, restrictToRoles(user, ['BUSINESS_OWNER']), invoice.businessId);
    return this.finance.reissueInvoice(id, user.id, {
      reason: body.reason,
      buyer: body.buyer ?? (body.buyerName || body.buyerTaxCode || body.buyerAddress
        ? { name: body.buyerName, taxCode: body.buyerTaxCode, address: body.buyerAddress, email: body.buyerEmail }
        : undefined),
    });
  }

}
