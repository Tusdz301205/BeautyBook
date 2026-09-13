import { createServer } from 'node:http';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { SchedulerGateway } from './scheduler.gateway';

// Real Engine.IO/Socket.IO transport and JWT signature. Account/session storage
// is stubbed; this is not the PostgreSQL ownership-transfer end-to-end test.
describe('Scheduler authorization over a real local socket transport', () => {
  it('delivers a scoped event, then disconnects the same open socket after revocation', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const http = createServer();
    const server = new Server(http, { transports: ['polling'] });
    const jwt = new JwtService({ secret: 'local-socket-regression-test-only', signOptions: { expiresIn: '5m' } });
    let revoked = false;
    const strategy = { validate: jest.fn(async () => {
      if (revoked) throw new Error('revoked test session');
      return {
        id: 'user-1', email: 'local@example.test', roles: ['BRANCH_MANAGER'],
        scopes: [{ code: 'BRANCH_MANAGER', businessId: 'business-a', branchId: 'branch-a' }],
        permissions: ['booking:read:branch'], sessionType: 'salon',
      };
    }) };
    const gateway = new SchedulerGateway(jwt, strategy as never);
    gateway.afterInit(server);
    const connected = new Promise<Socket>((resolve) => {
      server.on('connection', (socket) => {
        gateway.handleConnection(socket);
        socket.on('disconnect', () => gateway.handleDisconnect(socket));
        resolve(socket);
      });
    });
    try {
      await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
      const address = http.address();
      if (!address || typeof address === 'string') throw new Error('No listening port');
      const base = `http://127.0.0.1:${address.port}/socket.io/?EIO=4&transport=polling`;
      const request = (url: string, init?: RequestInit) => fetch(url, { ...init, signal: AbortSignal.timeout(3000) });
      const hello = await (await request(base)).text();
      expect(hello[0]).toBe('0');
      const { sid } = JSON.parse(hello.slice(1));
      const endpoint = `${base}&sid=${encodeURIComponent(sid)}`;
      const token = await jwt.signAsync({ sub: 'user-1', roles: ['BRANCH_MANAGER'], sessionType: 'salon' });
      await request(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: `40${JSON.stringify({ token })}` });
      const socket = await connected;
      expect(await (await request(endpoint)).text()).toContain('40');

      gateway.notifyBookingUpdated({ id: 'booking-1', branchId: 'branch-a', businessId: 'business-a', status: 'CONFIRMED' });
      const packet = await (await request(endpoint)).text();
      expect(packet).toContain('booking_updated');
      expect(packet).toContain('booking-1');

      revoked = true;
      await gateway.reauthorizeSockets();
      expect(socket.disconnected).toBe(true);
      const emit = jest.spyOn(socket, 'emit');
      gateway.notifyBookingUpdated({ id: 'booking-2', branchId: 'branch-a' });
      expect(emit).not.toHaveBeenCalled();
    } finally {
      gateway.onModuleDestroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      log.mockRestore();
    }
  }, 10_000);
});
