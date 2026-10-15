import 'reflect-metadata';
import { BadRequestException, ForbiddenException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ServicesService } from './services.service';
import { ServicesController, UpdateServicePriceRuleActiveDto } from './services.controller';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { AUDIT_KEY } from '../common/decorators/audit.decorator';
import { REQUIRES_PERMISSION_KEY } from '../common/decorators/permission.decorator';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';

const rule = {
  id: 'rule', serviceId: 'offering', variantId: 'inactive', name: 'Existing rule',
  priority: 5, conditions: { weekdays: [1, 2] }, adjustmentType: 'PERCENTAGE',
  adjustmentValue: new Prisma.Decimal('12.5'), active: false, version: 4,
  validFrom: new Date('2026-01-01'), validTo: new Date('2026-12-31'),
  createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
};

describe('service options management', () => {
  test('lists all undeleted variants, all rules, and named dependencies for only the offering', async () => {
    const variants = ['ACTIVE', 'INACTIVE'].map((status) => ({
      id: status.toLowerCase(), serviceId: 'offering', status, deletedAt: null,
      priceType: 'FIXED', price: new Prisma.Decimal(100), maxPrice: null,
    }));
    const prisma = {
      serviceVariant: { findMany: jest.fn().mockResolvedValue(variants) },
      serviceDependency: { findMany: jest.fn().mockResolvedValue([{
        id: 'dependency', serviceId: 'offering', requiredServiceId: 'required',
        dependencyType: 'REQUIRED', ref_requiredServiceId: { id: 'required', name: 'Required service' },
      }]) },
      servicePriceRule: { findMany: jest.fn().mockResolvedValue([
        { ...rule, ref_variantId: { id: 'inactive', name: 'Inactive option' } },
        { ...rule, id: 'active-rule', active: true, variantId: null, ref_variantId: null },
      ]) },
    };
    const result = await new ServicesService(prisma as never).optionsForManagement('offering');
    expect(Object.keys(result)).toEqual(['variants', 'dependencies', 'priceRules']);
    expect(result.variants).toEqual(variants.map((variant) => ({ ...variant, price: 100, priceDisplay: '100đ' })));
    expect(prisma.serviceVariant.findMany).toHaveBeenCalledWith({
      where: { serviceId: 'offering', deletedAt: null }, orderBy: { createdAt: 'asc' },
    });
    expect(result.dependencies).toEqual([{
      id: 'dependency', serviceId: 'offering', requiredServiceId: 'required', dependencyType: 'REQUIRED',
      requiredService: { id: 'required', name: 'Required service' },
    }]);
    expect(prisma.serviceDependency.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { serviceId: 'offering' } }));
    expect(result.priceRules).toEqual([
      { ...rule, adjustmentValue: 12.5, variant: { id: 'inactive', name: 'Inactive option' } },
      { ...rule, id: 'active-rule', active: true, variantId: null, adjustmentValue: 12.5, variant: null },
    ]);
    expect(prisma.servicePriceRule.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { serviceId: 'offering' }, include: { ref_variantId: { select: { id: true, name: true } } },
    }));
  });

  test.each([true, false])('rule toggle to %s preserves all other configured fields', async (active) => {
    const update = jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...rule, ...data }));
    const result = await new ServicesService({ servicePriceRule: { update } } as never).updatePriceRuleActive('rule', { active });
    expect(update).toHaveBeenCalledWith({ where: { id: 'rule' }, data: { active } });
    expect(result).toEqual({ ...rule, active, adjustmentValue: 12.5 });
  });

  test.each([{}, { active: 'false' }, { active: null }, { active: 0 }, { active: true, conditions: {} }, { active: false, serviceId: 'foreign' }])('invalid rule payload never writes: %j', async (body) => {
    const update = jest.fn();
    await expect(new ServicesService({ servicePriceRule: { update } } as never).updatePriceRuleActive('rule', body as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  test('dependency deletion scopes both IDs, deletes only a relation, and repeats as 404', async () => {
    const deleteMany = jest.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValue({ count: 0 });
    const service = new ServicesService({ serviceDependency: { deleteMany } } as never);
    await expect(service.removeDependency('offering', 'dependency')).resolves.toEqual({ deleted: true });
    await expect(service.removeDependency('offering', 'dependency')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.removeDependency('offering', 'foreign-dependency')).rejects.toBeInstanceOf(NotFoundException);
    expect(deleteMany.mock.calls).toEqual([
      [{ where: { id: 'dependency', serviceId: 'offering' } }],
      [{ where: { id: 'dependency', serviceId: 'offering' } }],
      [{ where: { id: 'foreign-dependency', serviceId: 'offering' } }],
    ]);
  });

  test('inactive variants remain reactivateable through the existing update', async () => {
    const update = jest.fn().mockResolvedValue({ status: 'ACTIVE' });
    const service = new ServicesService({ serviceVariant: {
      findUnique: jest.fn().mockResolvedValue({ status: 'INACTIVE', deletedAt: null, priceType: 'FIXED', price: 100, maxPrice: null, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 }), update,
    } } as never);
    await service.updateVariant('inactive', { status: 'ACTIVE' });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'inactive' }, data: expect.objectContaining({ status: 'ACTIVE' }) }));
  });
});

