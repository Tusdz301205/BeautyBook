import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../decorators/current-user.decorator';
import { BranchesController } from '../../branches/branches.controller';
import { FinanceController } from '../../finance/finance.controller';
import { ImpactController } from '../../operations/impact.controller';
import { ReportsController } from '../../reports/reports.controller';
import { BusinessController } from '../../business/business.controller';

const mixed: AuthUser = {
  id: 'mixed-user', email: 'mixed@example.test', sessionType: 'salon',
  roles: ['BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF'],
  scopes: [
    { code: 'BUSINESS_OWNER', businessId: 'owned-business', branchId: null },
    { code: 'RECEPTIONIST', businessId: 'other-business', branchId: 'reception-branch' },
    { code: 'STAFF', businessId: 'other-business', branchId: 'staff-branch' },
  ],
};

function fixture() {
  return {
    branch: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) => Promise.resolve({
        businessId: where.id.startsWith('owned-') ? 'owned-business' : 'other-business',
      })),
      findMany: jest.fn(({ where }: { where: { businessId: string } }) => Promise.resolve(
        where.businessId === 'owned-business'
          ? [{ id: 'owned-one' }, { id: 'owned-two' }]
          : [{ id: 'reception-branch' }, { id: 'staff-branch' }],
      )),
    },
    booking: { findUniqueOrThrow: jest.fn().mockResolvedValue({ branchId: 'staff-branch' }) },
    invoice: { findUniqueOrThrow: jest.fn().mockResolvedValue({ businessId: 'other-business' }) },
    invoiceInformationRequest: { findUniqueOrThrow: jest.fn().mockResolvedValue({ branchId: 'reception-branch' }) },
    operationalImpactCase: { findUniqueOrThrow: jest.fn().mockResolvedValue({
      businessId: 'other-business', branchId: 'reception-branch',
    }) },
  };
}

