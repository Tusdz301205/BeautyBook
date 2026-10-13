const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

// Run actual pure helpers in memory. Any new runtime import must be reviewed;
// these checks cannot start a native runtime, call an API, or read credentials.
function load(name) {
  const source = fs.readFileSync(path.join(__dirname, '../src/utils', name), 'utf8');
  const module = { exports: {} };
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, { module, exports: module.exports, Date, Intl,
    require: name => { throw new Error(`Pure helper unexpectedly imports ${name}`); } }, { filename: name });
  return module.exports;
}
const { usableRole, mobileShell, operationContextKey, dateInZone } = load('operationSession.ts');
const { operationNotificationTarget } = load('operationNotifications.ts');
const now = Date.parse('2026-10-05T10:00:00Z');
const businessA = '11111111-1111-4111-8111-111111111111';
const businessB = '22222222-2222-4222-8222-222222222222';
const branchA = '33333333-3333-4333-8333-333333333333';
const branchB = '44444444-4444-4444-8444-444444444444';
const booking = '55555555-5555-4555-8555-555555555555';
const impact = '66666666-6666-4666-8666-666666666666';
function grant(code = 'STAFF', changes = {}) {
  return { code, businessId: businessA, branchId: code === 'STAFF' ? branchA : null, expiresAt: null, ...changes };
}
function user(changes = {}) {
  return { id: 'user-a', email: 'unit@example.invalid', fullName: 'Unit Staff', workspace: 'SALON', sessionType: 'salon',
    businessId: businessA, branchId: branchA, roles: ['STAFF'], scopes: [grant()], ...changes };
}

