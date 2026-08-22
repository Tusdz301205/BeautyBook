import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { RegisterDto } from './auth.dto';

describe('RegisterDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  it('normalizes customer registration fields', async () => {
    const value = await pipe.transform(
      {
        email: '  CUSTOMER@Example.com ',
        password: 'Password123',
        fullName: '  Nguyễn An  ',
        phone: '0912 345 678',
      },
      { type: 'body', metatype: RegisterDto },
    );

    expect(value).toMatchObject({
      email: 'customer@example.com',
      fullName: 'Nguyễn An',
      phone: '+84912345678',
    });
  });

  it('rejects a client-supplied role', async () => {
    await expect(pipe.transform(
      {
        email: 'customer@example.com',
        password: 'Password123',
        fullName: 'Nguyễn An',
        role: 'salon',
      },
      { type: 'body', metatype: RegisterDto },
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a weak password and an invalid Vietnamese phone number', async () => {
    await expect(pipe.transform(
      {
        email: 'customer@example.com',
        password: 'weak',
        fullName: 'Nguyễn An',
        phone: '12345',
      },
      { type: 'body', metatype: RegisterDto },
    )).rejects.toBeInstanceOf(BadRequestException);
  });
});
