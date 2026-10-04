import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db, b, tokens, test, results, login, call, ok, close } from './full-qa-context.mjs';
try {
  await login('owner0');
  const name = `Variant update QA ${randomUUID()}`;
  const catalog = ok(await call('POST', '/services/catalog', 'owner0', { branchId: b.branchId, categoryId: b.categoryId, name, price: 100000, durationMinutes: 15 }));
  const offering = await db.branchServiceOffering.findFirstOrThrow({ where: { businessServiceId: catalog.id, branchId: b.branchId } });
  const variant = ok(await call('POST', `/services/${offering.id}/variants`, 'owner0', { code: 'TIMING', name, price: 100000, durationMinutes: 15 }));
  for (const [field, value] of [['bufferBeforeMinutes', null], ['bufferAfterMinutes', null], ['bufferBeforeMinutes', 1.5], ['maxDurationMinutes', '16']]) {
    await test(`VARIANT-UPDATE-${field}-${String(value)}`, 'variant update persistence validation', async () => {
      const before = await db.serviceVariant.findUniqueOrThrow({ where: { id: variant.id } });
      ok(await call('PATCH', `/services/variants/${variant.id}`, 'owner0', { [field]: value }), 400);
      const after = await db.serviceVariant.findUniqueOrThrow({ where: { id: variant.id } });
      assert.equal(after.version, before.version); assert.deepEqual(after, before);
      return { variantId: variant.id, clientError: true, noMutation: true };
    });
  }
  await test('VARIANT-UPDATE-CLEAR-OPTIONAL-DURATION', 'variant duration can inherit the service default', async () => {
    ok(await call('PATCH', `/services/variants/${variant.id}`, 'owner0', { durationMinutes: null }));
    assert.equal((await db.serviceVariant.findUniqueOrThrow({ where: { id: variant.id } })).durationMinutes, null);
    return { variantId: variant.id, nullableDurationCleared: true };
  });
  console.log(JSON.stringify({ scenarios: results.length, pass: results.filter(r => r.status === 'PASS').length, fail: results.filter(r => r.status === 'FAIL').length }));
} finally { await close(); }