test('anonymous and CUSTOMER sessions use Customer shell', () => {
  assert.equal(mobileShell(null, now), 'CUSTOMER');
  for (const workspace of [undefined, 'CUSTOMER']) assert.equal(mobileShell(user({ roles: ['CUSTOMER'], workspace, scopes: [] }), now), 'CUSTOMER');
});
test('valid salon Staff and Owner route from server roles and scopes', () => {
  assert.equal(mobileShell(user(), now), 'STAFF');
  assert.equal(mobileShell(user({ roles: ['BUSINESS_OWNER'], scopes: [grant('BUSINESS_OWNER')], branchId: null }), now), 'OWNER');
  assert.equal(mobileShell(user({ roles: ['BUSINESS_OWNER', 'STAFF'], scopes: [grant(), grant('BUSINESS_OWNER')] }), now), 'OWNER');
});
for (const roles of [[], ['RECEPTIONIST'], ['PLATFORM_ADMIN'], ['CUSTOMER', 'RECEPTIONIST'], ['OWNER'], ['ADMIN']]) {
  test(`unsupported role combination ${JSON.stringify(roles)} never gains an operational shell`, () => {
    assert.equal(mobileShell(user({ roles }), now), 'UNSUPPORTED');
  });
}
for (const workspace of [undefined, 'CUSTOMER', 'PLATFORM', 'salon']) {
  test(`operational role in ${String(workspace)} workspace is unsupported`, () => {
    assert.equal(mobileShell(user({ workspace }), now), 'UNSUPPORTED');
  });
}
for (const [label, changes] of [
  ['scope missing', { scopes: undefined }], ['scope empty', { scopes: [] }],
  ['role missing despite flat permissions', { roles: [], permissions: ['booking:read:branch'], scopes: [grant()] }],
  ['scope role mismatched', { scopes: [grant('RECEPTIONIST')] }],
  ['different business', { scopes: [grant('STAFF', { businessId: businessB })] }],
  ['different branch', { scopes: [grant('STAFF', { branchId: branchB })] }],
  ['Staff branch missing', { scopes: [grant('STAFF', { branchId: null })] }],
  ['Staff business missing', { businessId: null, scopes: [grant('STAFF', { businessId: null })] }],
]) {
  test(`Staff rejects ${label}`, () => {
    assert.equal(usableRole(user(changes), 'STAFF', now), false);
    assert.equal(mobileShell(user(changes), now), 'UNSUPPORTED');
  });
}
for (const code of ['STAFF', 'BUSINESS_OWNER']) {
  for (const [expiresAt, expected] of [[null, true], [undefined, true], ['2026-10-05T10:00:00.001Z', true],
    ['2026-10-05T10:00:00.000Z', false], ['2026-10-05T09:59:59.999Z', false], ['not-a-date', false]]) {
    test(`${code} expiry ${String(expiresAt)} is ${expected ? 'usable' : 'rejected'} at fixed server instant`, () => {
      const actor = user({ roles: [code], scopes: [grant(code, { expiresAt })] });
      assert.equal(usableRole(actor, code, now), expected);
      assert.equal(mobileShell(actor, now), expected ? code === 'STAFF' ? 'STAFF' : 'OWNER' : 'UNSUPPORTED');
    });
  }
}
test('one unusable grant cannot mask a later valid grant', () => {
  assert.equal(mobileShell(user({ scopes: [grant('STAFF', { businessId: businessB }), grant()] }), now), 'STAFF');
});
test('Owner in business A cannot become Owner in business B through multi-role permissions', () => {
  const actor = user({ businessId: businessB, branchId: branchB, roles: ['STAFF', 'BUSINESS_OWNER'],
    permissions: ['booking:read:tenant', 'booking:update:tenant'], scopes: [grant('BUSINESS_OWNER'), grant('STAFF', { businessId: businessB, branchId: branchB })] });
  assert.equal(usableRole(actor, 'BUSINESS_OWNER', now), false);
  assert.equal(mobileShell(actor, now), 'STAFF');
  actor.scopes[1].expiresAt = '2026-10-05T09:00:00Z';
  assert.equal(mobileShell(actor, now), 'UNSUPPORTED');
});
test('business-wide Owner grant remains usable in a selected branch', () => {
  assert.equal(usableRole(user({ roles: ['BUSINESS_OWNER'], scopes: [grant('BUSINESS_OWNER')] }), 'BUSINESS_OWNER', now), true);
});
test('Staff branch is required on grant even without a selected session branch', () => {
  assert.equal(usableRole(user({ branchId: null }), 'STAFF', now), true);
  assert.equal(usableRole(user({ branchId: null, scopes: [grant('STAFF', { branchId: null })] }), 'STAFF', now), false);
});
test('context key is stable for an equivalent session and fences all documented dimensions', () => {
  const actor = user(), key = operationContextKey(actor, branchA, 'STAFF');
  assert.equal(operationContextKey(structuredClone(actor), branchA, 'STAFF'), key);
  for (const changes of [{ id: 'user-b' }, { workspace: 'CUSTOMER' }, { businessId: businessB }, { branchId: branchB },
    { scopes: [grant('STAFF', { expiresAt: '2026-10-05T09:00:00Z' })] }, { scopes: [] }]) {
    assert.notEqual(operationContextKey({ ...actor, ...changes }, branchA, 'STAFF'), key);
  }
  assert.notEqual(operationContextKey(actor, branchB, 'STAFF'), key);
  assert.notEqual(operationContextKey(actor, branchA, 'OWNER'), key);
  assert.notEqual(operationContextKey(null, branchA, 'STAFF'), key);
  assert.notEqual(operationContextKey(null, null, 'CUSTOMER'), key);
});
test('date selection uses branch zone across midnight, year boundary and DST', () => {
  assert.equal(dateInZone(undefined, new Date('2026-10-05T17:01:00Z')), '2026-10-06');
  assert.equal(dateInZone('UTC', new Date('2026-10-05T17:01:00Z')), '2026-10-05');
  assert.equal(dateInZone('Asia/Ho_Chi_Minh', new Date('2026-12-31T17:00:00Z')), '2027-01-01');
  assert.equal(dateInZone('America/New_York', new Date('2026-03-08T04:59:00Z')), '2026-03-07');
  assert.equal(dateInZone('America/New_York', new Date('2026-03-08T07:01:00Z')), '2026-03-08');
  assert.throws(() => dateInZone('invalid-zone', new Date(now)), RangeError);
});

const notification = changes => ({ id: 'unit-notification', title: 'Unit notification', isRead: false,
  createdAt: new Date(now).toISOString(), ...changes });
