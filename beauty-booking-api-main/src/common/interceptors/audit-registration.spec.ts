import 'reflect-metadata';
import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { INTERCEPTORS_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import { APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { AppModule } from '../../app.module';
import { AdminController } from '../../admin/admin.controller';
import { BookingsController } from '../../bookings/bookings.controller';
import { BranchesController } from '../../branches/branches.controller';
import { PromotionsController } from '../../promotions/promotions.controller';
import { VouchersController } from '../../promotions/vouchers.controller';
import { ReviewsController } from '../../reviews/reviews.controller';
import { ServicesController } from '../../services/services.controller';
import { StaffController } from '../../staff/staff.controller';
import { UsersController } from '../../users/users.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditInterceptor } from './audit.interceptor';

type Registration = { provide?: string; useClass?: unknown };
const globalAudit = () => (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AppModule) as Registration[])
  .filter(provider => provider.provide === APP_INTERCEPTOR && provider.useClass === AuditInterceptor);
const localAudit = (controller: unknown, handler?: unknown) => [controller, handler].filter(Boolean)
  .flatMap(target => (Reflect.getMetadata(INTERCEPTORS_METADATA, target as object) ?? []) as unknown[])
  .filter(interceptor => interceptor === AuditInterceptor);

describe('production audit registration', () => {
  it('registers exactly one application audit interceptor', () => expect(globalAudit()).toHaveLength(1));

  it.each([AdminController, BookingsController, BranchesController, PromotionsController, VouchersController,
    ReviewsController, ServicesController, StaffController, UsersController])('does not register it again on %p', controller => {
    expect(localAudit(controller)).toHaveLength(0);
    for (const name of Object.getOwnPropertyNames(controller.prototype)) {
      const method = Object.getOwnPropertyDescriptor(controller.prototype, name)?.value;
      if (typeof method === 'function') expect(localAudit(undefined, method)).toHaveLength(0);
    }
  });

  for (const outcome of ['success', 'error'] as const) it(`records one ${outcome} for the composed review route`, async () => {
    const create = jest.fn().mockResolvedValue({ id: 'audit' });
    const prisma = { auditLog: { create } } as unknown as PrismaService;
    const handler = ReviewsController.prototype.create;
    const request = { user: { id: 'qa-author', roles: ['CUSTOMER'] }, params: {}, body: {}, headers: { 'x-request-id': 'qa-composition' }, ip: '127.0.0.1' };
    const context = { getClass: () => ReviewsController, getHandler: () => handler,
      switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
    const registrations = [...globalAudit(), ...localAudit(ReviewsController, handler)];
    const interceptors = registrations.map(() => new AuditInterceptor(new Reflector(), prisma));
    const failure = new Error('Controlled handler failure');
    const next = interceptors.reduceRight<CallHandler>((next, interceptor) => ({ handle: () => interceptor.intercept(context, next) }),
      { handle: () => outcome === 'success' ? of({ id: 'review' }) : throwError(() => failure) });
    if (outcome === 'success') await expect(lastValueFrom(next.handle())).resolves.toEqual({ id: 'review' });
    else await expect(lastValueFrom(next.handle())).rejects.toBe(failure);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data.newData).toMatchObject({ requestId: 'qa-composition', result: outcome });
  });

  it('does not change the committed result when audit persistence fails', async () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    try {
      const create = jest.fn().mockRejectedValue(new Error('Controlled audit outage'));
      const interceptor = new AuditInterceptor(new Reflector(), { auditLog: { create } } as unknown as PrismaService);
      const context = { getClass: () => ReviewsController, getHandler: () => ReviewsController.prototype.create,
        switchToHttp: () => ({ getRequest: () => ({ headers: {}, params: {}, body: {} }) }) } as unknown as ExecutionContext;
      await expect(lastValueFrom(interceptor.intercept(context, { handle: () => of({ id: 'review' }) }))).resolves.toEqual({ id: 'review' });
      expect(create).toHaveBeenCalledTimes(1);
    } finally { log.mockRestore(); }
  });
});
