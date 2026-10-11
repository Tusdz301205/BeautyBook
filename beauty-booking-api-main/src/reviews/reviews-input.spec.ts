import { BadRequestException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
const admin = { id: 'admin', roles: ['PLATFORM_ADMIN'], scopes: [{ code: 'PLATFORM_ADMIN' }] } as any;
function fixture() {
  const prisma:any = { review:{findUnique:jest.fn()},reviewReport:{findUnique:jest.fn()},$transaction:jest.fn() };
  const service=new ReviewsService(prisma,{} as never);
  return{prisma,service,controller:new ReviewsController(service,prisma)};
}
describe('review mutation input types are rejected before database work',()=>{
  test.each([1,[],{},true])('report reason malformed %j',async reason=>{
    const f=fixture();await expect(f.service.report('review','customer',{reason:reason as never})).rejects.toBeInstanceOf(BadRequestException);
    expect(f.prisma.review.findUnique).not.toHaveBeenCalled();
  });
  test.each([{reason:'QA',category:10},{reason:'QA',severity:true}])('report classifications malformed %j',async body=>{
    const f=fixture();await expect(f.service.report('review','customer',body as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(f.prisma.review.findUnique).not.toHaveBeenCalled();
  });
  test('moderation primitive fields malformed',async()=>{
    const f=fixture();await expect(f.service.moderate('review','APPROVED',5 as never,'QA',admin)).rejects.toBeInstanceOf(BadRequestException);
    expect(f.prisma.review.findUnique).not.toHaveBeenCalled();
  });
  test('appeal reason malformed',async()=>{
    const f=fixture();await expect(f.service.appeal('review',admin,true as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(f.prisma.review.findUnique).not.toHaveBeenCalled();
  });
  test('appeal decision must be JSON boolean',async()=>{
    const f=fixture();await expect(f.service.resolveAppeal('appeal','false' as never,'QA',admin)).rejects.toBeInstanceOf(BadRequestException);
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });
  test('reply primitive malformed',async()=>{
    const f=fixture();await expect(f.controller.reply('review',{content:10 as never},admin)).rejects.toBeInstanceOf(BadRequestException);
    expect(f.prisma.review.findUnique).not.toHaveBeenCalled();
  });
  test.each(['reply','moderate','appeal','resolveAppeal'] as const)('null JSON body %s is400 rather than a property TypeError',async method=>{
    const f=fixture();
    await expect((async()=>{await f.controller[method]('review',null as never,admin);})()).rejects.toBeInstanceOf(BadRequestException);
    expect(f.prisma.review.findUnique).not.toHaveBeenCalled();expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });
  test.each([
    {overallRating: '3'}, {overallRating: 3.5}, {overallRating: 3, comment: 10},
    {overallRating: 3, comment: 'QA content', isAnonymous: 'false'},
    {overallRating: 3, comment: 'QA content', serviceRatings: {length: 1}},
    {overallRating: 3, comment: 'QA content', serviceRatings: [null]},
    {overallRating: 3, comment: 'QA content', serviceRatings: [{bookingServiceId:'item',rating:2.5}]},
    {overallRating: 3, comment: 'QA content', serviceRatings: [{bookingServiceId:'item',rating:3,comment:true}]},
  ])('new review malformed fields %j are rejected before policy/db',async fields=>{
    const f=fixture();const settings={getEffective:jest.fn()};const service=new ReviewsService(f.prisma,settings as never);
    const customer={id:'customer',roles:['CUSTOMER'],scopes:[{code:'CUSTOMER'}],workspace:'CUSTOMER',sessionType:'customer'} as any;
    await expect(service.create({bookingId:'booking',customerId:'profile',comment:'QA content',...fields} as never,customer)).rejects.toBeInstanceOf(BadRequestException);
    expect(settings.getEffective).not.toHaveBeenCalled();expect(f.prisma.review.findUnique).not.toHaveBeenCalled();
  });
});