describe('administrative capabilities do not combine unrelated branch roles', () => {
  it('cannot edit the booking policy of a non-owned business', async () => {
    const policies = { update: jest.fn() };
    const controller = new BusinessController(policies as never, {} as never, fixture() as never, {} as never);
    await expect(controller.updatePolicy('other-business', {}, mixed)).rejects.toBeInstanceOf(ForbiddenException);
    expect(policies.update).not.toHaveBeenCalled();
  });

  it.each(['reception-branch', 'staff-branch'])('cannot publish or onboard a non-owned branch: %s', async (branchId) => {
    const service = { publish: jest.fn(), saveOnboarding: jest.fn() };
    const controller = new BranchesController(service as never, {} as never, fixture() as never);
    await expect(controller.publish(branchId, mixed)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.saveOnboarding(branchId, {} as never, mixed)).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.publish).not.toHaveBeenCalled();
    expect(service.saveOnboarding).not.toHaveBeenCalled();
  });

  it('cannot create a branch in a business where the owner is only staff or receptionist', async () => {
    const service = { create: jest.fn() };
    const controller = new BranchesController(service as never, {} as never, fixture() as never);
    await expect(controller.create({ businessId: 'other-business' }, mixed)).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('still allows publishing a branch in the owned business', async () => {
    const service = { publish: jest.fn().mockResolvedValue({ ok: true }) };
    const controller = new BranchesController(service as never, {} as never, fixture() as never);
    await expect(controller.publish('owned-two', mixed)).resolves.toEqual({ ok: true });
    expect(service.publish).toHaveBeenCalledWith('owned-two', mixed.id);
  });

  it('does not copy services from a non-owned source or transition its status', async () => {
    const service = { copyServices: jest.fn() };
    const transitions = { transition: jest.fn() };
    const controller = new BranchesController(service as never, transitions as never, fixture() as never);
    await expect(controller.copyServices('owned-one', { sourceBranchId: 'reception-branch', serviceIds: [] }, mixed))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.transition('reception-branch', { action: 'SUSPEND', reason: 'test' } as never, mixed))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(service.copyServices).not.toHaveBeenCalled();
    expect(transitions.transition).not.toHaveBeenCalled();
  });

  it('limits operational impact lists and details to ownership', async () => {
    const impacts = { list: jest.fn().mockResolvedValue([]), detail: jest.fn() };
    const controller = new ImpactController(impacts as never, fixture() as never);
    await controller.list(mixed);
    expect(impacts.list).toHaveBeenCalledWith(['owned-business']);
    await expect(controller.detail('impact-other', mixed)).rejects.toBeInstanceOf(ForbiddenException);
    expect(impacts.detail).not.toHaveBeenCalled();
  });

  it('reports keep all owned branches and never import unrelated branch scopes', async () => {
    const reports = { getDashboardOverview: jest.fn().mockResolvedValue({}) };
    const controller = new ReportsController(reports as never, fixture() as never);
    await controller.getDashboardOverview(mixed);
    expect(reports.getDashboardOverview).toHaveBeenCalledWith({ businessIds: ['owned-business'] });
  });

  it('rejects an explicit non-owned branch before querying financial reports', async () => {
    const reports = { getFinancialSummary: jest.fn(), getOwnerDashboard: jest.fn() };
    const controller = new ReportsController(reports as never, fixture() as never);
    await expect(controller.getFinancialSummary(mixed, '2026-09-01', '2026-09-30', 'reception-branch'))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.getOwnerDashboard(mixed, 'staff-branch', '2026-09-01', '2026-09-30'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(reports.getFinancialSummary).not.toHaveBeenCalled();
    expect(reports.getOwnerDashboard).not.toHaveBeenCalled();
  });

  it('counter invoice lists include owned branches plus exact receptionist branches only', async () => {
    const finance = { listInvoices: jest.fn().mockResolvedValue([]), listInvoiceInformationRequests: jest.fn().mockResolvedValue([]) };
    const controller = new FinanceController(finance as never, fixture() as never);
    await controller.invoices(mixed);
    await controller.invoiceRequests(mixed);
    const expected = {
      businessIds: ['owned-business', 'other-business'],
      branchIds: ['owned-one', 'owned-two', 'reception-branch'],
    };
    expect(finance.listInvoices).toHaveBeenCalledWith(expected);
    expect(finance.listInvoiceInformationRequests).toHaveBeenCalledWith(expected);
  });

  it('staff-only assignment cannot issue an invoice despite receptionist role elsewhere', async () => {
    const finance = { issueInvoice: jest.fn() };
    const controller = new FinanceController(finance as never, fixture() as never);
    await expect(controller.issue({ bookingId: 'booking-other' }, mixed)).rejects.toBeInstanceOf(ForbiddenException);
    expect(finance.issueInvoice).not.toHaveBeenCalled();
  });

  it('valid receptionist can still issue an invoice in the assigned branch', async () => {
    const db = fixture();
    db.booking.findUniqueOrThrow.mockResolvedValue({ branchId: 'reception-branch' });
    const finance = { issueInvoice: jest.fn().mockResolvedValue({ ok: true }) };
    const controller = new FinanceController(finance as never, db as never);
    await expect(controller.issue({ bookingId: 'booking-own-branch' }, mixed)).resolves.toEqual({ ok: true });
  });

  it('owner-only invoice mutations cannot use receptionist membership', async () => {
    const finance = { cancelInvoice: jest.fn(), reissueInvoice: jest.fn(), rejectInvoiceInformationRequest: jest.fn() };
    const controller = new FinanceController(finance as never, fixture() as never);
    await expect(controller.cancelInvoice('invoice', { reason: 'test' }, mixed)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.reissueInvoice('invoice', { reason: 'test' }, mixed)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.rejectInvoiceRequest('request', { reason: 'test' }, mixed)).rejects.toBeInstanceOf(ForbiddenException);
    expect(finance.cancelInvoice).not.toHaveBeenCalled();
    expect(finance.reissueInvoice).not.toHaveBeenCalled();
    expect(finance.rejectInvoiceInformationRequest).not.toHaveBeenCalled();
  });
});
