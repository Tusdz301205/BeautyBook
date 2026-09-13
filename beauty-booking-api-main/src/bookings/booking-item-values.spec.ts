import { BadRequestException } from '@nestjs/common';
import { assertItemDuration, assertItemPrice, MAX_BOOKING_ITEM_PRICE } from './booking-item-values';
import { BookingItemsService } from './booking-items.service';

describe('Booking item numeric validation', () => {
  it.each([undefined, null, '100', NaN, Infinity, -Infinity, -1, 0.001, MAX_BOOKING_ITEM_PRICE + 1, {}, true])('rejects malformed price %p', (value) => {
    expect(() => assertItemPrice(value)).toThrow(BadRequestException);
  });
  it.each([0, 0.01, 100000, 123.45, MAX_BOOKING_ITEM_PRICE])('accepts storage-valid price %p', (value) => {
    expect(() => assertItemPrice(value)).not.toThrow();
  });
  it.each([undefined, null, '60', NaN, Infinity, -Infinity, -1, 0, 1.5, 2_147_483_648, {}, true])('rejects malformed duration %p', (value) => {
    expect(() => assertItemDuration(value)).toThrow(BadRequestException);
  });
  it.each([1, 60, 135])('accepts integer minutes %p', (value) => {
    expect(() => assertItemDuration(value)).not.toThrow();
  });
  it.each([
    { action: 'REPRICE', price: NaN },
    { action: 'REPRICE', price: Infinity },
    { action: 'REPRICE', price: null },
    { action: 'REPRICE' },
    { action: 'RESIZE', durationMinutes: Infinity },
    { action: 'RESIZE', durationMinutes: 1.5 },
    { action: 'RESIZE', durationMinutes: '60' },
  ])('rejects unsafe update before starting a transaction: %p', async (input) => {
    const prisma = { $transaction: jest.fn() };
    const service = new BookingItemsService(prisma as never);
    await expect(service.update('booking', 'item', 'actor', { expectedRevision: 1, reason: 'Điều chỉnh', ...input } as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it.each([{ price: null }, { price: 0.001 }, { durationMinutes: null }, { durationMinutes: 0.5 }])('rejects unsafe add override before starting a transaction: %p', async (input) => {
    const prisma = { $transaction: jest.fn() };
    const service = new BookingItemsService(prisma as never);
    await expect(service.add('booking', 'actor', { serviceId: 'service', reason: 'Bổ sung', ...input } as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
