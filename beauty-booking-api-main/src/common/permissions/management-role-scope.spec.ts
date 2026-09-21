import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../decorators/current-user.decorator';
import { ServicesController } from '../../services/services.controller';
import { StaffController } from '../../staff/staff.controller';
import { PromotionsService } from '../../promotions/promotions.service';
import { VouchersAdminService } from '../../promotions/vouchers-admin.service';
import { CombosService } from '../../combos/combos.service';
import { ReviewsService } from '../../reviews/reviews.service';
import { UsersService } from '../../users/users.service';
import { LoyaltyController } from '../../loyalty/loyalty.controller';
import { OwnershipController } from '../../ownership/ownership.controller';
import { PaymentsService } from '../../payments/payments.service';
import { BusinessOnboardingService } from '../../business/business-onboarding.service';
import { MediaService } from '../../media/media.service';

const mixed: AuthUser = {
  id: 'mixed', email: 'mixed@example.test', sessionType: 'salon',
  roles: ['BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF'],
  scopes: [
    { code: 'BUSINESS_OWNER', businessId: 'owned', branchId: null },
    { code: 'RECEPTIONIST', businessId: 'other', branchId: 'counter' },
    { code: 'STAFF', businessId: 'other', branchId: 'staff-only' },
  ],
};

function fixture() {
  return {
    branch: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) => Promise.resolve({ businessId: where.id.startsWith('owned-') ? 'owned' : 'other' })),
      findMany: jest.fn().mockResolvedValue([{ id: 'owned-one' }, { id: 'owned-two' }]),
    },
    businessService: { findUniqueOrThrow: jest.fn().mockResolvedValue({ businessId: 'other' }) },
    branchServiceOffering: { findUniqueOrThrow: jest.fn().mockResolvedValue({ branchId: 'counter', branch: { businessId: 'other' } }) },
    staffProfile: { findUnique: jest.fn().mockResolvedValue({ branchId: 'staff-only', userId: 'someone-else' }) },
    promotion: { findMany: jest.fn().mockResolvedValue([]) },
    voucher: { findMany: jest.fn().mockResolvedValue([]) },
    combo: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue({ id: 'combo', branchId: 'counter' }), update: jest.fn() },
    review: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'target' }) },
    role: { findUnique: jest.fn().mockResolvedValue({ id: 'role-staff', code: 'STAFF' }) },
    userRole: { findFirst: jest.fn(), create: jest.fn() },
    payment: { findMany: jest.fn().mockResolvedValue([]) },
    financialLedgerEntry: { findMany: jest.fn().mockResolvedValue([]) },
    platformStatement: { findMany: jest.fn().mockResolvedValue([]) },
    packagePurchase: { findMany: jest.fn().mockResolvedValue([]) },
    paymentPolicy: { findMany: jest.fn() },
    treatmentPackage: { create: jest.fn() },
  };
}

