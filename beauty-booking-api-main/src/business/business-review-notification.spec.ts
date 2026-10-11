import { BusinessOnboardingService } from './business-onboarding.service';
import { ConflictException } from '@nestjs/common';

describe('business review notification uses the same transaction',()=>{
  test.each(['APPROVE','REQUEST_INFO','REJECT'] as const)('%s queues one deduplicated owner result',async decision=>{
    const business={id:'b',name:'QA business',status:'PENDING_REVIEW',updatedAt:new Date(),owner:{userId:'owner',user:{isActive:true,deletedAt:null}},documents:[]};
    const create=jest.fn();const tx:any={business:{updateMany:jest.fn().mockResolvedValue({count:1}),findUniqueOrThrow:jest.fn().mockResolvedValue({id:'b'})},businessReviewEvent:{create:jest.fn().mockResolvedValue({id:'event'})},userRole:{findMany:jest.fn().mockResolvedValue([{userId:'owner'},{userId:'owner'}])},notificationOutbox:{create}};
    const prisma:any={business:{findUnique:jest.fn().mockResolvedValue(business)},auditLog:{create:jest.fn()},$transaction:jest.fn(fn=>fn(tx))};
    await new BusinessOnboardingService(prisma,{} as never).review('b',decision,'QA reason','admin');
    expect(create).toHaveBeenCalledTimes(1);expect(create.mock.calls[0][0].data).toMatchObject({userId:'owner',targetType:'BUSINESS',targetId:'b',actionUrl:'/salon/onboarding',dedupeKey:'business-review:event:owner',metadata:{decision}});
    expect(tx.userRole.findMany.mock.calls[0][0].where).toMatchObject({businessId:'b',role:{code:'BUSINESS_OWNER'},user:{isActive:true,deletedAt:null}});
  });
  test('CAS loser has no outbox or result event',async()=>{
    const create=jest.fn(),event=jest.fn();const tx:any={business:{updateMany:jest.fn().mockResolvedValue({count:0})},notificationOutbox:{create},businessReviewEvent:{create:event}};
    const prisma:any={business:{findUnique:jest.fn().mockResolvedValue({id:'b',status:'PENDING_REVIEW',documents:[]})},$transaction:jest.fn(fn=>fn(tx))};
    await expect(new BusinessOnboardingService(prisma,{} as never).review('b','REJECT','QA reason','admin')).rejects.toBeInstanceOf(ConflictException);expect(create).not.toHaveBeenCalled();expect(event).not.toHaveBeenCalled();
  });
  test('outbox failure rejects inside transaction rather than after commit',async()=>{
    const fault=new Error('QA outbox fault');const tx:any={userRole:{findMany:jest.fn().mockResolvedValue([])},notificationOutbox:{create:jest.fn().mockRejectedValue(fault)}};
    await expect((new BusinessOnboardingService({} as never,{} as never) as any).queueReviewResult(tx,{id:'b',name:'QA',owner:{userId:'owner',user:{isActive:true,deletedAt:null}}},'event','APPROVE')).rejects.toBe(fault);
  });
});