const target = (value, mode) => JSON.parse(JSON.stringify(operationNotificationTarget(notification(value), mode)));
test('Owner routes the actual deadline worker outbox payload to its impact case', async () => {
  // Execute the real producer with an in-memory database boundary; never start
  // its lifecycle timer, Nest application, Prisma client, or a network runtime.
  const filename = path.join(__dirname, '../../beauty-booking-api-main/src/operations/impact-deadline.worker.ts');
  const source = fs.readFileSync(filename, 'utf8');
  const module = { exports: {} };
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true,
  } }).outputText;
  vm.runInNewContext(js, { module, exports: module.exports, Date, encodeURIComponent,
    require: name => {
      if (name === '@nestjs/common') return { Injectable: () => value => value, Logger: class {
        error(message) { throw new Error(message); }
      } };
      if (name === '../common/utils/serializable-transaction') return {
        withSerializableTransaction: (prisma, operation) => prisma.$transaction(operation),
      };
      if (name === '../common/utils/impact-notification-labels') {
        const labelsModule = { exports: {} };
        const labelsSource = fs.readFileSync(path.join(__dirname, '../../beauty-booking-api-main/src/common/utils/impact-notification-labels.ts'), 'utf8');
        const labelsCode = ts.transpileModule(labelsSource, { compilerOptions: {
          module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        } }).outputText;
        vm.runInNewContext(labelsCode, { module: labelsModule, exports: labelsModule.exports,
          require: dependency => {
            if (dependency === '@prisma/client') return { Prisma: {} };
            throw new Error(`Impact labels unexpectedly import ${dependency}`);
          } });
        return labelsModule.exports;
      }
      throw new Error(`Deadline producer unexpectedly imports ${name}`);
    } }, { filename });
  let emitted;
  const models = {
    operationalImpactCase: { findMany: async () => [{
      id: impact, businessId: 'business-a', ownerId: 'owner-a', subjectType: 'STAFF', action: 'OFFBOARD',
      reason: 'Unit overdue case', status: 'IN_PROGRESS', deadlineAt: new Date(now - 1),
    }] },
    business: { findUnique: async () => ({ deletedAt: null, owner: { userId: 'owner-a' } }) },
    userRole: { findFirst: async () => ({ userId: 'owner-a' }) },
    notificationOutbox: { findFirst: async () => null, createMany: async input => {
      emitted = input.data;
      return { count: input.data.length };
    } },
  };
  const worker = new module.exports.ImpactDeadlineWorker({
    ...models, $transaction: operation => operation(models),
  });
  await worker.enqueueOverdueWarnings();
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].targetType, 'OPERATIONAL_IMPACT');
  assert.equal(emitted[0].targetId, impact);
  assert.equal(emitted[0].userId, 'owner-a');
  assert.deepEqual(target(emitted[0], 'OWNER'), { kind: 'IMPACT', id: impact });
  assert.equal(target(emitted[0], 'STAFF'), null);
});
for (const mode of ['STAFF', 'OWNER']) {
  test(`${mode} routes related booking UUID and ignores actionUrl`, () => {
    assert.deepEqual(target({ relatedBooking: { id: booking }, actionUrl: 'https://untrusted.invalid/?token=forbidden' }, mode), { kind: 'BOOKING', id: booking });
    assert.deepEqual(target({ relatedBooking: { id: booking.toUpperCase() } }, mode), { kind: 'BOOKING', id: booking.toUpperCase() });
  });
  test(`${mode} routes provider BOOKING UUID without a live relation and ignores metadata/URL`, () => {
    for (const targetId of [booking, booking.toUpperCase()]) {
      const value = notification({ targetType: 'BOOKING', targetId, metadata: { itemUUID: impact }, actionUrl: 'https://untrusted.invalid' });
      const before = structuredClone(value);
      assert.deepEqual(JSON.parse(JSON.stringify(operationNotificationTarget(value, mode))), { kind: 'BOOKING', id: targetId });
      assert.deepEqual(value, before);
    }
  });
  test(`${mode} preserves related-booking precedence and falls back from an invalid relation`, () => {
    assert.deepEqual(target({ relatedBooking: { id: booking }, targetType: 'BOOKING', targetId: impact }, mode), { kind: 'BOOKING', id: booking });
    assert.deepEqual(target({ relatedBooking: { id: 'BB-0096' }, targetType: 'BOOKING', targetId: booking }, mode), { kind: 'BOOKING', id: booking });
  });
  for (const id of ['', 'BB-0096', 'https://untrusted.invalid', `${booking}/edit`, ` ${booking}`, booking.replace(/-/g, ''), 'g'.repeat(36), null]) {
    test(`${mode} rejects malformed or display booking identifier ${JSON.stringify(id)}`, () => {
      assert.equal(target({ relatedBooking: { id }, actionUrl: 'beautybook://owner/impact' }, mode), null);
      assert.equal(target({ targetType: 'BOOKING', targetId: id, metadata: { itemUUID: booking }, actionUrl: `/salon/appointments?bookingId=${booking}` }, mode), null);
    });
  }
  test(`${mode} never executes unsupported URL or target types`, () => {
    for (const actionUrl of ['javascript:alert(1)', 'file:///private', 'beautybook://owner', '/salon/settings', `https://untrusted.invalid/${booking}`, `/salon/appointments?bookingId=${booking}`]) {
      assert.equal(target({ actionUrl, targetType: 'User', targetId: impact }, mode), null);
      assert.equal(target({ actionUrl, targetType: 'BOOKING' }, mode), null);
    }
    for (const targetType of ['Booking', 'booking', 'BOOKING ', 'User', null, undefined]) {
      assert.equal(target({ targetType, targetId: booking }, mode), null);
    }
  });
}
test('impact routing is Owner-only and target-type allowlist is exact', () => {
  for (const targetType of ['OPERATIONAL_IMPACT', 'OperationalImpactCase']) {
    for (const targetId of [impact, impact.toUpperCase()]) {
      assert.deepEqual(target({ targetType, targetId }, 'OWNER'), { kind: 'IMPACT', id: targetId });
      assert.equal(target({ targetType, targetId }, 'STAFF'), null);
    }
    for (const targetId of ['', 'BB-0096', 'https://untrusted.invalid', `${impact}?token=x`, `${impact}/edit`,
      ` ${impact}`, `${impact} `, impact.replace(/-/g, ''), 'g'.repeat(36), null, undefined]) {
      for (const mode of ['OWNER', 'STAFF']) assert.equal(target({ targetType, targetId, actionUrl: `/salon/operations?impactCase=${impact}` }, mode), null);
    }
  }
  for (const targetType of ['operationalimpactcase', 'operational_impact', 'OPERATIONAL_IMPACT ', 'OperationalImpactCase ', 'Booking', 'User', null]) {
    assert.equal(target({ targetType, targetId: impact }, 'OWNER'), null);
  }
});
test('related booking takes precedence over impact; invalid booking falls back only for Owner', () => {
  for (const targetType of ['OPERATIONAL_IMPACT', 'OperationalImpactCase']) {
    const value = { relatedBooking: { id: booking }, targetType, targetId: impact };
    for (const mode of ['STAFF', 'OWNER']) assert.deepEqual(target(value, mode), { kind: 'BOOKING', id: booking });
    value.relatedBooking.id = 'BB-0096';
    assert.deepEqual(target(value, 'OWNER'), { kind: 'IMPACT', id: impact });
    assert.equal(target(value, 'STAFF'), null);
  }
});

