import { BadRequestException } from '@nestjs/common';
import { BusinessOnboardingService } from './business-onboarding.service';

describe('business review input cannot reach transition logic malformed',()=>{
  test.each([['UNKNOWN','QA reason'],['REQUEST_INFO','   '],['REJECT','   ']])('rejects %s with invalid decision/reason before writes',async(decision,note)=>{
    const transaction=jest.fn().mockResolvedValue(undefined);
    const prisma:any={business:{findUnique:jest.fn().mockResolvedValue({id:'b',status:'PENDING_REVIEW',documents:[]})},$transaction:transaction,auditLog:{create:jest.fn()}};
    await expect(new BusinessOnboardingService(prisma,{} as never).review('b',decision as never,note,'admin')).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });
});
