import assert from 'node:assert/strict';
import { db, b, close } from './full-qa-context.mjs';
try {
  const branch = await db.branch.findFirstOrThrow({
    where: { businessId: b.id, name: 'Chi nhánh QA được lưu', reviewStatus: 'DRAFT' },
  });
  assert.notEqual(branch.id, b.branchId);
  const province = await db.province.upsert({
    where: { name: 'Tỉnh thử nghiệm QA' }, create: { name: 'Tỉnh thử nghiệm QA' }, update: {},
  });
  const district = await db.district.upsert({
    where: { provinceId_name: { provinceId: province.id, name: 'Quận thử nghiệm QA' } },
    create: { provinceId: province.id, name: 'Quận thử nghiệm QA' }, update: {},
  });
  await db.branch.update({ where: { id: branch.id }, data: { districtId: district.id } });
  console.log('Added synthetic geography to a new QA draft branch; base branches unchanged.');
} finally { await close(); }
