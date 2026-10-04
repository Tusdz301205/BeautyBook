import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateSelfDto } from './update-self.dto';

describe('UpdateSelfDto runtime validation', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } });
  const validate = (body: unknown) => pipe.transform(body, { type: 'body', metatype: UpdateSelfDto });

  it.each([
    { fullName: { nested: 'x' } },
    { fullName: ['Nguyễn', 'An'] },
    { fullName: null },
    { experienceYears: '10' },
    { experienceYears: -1 },
    { gender: 'UNKNOWN' },
    { dateOfBirth: 'not-a-date' },
  ])('rejects invalid profile input before service writes: %j', async (body) => {
    await expect(validate(body)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts omitted optional fields and correctly typed values', async () => {
    await expect(validate({ fullName: 'Nguyễn An', experienceYears: 10 })).resolves.toMatchObject({
      fullName: 'Nguyễn An', experienceYears: 10,
    });
    await expect(validate({})).resolves.toBeInstanceOf(UpdateSelfDto);
  });
});
