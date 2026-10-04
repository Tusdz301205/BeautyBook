import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { env, fixture, b, tokens, test, results, login, booking, call, ok, close } from './full-qa-context.mjs';
const require = createRequire(new URL('../../beauty-booking-web-main/beauty-booking-web-main/package.json', import.meta.url));
const { io } = require('socket.io-client');
const sockets = {}, received = {};
function awaitEvent(socket, event, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(event, done); reject(new Error(`Timeout waiting for ${event}`)); }, timeout);
    const done = (...args) => { clearTimeout(timer); resolve(args); };
    socket.once(event, done);
  });
}
try {
  for (const actor of ['customer2', 'customer5', 'owner0', 'owner1', 'receptionist0', 'staff0', 'platform_admin']) {
    await login(actor);
    received[actor] = [];
    sockets[actor] = io('http://localhost:3012', { auth: { token: tokens[actor] }, transports: ['websocket'], reconnection: false, autoConnect: false });
    sockets[actor].onAny((event, payload) => received[actor].push({ event, payload }));
    await test(`SOCKET-CONNECT-${actor}`, 'real scoped WebSocket connection', async () => {
      const connected = awaitEvent(sockets[actor], 'connect'); sockets[actor].connect(); await connected;
      return { connected: true, role: fixture.actors[actor].workspace };
    });
  }
  await test('SOCKET-ANONYMOUS-DENIED', 'anonymous WebSocket isolation', async () => {
    const anonymous = io('http://localhost:3012', { transports: ['websocket'], reconnection: false, autoConnect: false });
    const denied = awaitEvent(anonymous, 'connect_error'); anonymous.connect();
    const [error] = await denied; anonymous.disconnect(); assert.equal(error.data?.code, 'WS_AUTH_FAILED');
    return { rejected: true };
  });
  let created;
  await test('SOCKET-BOOKING-SCOPE', 'live booking invalidation and cross-account isolation', async () => {
    const promised = ['customer2', 'owner0', 'receptionist0', 'platform_admin'].map(actor => awaitEvent(sockets[actor], 'booking_created'));
    created = await booking('customer2', 19);
    const events = await Promise.all(promised);
    for (const [payload] of events) { assert.equal(payload.id, created.id); assert.deepEqual(Object.keys(payload).sort(), ['branchId', 'id', 'status', 'updatedAt']); }
    assert.equal(received.customer5.some(e => e.payload?.id === created.id), false);
    assert.equal(received.owner1.some(e => e.payload?.id === created.id), false);
    return { bookingId: created.id, scopedRecipients: 4, noPersonalFields: true, foreignTenantAndCustomerExcluded: true };
  });
  await test('SOCKET-STATUS-SYNC', 'booking status sync without reload', async () => {
    assert.ok(created);
    const promised = awaitEvent(sockets.customer2, 'booking_updated');
    ok(await call('PATCH', `/bookings/${created.id}/status`, 'owner0', { status: 'CONFIRMED' }));
    const [payload] = await promised; assert.equal(payload.id, created.id); assert.equal(payload.status, 'CONFIRMED');
    return { bookingId: created.id, status: payload.status };
  });
  await test('SOCKET-LOGOUT-REVOKES', 'live session revocation', async () => {
    const disconnected = awaitEvent(sockets.customer5, 'disconnect', 40000);
    ok(await call('POST', '/auth/logout', 'customer5', {})); await disconnected;
    assert.equal(sockets.customer5.connected, false); return { revokedConnectionClosed: true };
  });
  console.log(JSON.stringify({ scenarios: results.length, pass: results.filter(x => x.status === 'PASS').length, fail: results.filter(x => x.status === 'FAIL').length }));
} finally { for (const socket of Object.values(sockets)) socket.disconnect(); await close(); }