describe('management scopes after retiring Manager', () => {
  it('payment lists include all owned branches plus exact counter assignments, never staff-only branches', async () => {
    const db = fixture();
    await new PaymentsService(db as never).list(mixed);
    expect(db.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { booking: { branchId: { in: ['owned-one', 'owned-two', 'counter'] } } } }));
  });

  it('ledger, statements and package-purchase lists cannot import another role business', async () => {
    const db = fixture();
    const payments = new PaymentsService(db as never);
    await expect(payments.ledger(mixed, { businessId: 'other' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(payments.ledger(mixed, { branchId: 'counter' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(payments.listPlatformStatements(mixed, 'other')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(payments.listPackagePurchases(mixed, 'other')).rejects.toBeInstanceOf(ForbiddenException);
    await payments.ledger(mixed, {});
    await payments.listPlatformStatements(mixed);
    await payments.listPackagePurchases(mixed);
    for (const delegate of [db.financialLedgerEntry, db.platformStatement, db.packagePurchase]) {
      expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ businessId: { in: ['owned'] } }) as unknown }));
    }
  });

  it('payment policy and treatment-package management require actual ownership', async () => {
    const db = fixture();
    const payments = new PaymentsService(db as never);
    await expect(payments.listPaymentPolicies(mixed, 'other')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(payments.createPaymentPolicy(mixed, { businessId: 'other' } as never)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(payments.createTreatmentPackage(mixed, { businessId: 'other' } as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.paymentPolicy.findMany).not.toHaveBeenCalled();
    expect(db.treatmentPackage.create).not.toHaveBeenCalled();
  });

  it.each(['owned-one', 'owned-two', 'counter', 'staff-only'])('checkout access is role-bound at %s', async (branchId) => {
    const booking = { id: 'booking', branchId, branch: { id: branchId, businessId: branchId.startsWith('owned-') ? 'owned' : 'other' }, customer: { userId: 'customer' }, payments: [], paymentTransactions: [], totalAmount: 100 };
    const db = { ...fixture(), booking: { findUnique: jest.fn().mockResolvedValue(booking) } };
    const result = new PaymentsService(db as never).checkoutContext('booking', mixed);
    if (branchId === 'staff-only') await expect(result).rejects.toBeInstanceOf(ForbiddenException);
    else await expect(result).resolves.toMatchObject({ summary: { totalAmount: 100 } });
  });

  it('business onboarding cannot use receptionist membership to modify another legal entity', async () => {
    const onboarding = new BusinessOnboardingService(fixture() as never, {} as never);
    await expect(onboarding.updateDraft('other', mixed, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(onboarding.submit('other', mixed)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each(['counter', 'staff-only'])('uploading branch media is rejected before filesystem writes at %s', async (branchId) => {
    const db = { branch: { findFirst: jest.fn().mockResolvedValue({ id: branchId, businessId: 'other' }), findUnique: jest.fn().mockResolvedValue({ businessId: 'other' }) } };
    const media = new MediaService(db as never, { get: () => undefined } as never);
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await expect(media.upload(mixed, { originalname: 'scope-test.png', mimetype: 'image/png', size: buffer.length, buffer }, { entityType: 'BRANCH_IMAGE', entityId: branchId })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each(['counter', 'staff-only'])('service management cannot use a branch role at %s', async (branchId) => {
    const service = { findAll: jest.fn(), create: jest.fn(), updateCatalog: jest.fn(), updateOfferingPricing: jest.fn(), createVariant: jest.fn() };
    const controller = new ServicesController(service as never, fixture() as never);
    await expect(controller.findAllForManagement(mixed, branchId)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.create({ branchId, name: 'Test', price: 100, durationMinutes: 30 }, mixed)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.updateCatalog('catalog', { name: 'Changed' }, mixed)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.updateOfferingPricing('offering', { price: 0 }, mixed)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.createVariant('offering', {}, mixed)).rejects.toBeInstanceOf(ForbiddenException);
    for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
  });

  it('service management includes all owned branches only', async () => {
    const service = { findAll: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({ id: 'service' }) };
    const controller = new ServicesController(service as never, fixture() as never);
    await controller.findAllForManagement(mixed);
    expect(service.findAll).toHaveBeenCalledWith(undefined, false, ['owned-one', 'owned-two']);
    await expect(controller.create({ branchId: 'owned-two', name: 'Test', price: 100, durationMinutes: 30 }, mixed)).resolves.toEqual({ id: 'service' });
  });

  it('staff list excludes Staff-only authority while retaining the assigned counter branch', async () => {
    const service = { findAll: jest.fn().mockResolvedValue([]) };
    const controller = new StaffController(service as never, fixture() as never, {} as never);
    await expect(controller.findAll(mixed, 'staff-only')).rejects.toBeInstanceOf(ForbiddenException);
    await controller.findAll(mixed, 'counter');
    expect(service.findAll).toHaveBeenCalledWith({ ...mixed, roles: ['BUSINESS_OWNER', 'RECEPTIONIST'], scopes: mixed.scopes.slice(0, 2) }, 'counter');
  });

  it('staff cannot read another profile or its commission through an unrelated owner role', async () => {
    const db = fixture();
    const service = { findOne: jest.fn().mockResolvedValue({ id: 'profile' }), getCommission: jest.fn().mockResolvedValue([]) };
    const controller = new StaffController(service as never, db as never, {} as never);
    await expect(controller.findOne('profile', mixed)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.getCommission('profile', undefined, undefined, mixed)).rejects.toBeInstanceOf(ForbiddenException);
    db.staffProfile.findUnique.mockResolvedValue({ branchId: 'staff-only', userId: mixed.id });
    await expect(controller.findOne('profile', mixed)).resolves.toEqual({ id: 'profile' });
    await expect(controller.getCommission('profile', undefined, undefined, mixed)).resolves.toEqual([]);
  });

  it('counter profile reads do not imply access to other employees commissions', async () => {
    const db = fixture();
    db.staffProfile.findUnique.mockResolvedValue({ branchId: 'counter', userId: 'someone-else' });
    const service = { findOne: jest.fn().mockResolvedValue({ id: 'profile' }), getCommission: jest.fn() };
    const controller = new StaffController(service as never, db as never, {} as never);
    await expect(controller.findOne('profile', mixed)).resolves.toEqual({ id: 'profile' });
    await expect(controller.getCommission('profile', undefined, undefined, mixed)).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.getCommission).not.toHaveBeenCalled();
  });

  it('staff invitations and edits require ownership of the target business', async () => {
    const service = { getBranchIdByStaff: jest.fn().mockResolvedValue('counter'), update: jest.fn() };
    const invitations = { invite: jest.fn(), list: jest.fn() };
    const controller = new StaffController(service as never, fixture() as never, invitations as never);
    await expect(controller.invite({ businessId: 'other', branchId: 'counter', staffProfileId: 'profile', roleCode: 'STAFF', email: 'new@example.test' }, mixed)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.listInvitations('other', 'counter', mixed)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.update('profile', { isBookable: false }, mixed)).rejects.toBeInstanceOf(ForbiddenException);
    expect(invitations.invite).not.toHaveBeenCalled();
    expect(invitations.list).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
  });

  it('promotion and voucher lists cannot import tenants from unrelated branch memberships', async () => {
    const db = fixture();
    const promotions = new PromotionsService(db as never);
    await promotions.findAll(mixed);
    expect(db.promotion.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null, businessLinks: { some: { businessId: { in: ['owned'] } } } } }));
    await expect(promotions.findAll(mixed, { businessId: 'other' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(promotions.findAll(mixed, { branchId: 'counter' })).rejects.toBeInstanceOf(ForbiddenException);
    await new VouchersAdminService(db as never).findAll(mixed);
    expect(db.voucher.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null, businessId: { in: ['owned'] } } }));
  });

  it('combo management limits lists and rejects edits at non-owned branches', async () => {
    const db = fixture();
    const combos = new CombosService(db as never);
    await combos.list(mixed, {});
    expect(db.combo.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null, branchId: undefined, branch: { businessId: { in: ['owned'] } } } }));
    await expect(combos.list(mixed, { branchId: 'counter' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(combos.remove('combo', mixed)).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.combo.update).not.toHaveBeenCalled();
  });

  it('review-management queries cover owned branches only', async () => {
    const db = fixture();
    const reviews = new ReviewsService(db as never, {} as never);
    await reviews.findForManagement(mixed);
    expect(db.review.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      deletedAt: null, booking: { branch: { businessId: { in: ['owned'] } }, branchId: { in: ['owned-one', 'owned-two'] } },
    } }));
    await expect(reviews.findForManagement(mixed, { branchId: 'counter' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('role assignment cannot grant a colleague a role in a non-owned business', async () => {
    const db = fixture();
    const tokens = { revokeAllForUser: jest.fn() };
    const users = new UsersService(db as never, tokens as never);
    await expect(users.assignRole('target', { roleCode: 'STAFF', businessId: 'other', branchId: 'counter' }, mixed)).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.userRole.create).not.toHaveBeenCalled();
    expect(tokens.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('loyalty configuration and financial liability require ownership', async () => {
    const loyalty = { configureRule: jest.fn().mockResolvedValue({ ok: true }) };
    const controller = new LoyaltyController(loyalty as never, fixture() as never);
    await expect(controller.configure({ businessId: 'other' }, mixed)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.liability('other', mixed)).rejects.toBeInstanceOf(ForbiddenException);
    expect(loyalty.configureRule).not.toHaveBeenCalled();
    await expect(controller.configure({ businessId: 'owned' }, mixed)).resolves.toEqual({ ok: true });
  });

  it('ownership and legal-account versions cannot be read or changed using counter membership', async () => {
    const service = { list: jest.fn().mockResolvedValue([]), versions: jest.fn(), create: jest.fn(), createLegalVersion: jest.fn(), createPayoutVersion: jest.fn() };
    const controller = new OwnershipController(service as never, fixture() as never);
    await expect(controller.list('other', mixed)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.versions('other', mixed)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.create({ businessId: 'other' }, mixed)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.legal('other', {}, mixed)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.payout('other', {}, mixed)).rejects.toBeInstanceOf(ForbiddenException);
    for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
    await expect(controller.list('owned', mixed)).resolves.toEqual([]);
  });
});
