import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { SensitiveDataCipherService } from './sensitive-data-cipher.service';

describe('SensitiveDataCipherService', () => {
  const key = Buffer.alloc(32, 7).toString('base64');

  test('encrypts with authenticated encryption and does not persist plaintext', () => {
    const config = {
      get: jest.fn((name: string) =>
        name === 'SENSITIVE_DATA_ENCRYPTION_KEY' ? key : 'v1',
      ),
    } as unknown as ConfigService;
    const cipher = new SensitiveDataCipherService(config);
    const encrypted = cipher.encrypt({ allergy: 'latex' });

    expect(encrypted.valueCiphertext).not.toContain('latex');
    expect(encrypted.authenticationTag).toBeTruthy();
    expect(encrypted.encryptionIv).toBeTruthy();
    expect(cipher.decrypt(encrypted)).toEqual({ allergy: 'latex' });
  });

  test('fails closed when no valid 32-byte key is configured', () => {
    const config = {
      get: jest.fn(() => ''),
    } as unknown as ConfigService;
    expect(() =>
      new SensitiveDataCipherService(config).encrypt('secret'),
    ).toThrow(ServiceUnavailableException);
  });
});
