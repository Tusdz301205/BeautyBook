import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// Storage limits, not a business rule authorizing a discount/markup percentage.
export const MAX_BOOKING_ITEM_PRICE = 9_999_999_999.99; // numeric(12,2)
export function assertItemPrice(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 ||
      value > MAX_BOOKING_ITEM_PRICE || new Prisma.Decimal(value).decimalPlaces() > 2) {
    throw new BadRequestException('Giá phải là số không âm, tối đa 9.999.999.999,99 và không quá 2 chữ số thập phân');
  }
}

export function assertItemDuration(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 2_147_483_647) {
    throw new BadRequestException('Thời lượng phải là số nguyên dương hợp lệ tính bằng phút');
  }
}
