import { ConfigService } from '@nestjs/config';
import { assertSafeProductionSecrets } from './main';

function config(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}

describe('production environment validation', () => {
  test('rejects default production JWT secrets', () => {
    expect(() =>
      assertSafeProductionSecrets(
        config({
          NODE_ENV: 'production',
          JWT_SECRET: 'change-me-in-production-please-use-32+chars',
          JWT_REFRESH_SECRET: 'another-valid-looking-but-default-secret-example',
        }),
      ),
    ).toThrow('JWT_SECRET');
  });

  test('accepts strong non-default production secrets', () => {
    expect(() =>
      assertSafeProductionSecrets(
        config({
          NODE_ENV: 'production',
          JWT_SECRET: '7sF!Q2mN9vK4xP8cR6yT3uW1zA5dG0hJ',
          JWT_REFRESH_SECRET: '4bL@8qZ2nV6tM0pX9cK3sR7wF1yH5jD!',
          SENSITIVE_DATA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
        }),
      ),
    ).not.toThrow();
  });

  test('rejects a missing production data-encryption key', () => {
    expect(() =>
      assertSafeProductionSecrets(
        config({
          NODE_ENV: 'production',
          JWT_SECRET: '7sF!Q2mN9vK4xP8cR6yT3uW1zA5dG0hJ',
          JWT_REFRESH_SECRET: '4bL@8qZ2nV6tM0pX9cK3sR7wF1yH5jD!',
        }),
      ),
    ).toThrow('SENSITIVE_DATA_ENCRYPTION_KEY');
  });
});