test('impact targets ignore untrusted actionUrl and metadata without mutating the payload', () => {
  for (const targetType of ['OPERATIONAL_IMPACT', 'OperationalImpactCase']) {
    for (const actionUrl of ['javascript:alert(1)', 'file:///private', 'beautybook://owner',
      'https://untrusted.invalid', `/salon/operations?impactCase=${booking}`]) {
      const value = notification({ targetType, targetId: impact, actionUrl, metadata: { itemUUID: booking }, body: 'private body' });
      const before = structuredClone(value);
      assert.deepEqual(JSON.parse(JSON.stringify(operationNotificationTarget(value, 'OWNER'))), { kind: 'IMPACT', id: impact });
      assert.equal(operationNotificationTarget(value, 'STAFF'), null);
      assert.deepEqual(value, before);
      assert.equal(target({ targetType, actionUrl, metadata: { itemUUID: impact } }, 'OWNER'), null);
    }
  }
});
test('notification target projection never carries untrusted content or mutates payload', () => {
  const value = notification({ relatedBooking: { id: booking }, body: 'private body', actionUrl: 'https://untrusted.invalid' });
  const before = structuredClone(value);
  assert.deepEqual(JSON.parse(JSON.stringify(operationNotificationTarget(value, 'OWNER'))), { kind: 'BOOKING', id: booking });
  assert.deepEqual(value, before);
});
