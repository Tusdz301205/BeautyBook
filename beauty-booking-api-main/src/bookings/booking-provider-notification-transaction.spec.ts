import { BookingItemsService } from './booking-items.service';
import * as validation from './bookings.validation';
import { ConflictException } from '@nestjs/common';

describe('item reassignment delivery is part of the mutation transaction', () => {
  afterEach(() => jest.restoreAllMocks());
  function fixture(fault?: Error) {
    jest.spyOn(validation, 'validateStaffForService').mockResolvedValue(undefined);
    jest.spyOn(validation, 'assertNoOverlap').mockResolvedValue(undefined);
    const item = { id: 'item', bookingId: 'booking', staffId: 'old', serviceId: 'service', status: 'SCHEDULED', revision: 1,
      durationMinutes: 30, priceAtBooking: 100, itemStartAt: new Date('2099-01-01T01:00:00Z'), itemEndAt: new Date('2099-01-01T01:30:00Z'),
      staff: { userId: 'old-user' }, booking: { id: 'booking', status: 'CONFIRMED', branchId: 'branch' } };
    const tx: any = { $queryRaw: jest.fn(),
      bookingService: { findFirst: jest.fn().mockResolvedValueOnce(item).mockResolvedValue(null), updateMany: jest.fn().mockResolvedValue({count:1}), findUniqueOrThrow: jest.fn().mockResolvedValue({...item,staffId:'new',revision:2,staff:{userId:'new-user'}}) },
      booking: {findUnique:jest.fn().mockResolvedValue({status:'CONFIRMED',pendingExpiresAt:null,bookingServices:[{status:'SCHEDULED'}]}),findUniqueOrThrow:jest.fn().mockResolvedValue({branchId:'branch',branch:{businessId:'business'}})},
      bookingServiceAdjustment: {count:jest.fn().mockResolvedValue(0),create:jest.fn().mockResolvedValue({id:'event'})},
      staffProfile:{findMany:jest.fn().mockResolvedValue([{id:'old',userId:'old-user'},{id:'new',userId:'new-user'}])},
      userRole:{findMany:jest.fn().mockResolvedValue([{userId:'old-user'},{userId:'new-user'}])},
      notificationOutbox:{createMany:fault?jest.fn().mockRejectedValue(fault):jest.fn().mockResolvedValue({count:2})} };
    let committed=false;
    const prisma:any={$transaction:jest.fn(async fn=>{const result=await fn(tx);committed=true;return result;}),booking:{findMany:jest.fn().mockResolvedValue([])}};
    const gateway={notifyBookingUpdated:jest.fn()};
    const service=new BookingItemsService(prisma,gateway as never);
    jest.spyOn(service as any,'detail').mockResolvedValue({id:'booking'});
    return{service,tx,prisma,gateway,committed:()=>committed};
  }
  test('valid reassignment commits audit/outbox before realtime read',async()=>{
    const f=fixture();await f.service.update('booking','item','owner',{action:'REASSIGN',staffId:'new',reason:'QA',expectedRevision:1});
    expect(f.committed()).toBe(true);expect(f.tx.bookingServiceAdjustment.create).toHaveBeenCalledTimes(1);
    expect(f.tx.notificationOutbox.createMany).toHaveBeenCalledTimes(1);expect(f.prisma.booking.findMany).toHaveBeenCalledTimes(1);
  });
  test('outbox fault rejects transaction, no commit or aftercommit invalidation',async()=>{
    const error=new Error('QA outbox fault'),f=fixture(error);
    await expect(f.service.update('booking','item','owner',{action:'REASSIGN',staffId:'new',reason:'QA',expectedRevision:1})).rejects.toBe(error);
    expect(f.committed()).toBe(false);expect(f.prisma.booking.findMany).not.toHaveBeenCalled();expect(f.gateway.notifyBookingUpdated).not.toHaveBeenCalled();
  });
  test('stale revision creates no audit or outbox',async()=>{
    const f=fixture();await expect(f.service.update('booking','item','owner',{action:'REASSIGN',staffId:'new',reason:'QA',expectedRevision:2})).rejects.toBeInstanceOf(ConflictException);
    expect(f.committed()).toBe(false);expect(f.tx.bookingServiceAdjustment.create).not.toHaveBeenCalled();expect(f.tx.notificationOutbox.createMany).not.toHaveBeenCalled();
  });
});
