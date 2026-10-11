import { ConfigService } from '@nestjs/config';
import { TokenBlacklistService } from './token-blacklist.service';
describe('token revocation and a new session within the same second', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-10-08T05:00:00.100Z')));
  afterEach(() => jest.useRealTimers());
  it('rejects a session created before revocation, but allows a new verified session 150ms later', async () => {
    const service = new TokenBlacklistService(new ConfigService({ NODE_ENV: 'test' }));
    await service.revokeAllForUser('user');
    jest.setSystemTime(new Date('2026-10-08T05:00:00.250Z'));
    const iat = Math.floor(Date.now() / 1000);
    const check = service.isRevoked.bind(service);
    await expect(check('user', iat, new Date('2026-10-08T04:59:59.999Z'))).resolves.toBe(true);
    await expect(check('user', iat, new Date('2026-10-08T05:00:00.250Z'))).resolves.toBe(false);
    await expect(check('user', iat)).resolves.toBe(true); // No verified session timestamp: conservative fallback.
    service.onModuleDestroy();
  });
});

describe('legacy revocation records', () => {
  it('retains the conservative whole-second fence for pre-upgrade Redis records', async () => {
    const service = new TokenBlacklistService(new ConfigService({ NODE_ENV: 'test' }));
    const epoch = Math.floor(new Date('2026-10-08T05:00:00Z').getTime() / 1000);
    const memory = (service as unknown as { memoryStore: Map<string, number> }).memoryStore;
    memory.set('user', epoch);
    await expect(service.isRevoked('user', epoch, new Date('2026-10-08T05:00:00.900Z'))).resolves.toBe(true);
    await expect(service.isRevoked('user', epoch + 1, new Date('2026-10-08T05:00:01Z'))).resolves.toBe(false);
    memory.set('corrupt', NaN);
    await expect(service.isRevoked('corrupt', epoch, new Date())).resolves.toBe(true);
    service.onModuleDestroy();
  });
});
