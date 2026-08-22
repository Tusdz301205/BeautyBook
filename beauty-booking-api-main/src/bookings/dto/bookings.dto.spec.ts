import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateGuestBookingDto } from './bookings.dto';

const validPayload = {
  guestName: '  Nguyễn Minh Anh  ',
  guestPhone: '0912 345 678',
  branchId: '11111111-1111-4111-8111-111111111111',
  serviceIds: ['22222222-2222-4222-8222-222222222222'],
  appointmentDate: '2030-07-21T03:00:00.000Z',
};

describe('CreateGuestBookingDto', () => {
  it('normalizes the guest identity and accepts a one-time booking payload', async () => {
    const dto = plainToInstance(CreateGuestBookingDto, validPayload);
    expect(dto.guestName).toBe('Nguyễn Minh Anh');
    expect(dto.guestPhone).toBe('+84912345678');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects invalid phone numbers', async () => {
    const dto = plainToInstance(CreateGuestBookingDto, { ...validPayload, guestPhone: '123' });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'guestPhone')).toBe(true);
  });

  it('allows combo checkout without a serviceIds array', async () => {
    const dto = plainToInstance(CreateGuestBookingDto, {
      ...validPayload,
      serviceIds: undefined,
      comboId: '33333333-3333-4333-8333-333333333333',
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
