import { BadRequestException } from '@nestjs/common';
import { assertLegalIdentifiers, legalIdentifierErrors, LEGAL_SUBJECT_CATALOG } from './legal-registration';
import { BusinessOnboardingService } from './business-onboarding.service';
jest.mock('../common/utils/multi-tenancy', () => ({ assertBusinessAccess: jest.fn().mockResolvedValue(undefined), restrictToRoles: (user: unknown) => user }));

describe('explicit legal subject and representative identity', () => {
  test.each(LEGAL_SUBJECT_CATALOG.map(x => [x.code]))('%s rejects letters and wrong tax length', code => {
    expect(() => assertLegalIdentifiers({ taxCode: 'AB-123' }, { legalSubjectType: code }, true)).toThrow(BadRequestException);
  });
  test.each([
    ['ORGANIZATION_10', '0123456789'], ['DEPENDENT_13', '0123456789-001'],
    ['VN_HOUSEHOLD_12', '012345678901'], ['VN_INDIVIDUAL_12', '012345678901'],
    ['FOREIGN_PERSON_10', '0123456789'], ['LEGACY_DEPENDENT_10', '0123456789'],
  ])('%s accepts its own shape only', (legalSubjectType, taxCode) => {
    expect(legalIdentifierErrors({ taxCode }, { legalSubjectType }, true)).toEqual({});
  });
  test('dependent suffix000 and empty registration serial are rejected, hyphen is required', () => {
    for (const taxCode of ['0123456789-000', '0123456789001', '0100000000-001']) expect(legalIdentifierErrors({ taxCode }, { legalSubjectType: 'DEPENDENT_13' }).taxCode).toBeTruthy();
  });
  test('does not infer old subject from category or identifier length', () => {
    expect(legalIdentifierErrors({ taxCode: '0123456789' }, {}, true).legalSubjectType).toBeTruthy();
    expect(legalIdentifierErrors({}, {}, false)).toEqual({});
    expect(legalIdentifierErrors({}, {}, true).legalSubjectType).toBeTruthy();
  });
  test('Vietnamese ID must be12 digits; foreign passport has no invented Vietnam format', () => {
    expect(legalIdentifierErrors({ identityCardNumber: '123456789' }, { representativeIdentityType: 'VN_CITIZEN_ID' }).identityCardNumber).toBeTruthy();
    expect(legalIdentifierErrors({ identityCardNumber: '012345678901' }, { representativeIdentityType: 'VN_CITIZEN_ID' })).toEqual({});
    expect(legalIdentifierErrors({ identityCardNumber: 'AB 123456' }, { representativeIdentityType: 'FOREIGN_PASSPORT' })).toEqual({});
    expect(legalIdentifierErrors({ identityCardNumber: '012345678901' }).representativeIdentityType).toBeTruthy();
  });
  test('new identifier without classification fails before creating anything', async () => {
    const tx = jest.fn();const prisma: any = { businessOwnerProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'owner' }) }, $transaction: tx };
    await expect(new BusinessOnboardingService(prisma, {} as never).createDraft({id:'user'} as never, {name:'QA new',slug:'qa-new',taxCode:'1234567890'})).rejects.toThrow(BadRequestException);
    expect(tx).not.toHaveBeenCalled();
  });
  test('submit of an untouched legacy draft requires explicit classification and never mutates history', async () => {
    const tx = jest.fn();const prisma: any = { business: { findUnique: jest.fn().mockResolvedValue({id:'b',name:'QA brand',status:'DRAFT',onboardingData:{businessType:'SPA'},owner:{taxCode:'legacy',user:{}},documents:[]}) },$transaction:tx };
    await expect(new BusinessOnboardingService(prisma,{getEffective:jest.fn().mockResolvedValue({})} as never).submit('b',{roles:['BUSINESS_OWNER']} as never)).rejects.toThrow(BadRequestException);
    expect(tx).not.toHaveBeenCalled();
  });
  test('changing type cannot bypass validation using stored identifier', async () => {
    const tx = jest.fn();const prisma: any = { business: { findUnique: jest.fn().mockResolvedValue({id:'b',name:'QA brand',status:'DRAFT',owner:{taxCode:'0123456789'},onboardingData:{businessType:'SPA'}}) },$transaction:tx };
    await expect(new BusinessOnboardingService(prisma,{} as never).updateDraft('b',{roles:['BUSINESS_OWNER']} as never,{onboardingData:{legalSubjectType:'VN_HOUSEHOLD_12'}})).rejects.toThrow(BadRequestException);
    expect(tx).not.toHaveBeenCalled();
  });
  test('legacy dependent tax never autoapproves even when platform default autoapproves', async () => {
    const updatedAt=new Date();const business:any={id:'b',ownerId:'owner',name:'QA brand',status:'DRAFT',updatedAt,contactEmail:'qa@example.test',contactPhone:'+84912345678',addressLine:'QA address',legalRepresentative:'QA owner',owner:{companyName:'QA company',taxCode:'0123456789',user:{}},onboardingData:{businessType:'SPA',legalSubjectType:'LEGACY_DEPENDENT_10'},documents:[{id:'doc',documentType:'TAX_DOCUMENT',status:'DRAFT'}]};
    const update=jest.fn().mockImplementation(({data})=>Promise.resolve({id:'b',...data}));
    const tx:any={$queryRaw:jest.fn(),businessOwnerProfile:{findUniqueOrThrow:jest.fn().mockResolvedValue(business.owner)},business:{findUnique:jest.fn().mockResolvedValue({status:'DRAFT',updatedAt}),update},businessReviewEvent:{create:jest.fn()},businessDocument:{update:jest.fn()},documentReviewEvent:{create:jest.fn()}};
    const prisma:any={business:{findUnique:jest.fn().mockResolvedValue(business)},$transaction:jest.fn(fn=>fn(tx)),auditLog:{create:jest.fn()}};
    const result=await new BusinessOnboardingService(prisma,{getEffective:jest.fn().mockResolvedValue({autoApproveNewSalons:true})} as never).submit('b',{roles:['BUSINESS_OWNER'],id:'user'} as never);
    expect(result.status).toBe('PENDING_REVIEW');expect(result.reviewedAt).toBeNull();
    expect(tx.businessReviewEvent.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({action:'SUBMIT'})}));
  });
  test('new draft cannot overwrite the shared legal identity of an approved business', async () => {
    const businessCreate=jest.fn(), profileUpdate=jest.fn();
    const owner={id:'owner',companyName:'Existing legal name',taxCode:'0123456789',identityCardNumber:null};
    const tx:any={$queryRaw:jest.fn(),businessOwnerProfile:{findUniqueOrThrow:jest.fn().mockResolvedValue(owner),update:profileUpdate},business:{findFirst:jest.fn().mockResolvedValue({id:'approved'}),create:businessCreate}};
    const prisma:any={businessOwnerProfile:{findUnique:jest.fn().mockResolvedValue(owner)},business:{findUnique:jest.fn().mockResolvedValue(null)},$transaction:jest.fn(fn=>fn(tx))};
    await expect(new BusinessOnboardingService(prisma,{} as never).createDraft({id:'user'} as never,{name:'QA brand',slug:'qa-brand',companyName:'Different legal name'})).rejects.toThrow('Thông tin pháp nhân đang dùng chung');
    expect(businessCreate).not.toHaveBeenCalled();expect(profileUpdate).not.toHaveBeenCalled();
  });
  test('same legal identity is allowed without invalidating the existing approved business', async () => {
    const owner={id:'owner',companyName:'Existing legal name',taxCode:'0123456789',identityCardNumber:null};
    const tx:any={$queryRaw:jest.fn(),businessOwnerProfile:{findUniqueOrThrow:jest.fn().mockResolvedValue(owner)},business:{findFirst:jest.fn()}};
    await (new BusinessOnboardingService({} as never,{} as never) as any).protectSharedOwnerIdentity(tx,'owner',{companyName:owner.companyName,taxCode:owner.taxCode});
    expect(tx.business.findFirst).not.toHaveBeenCalled();
  });

});