describe('management controller access and request contract', () => {
  const owner = {
    id: 'owner', roles: ['BUSINESS_OWNER', 'STAFF', 'PLATFORM_ADMIN'], sessionType: 'salon',
    scopes: [{ code: 'BUSINESS_OWNER', businessId: 'owned-business' }, { code: 'STAFF', businessId: 'foreign-business', branchId: 'foreign-branch' }],
  } as AuthUser;
  function setup(branchId = 'owned-branch') {
    const services = { optionsForManagement: jest.fn(), updatePriceRuleActive: jest.fn(), removeDependency: jest.fn() };
    const prisma = {
      branchServiceOffering: { findUniqueOrThrow: jest.fn().mockResolvedValue({ branchId }) },
      servicePriceRule: { findUniqueOrThrow: jest.fn().mockResolvedValue({ serviceId: 'rule-offering' }) },
      branch: {
        findUnique: jest.fn().mockResolvedValue({ businessId: branchId === 'foreign-branch' ? 'foreign-business' : 'owned-business' }),
        findMany: jest.fn().mockResolvedValue([{ id: 'owned-branch' }]),
      },
    };
    return { services, prisma, controller: new ServicesController(services as never, prisma as never) };
  }
  const routes = [
    ['optionsForManagement', ':id/options/manage', 'business_service:update:tenant'],
    ['updatePriceRuleActive', 'price-rules/:ruleId', 'branch_service_offering:pricing:tenant'],
    ['removeDependency', ':id/dependencies/:dependencyId', 'business_service:update:tenant'],
  ] as const;
  test.each(routes)('%s has the exact private owner route and permission', (method, path, permission) => {
    const handler = ServicesController.prototype[method];
    expect(Reflect.getMetadata('path', handler)).toBe(path);
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(['BUSINESS_OWNER']);
    expect(Reflect.getMetadata(REQUIRES_PERMISSION_KEY, handler)).toEqual([permission]);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBeUndefined();
  });
  test('mutation audit IDs identify the rule or relation', () => {
    expect(Reflect.getMetadata(AUDIT_KEY, ServicesController.prototype.updatePriceRuleActive)).toEqual({ action: 'UPDATE', entityType: 'ServicePriceRule', idParam: 'ruleId' });
    expect(Reflect.getMetadata(AUDIT_KEY, ServicesController.prototype.removeDependency)).toEqual({ action: 'DELETE', entityType: 'ServiceDependency', idParam: 'dependencyId' });
  });
  async function invoke(controller: ServicesController, method: typeof routes[number][0], user = owner) {
    if (method === 'optionsForManagement') return controller.optionsForManagement('offering', user);
    if (method === 'updatePriceRuleActive') return controller.updatePriceRuleActive('rule', { active: false }, user);
    return controller.removeDependency('offering', 'dependency', user);
  }
  test.each(routes)('%s rejects foreign tenant IDs despite unrelated staff/admin roles', async (method) => {
    const { controller, services } = setup('foreign-branch');
    await expect(invoke(controller, method)).rejects.toBeInstanceOf(ForbiddenException);
    expect(services[method]).not.toHaveBeenCalled();
  });
  test.each(routes)('%s rejects inaccessible branches in the owned tenant', async (method) => {
    const { controller, services } = setup('other-owned-branch');
    await expect(invoke(controller, method)).rejects.toBeInstanceOf(ForbiddenException);
    expect(services[method]).not.toHaveBeenCalled();
  });
  test.each(routes)('%s rejects missing/deleted offering IDs before dispatch', async (method) => {
    const { controller, services, prisma } = setup();
    prisma.branchServiceOffering.findUniqueOrThrow.mockRejectedValue(new NotFoundException());
    await expect(invoke(controller, method)).rejects.toBeInstanceOf(NotFoundException);
    expect(services[method]).not.toHaveBeenCalled();
  });
  test('allowed routes dispatch with scoped IDs; rule branch is resolved from the rule', async () => {
    const { controller, services, prisma } = setup();
    for (const [method] of routes) await invoke(controller, method);
    expect(services.optionsForManagement).toHaveBeenCalledWith('offering');
    expect(services.updatePriceRuleActive).toHaveBeenCalledWith('rule', { active: false });
    expect(services.removeDependency).toHaveBeenCalledWith('offering', 'dependency');
    expect(prisma.servicePriceRule.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 'rule' }, select: { serviceId: true } });
    expect(prisma.branchServiceOffering.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 'rule-offering', deletedAt: null }, select: { branchId: true } });
  });
  test('missing rule IDs never update', async () => {
    const { controller, services, prisma } = setup();
    prisma.servicePriceRule.findUniqueOrThrow.mockRejectedValue(new NotFoundException());
    await expect(invoke(controller, 'updatePriceRuleActive')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.branchServiceOffering.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(services.updatePriceRuleActive).not.toHaveBeenCalled();
  });
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } });
  const metadata = { type: 'body' as const, metatype: UpdateServicePriceRuleActiveDto };
  test.each([{}, { active: 'false' }, { active: 'true' }, { active: null }, { active: 0 }, { active: [] }, { active: true, adjustmentValue: 200 }])('DTO rejects malformed or additional fields under production validation: %j', async (body) => {
    await expect(pipe.transform(body, metadata)).rejects.toBeInstanceOf(BadRequestException);
  });
  test.each([true, false])('DTO accepts JSON boolean %s', async (active) => {
    await expect(pipe.transform({ active }, metadata)).resolves.toEqual({ active });
  });
});
