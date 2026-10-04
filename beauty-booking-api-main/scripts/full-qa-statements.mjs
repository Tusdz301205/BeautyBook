import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { env, db, b, test, results, login, call as rawCall, ok, close } from './full-qa-context.mjs';
const call = (method, path, actor, data) => rawCall(method, path, actor, data, method === 'POST' ? { 'Idempotency-Key': randomUUID() } : {});
try {
  for (const role of ['platform_admin', 'owner0', 'owner1']) await login(role);
  let statement;
  const periodStart = '2026-10-01', periodEnd = '2026-10-05';
  await test('STATEMENT-GENERATE-RECONCILE', 'platform fee statement generation', async () => {
    const fees = await db.platformFeeEntry.findMany({ where: { businessId: b.id, createdAt: { gte: new Date(periodStart), lte: new Date('2026-10-05T23:59:59.999Z') } } });
    const adjustments = await db.platformFeeAdjustment.findMany({ where: { businessId: b.id, createdAt: { gte: new Date(periodStart), lte: new Date('2026-10-05T23:59:59.999Z') } } });
    statement = ok(await call('POST', '/payments/platform-statements/generate', 'platform_admin', { businessId: b.id, periodStart, periodEnd }));
    const total = fees.reduce((sum, r) => sum + Number(r.feeAmount), 0) + adjustments.reduce((sum, r) => sum + Number(r.amount), 0);
    assert.equal(Number(statement.netAmount), total);
    const repeat = ok(await call('POST', '/payments/platform-statements/generate', 'platform_admin', { businessId: b.id, periodStart, periodEnd }));
    assert.equal(repeat.id, statement.id);
    assert.equal(await db.platformStatement.count({ where: { businessId: b.id, periodStart: new Date(periodStart), periodEnd: new Date(periodEnd) } }), 1);
    return { statementId: statement.id, reconciledAmount: total, retrySameStatement: true, syntheticDatabaseOnly: true };
  });
  await test('STATEMENT-TENANT-BOUNDARY', 'statement visibility and management permissions', async () => {
    assert.ok(statement);
    ok(await call('GET', `/payments/platform-statements?businessId=${b.id}`, 'owner0'));
    ok(await call('GET', `/payments/platform-statements?businessId=${b.id}`, 'owner1'), 403);
    ok(await call('PATCH', `/payments/platform-statements/${statement.id}/status`, 'owner0', { status: 'REVIEW', reason: 'QA' }), 403);
    return { tenantScoped: true, platformOnlyTransitions: true };
  });
  await test('STATEMENT-LIFECYCLE', 'statement transition integrity', async () => {
    assert.ok(statement);
    ok(await call('PATCH', `/payments/platform-statements/${statement.id}/status`, 'platform_admin', { status: 'PAID', reason: 'Invalid direct transition QA' }), 409);
    for (const status of ['REVIEW', 'ISSUED', 'OVERDUE', 'PAID']) {
      const row = ok(await call('PATCH', `/payments/platform-statements/${statement.id}/status`, 'platform_admin', { status, reason: 'Synthetic QA accounting transition' }));
      assert.equal(row.status, status);
    }
    ok(await call('PATCH', `/payments/platform-statements/${statement.id}/status`, 'platform_admin', { status: 'REVIEW', reason: 'Cannot reopen QA paid statement' }), 409);
    return { statementId: statement.id, finalStatus: 'PAID', noExternalMoneyMovement: true };
  });
  await test('VOUCHER-FRESH-UNRELATED-CUSTOMER', 'voucher cannot be granted across missing customer relationship', async () => {
    const customer = ok(await call('POST', '/auth/register', null, { email: `voucher-unrelated-${randomUUID()}@example.test`, accountType: 'CUSTOMER', fullName: 'Khách QA mới chưa đặt lịch', password: env.QA_PASSWORD }));
    const profile = await db.customerProfile.findFirstOrThrow({ where: { userId: customer.user.id } });
    assert.equal(await db.booking.count({ where: { customerId: profile.id } }), 0);
    const voucher = ok(await call('POST', '/vouchers', 'owner0', { businessId: b.id, code: `QA-${randomUUID()}`, name: 'QA unrelated grant', discountType: 'FIXED_AMOUNT', discountValue: 10000, totalQuantity: 1, startDate: new Date().toISOString(), endDate: new Date(Date.now() + 86400000).toISOString(), serviceIds: [b.serviceId] }));
    ok(await call('POST', `/vouchers/${voucher.id}/grant`, 'owner0', { customerId: profile.id }), 403);
    assert.equal(await db.customerVoucher.count({ where: { voucherId: voucher.id, customerId: profile.id } }), 0);
    return { newCustomerWithoutBookings: true, rejectedWithoutGrant: true };
  });
  console.log(JSON.stringify({ scenarios: results.length, pass: results.filter(x => x.status === 'PASS').length, fail: results.filter(x => x.status === 'FAIL').length }));
} finally { await close(); }
