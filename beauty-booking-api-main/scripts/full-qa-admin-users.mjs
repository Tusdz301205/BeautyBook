import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env, db, tokens, test, results, login, call as rawCall, ok, close } from './full-qa-context.mjs';
const call = (method, path, actor, data) => rawCall(method, path, actor, data, method === 'POST' ? { 'Idempotency-Key': randomUUID() } : {});
try {
  await login('platform_admin'); await login('owner0');
  const customer = ok(await call('POST', '/auth/register', null, { accountType: 'CUSTOMER', email: `admin-customer-${randomUUID()}@example.test`, fullName: 'Khách QA quản trị', password: env.QA_PASSWORD }));
  tokens.newCustomer = customer.accessToken;
  const role = await db.role.findUniqueOrThrow({ where: { code: 'PLATFORM_ADMIN' } });
  const admin = await db.user.create({ data: { email: `admin-commands-${randomUUID()}@example.test`, fullName: 'Quản trị QA mới', passwordHash: await bcrypt.hash(env.QA_PASSWORD, 12), userRoles: { create: { roleId: role.id } } } });
  await test('ADMIN-USER-READ', 'platform user directory and private-field redaction', async () => {
    const row = ok(await call('GET', `/users/${customer.user.id}`, 'platform_admin'));
    assert.equal(row.id, customer.user.id); assert.equal('passwordHash' in row, false);
    ok(await call('GET', '/users?limit=101', 'platform_admin'), 400);
    ok(await call('GET', `/users/${customer.user.id}`, 'newCustomer'));
    ok(await call('GET', `/users/${admin.id}`, 'newCustomer'), 403);
    return { privateFieldsOmitted: true, selfReadAndForeignDenial: true };
  });
  await test('ADMIN-SUSPEND-REVOKES', 'suspension closes existing customer access', async () => {
    ok(await call('POST', `/users/${customer.user.id}/suspend`, 'owner0', { reason: 'Unauthorized synthetic command' }), 403);
    const row = ok(await call('POST', `/users/${customer.user.id}/suspend`, 'platform_admin', { reason: 'Synthetic QA suspension' }));
    assert.equal(row.isActive, false);
    ok(await call('GET', '/users/me/profile', 'newCustomer'), 401);
    ok(await call('POST', '/auth/login', null, { email: customer.user.email, password: env.QA_PASSWORD, workspace: 'CUSTOMER', refreshTokenTransport: 'BODY' }), [400,401,403]);
    const restored = ok(await call('POST', `/users/${customer.user.id}/suspend`, 'platform_admin', { reason: 'Restore synthetic QA account' }));
    assert.equal(restored.isActive, true);
    const session = ok(await call('POST', '/auth/login', null, { email: customer.user.email, password: env.QA_PASSWORD, workspace: 'CUSTOMER', refreshTokenTransport: 'BODY' }));
    tokens.newCustomer = session.accessToken; ok(await call('GET', '/users/me/profile', 'newCustomer'));
    return { oldTokenRevoked: true, restoredAccountCanLogin: true };
  });
  await test('ADMIN-ROLE-SEPARATION', 'platform role assignment preserves account-category boundaries', async () => {
    const before = await db.userRole.count({ where: { userId: customer.user.id } });
    ok(await call('POST', `/users/${customer.user.id}/roles`, 'platform_admin', { roleCode: 'PLATFORM_ADMIN' }), [400,409]);
    assert.equal(await db.userRole.count({ where: { userId: customer.user.id } }), before);
    ok(await call('POST', `/users/${admin.id}/roles`, 'platform_admin', { roleCode: 'REMOVED_ROLE' }), 400);
    return { noCrossCategoryEscalation: true };
  });
  await test('ADMIN-DIRECT-PERMISSION', 'direct permission grant/revoke/expiry validation', async () => {
    ok(await call('POST', `/users/${customer.user.id}/permissions`, 'platform_admin', { permissionCode: 'audit:read:platform' }), 400);
    ok(await call('POST', `/users/${admin.id}/permissions`, 'platform_admin', { permissionCode: 'audit:read:platform', expiresAt: '2020-01-01' }), 400);
    const grant = ok(await call('POST', `/users/${admin.id}/permissions`, 'platform_admin', { permissionCode: 'audit:read:platform', bundleCode: 'QA', expiresAt: new Date(Date.now() + 86400000).toISOString() }));
    assert.equal(grant.userId, admin.id);
    ok(await call('GET', `/users/${admin.id}/permissions`, 'platform_admin'));
    ok(await call('DELETE', `/users/${admin.id}/permissions/audit:read:platform`, 'platform_admin'));
    assert.ok((await db.userPermission.findFirstOrThrow({ where: { userId: admin.id } })).revokedAt);
    return { grantedAndRevoked: true, historicalGrantRetained: true };
  });
  await test('ADMIN-ROLE-REVOKE-REASSIGN', 'new platform identity role lifecycle', async () => {
    ok(await call('DELETE', `/users/${admin.id}/roles/PLATFORM_ADMIN`, 'platform_admin'));
    assert.equal(await db.userRole.count({ where: { userId: admin.id } }), 0);
    ok(await call('POST', `/users/${admin.id}/roles`, 'platform_admin', { roleCode: 'PLATFORM_ADMIN' }));
    assert.equal(await db.userRole.count({ where: { userId: admin.id } }), 1);
    return { syntheticAdminOnly: true, roleRestored: true };
  });
  console.log(JSON.stringify({ scenarios: results.length, pass: results.filter(x => x.status === 'PASS').length, fail: results.filter(x => x.status === 'FAIL').length }));
} finally { await close(); }
