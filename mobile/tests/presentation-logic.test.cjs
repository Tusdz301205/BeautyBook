const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, modules = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  const module = { exports: {} };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, Date, Intl, Number, Object, Map, Set, Math, require: name => {
    assert.ok(name in modules, `Unexpected import: ${name}`); return modules[name];
  } }, { filename: file });
  return module.exports;
}

const theme = load('theme/index.ts');
const catalogModels = load('data/catalogModels.ts');

// WCAG 2.x relative luminance contrast.
const luminance = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('every status tone and service family keeps text at AA contrast on its own tint', () => {
  for (const [name, tone] of Object.entries(theme.tones)) assert.ok(contrast(tone.fg, tone.bg) >= 4.5, `tone ${name}: ${contrast(tone.fg, tone.bg).toFixed(2)}`);
  for (const [name, family] of Object.entries(theme.families)) assert.ok(contrast(family.fg, family.soft) >= 4.5, `family ${name}: ${contrast(family.fg, family.soft).toFixed(2)}`);
  const { colors } = theme;
  for (const [fg, bg, label] of [
    [colors.onPrimary, colors.primary, 'CTA'], [colors.onPrimary, colors.primaryPressed, 'CTA pressed'], [colors.white, colors.secondary, 'plum surface'],
    [colors.heading, colors.background, 'heading'], [colors.body, colors.background, 'body'], [colors.secondaryText, colors.background, 'secondary'],
    [colors.secondaryText, colors.surfaceMuted, 'secondary on muted'], [colors.primary, colors.primarySoft, 'berry on tint'], [colors.primary, colors.surface, 'berry on white'],
  ]) assert.ok(contrast(fg, bg) >= 4.5, `${label}: ${contrast(fg, bg).toFixed(2)}`);
  // Gradient hero stops must all carry white text.
  for (const stop of [...theme.gradients.brand, ...theme.gradients.dusk]) assert.ok(contrast('#FFFFFF', stop) >= 4.5, `gradient stop ${stop}`);
  // Control outlines need 3:1 against the surface.
  assert.ok(contrast(colors.borderStrong, colors.surface) >= 3);
});

test('every booking status has a tone and an icon, so colour is never the only signal', () => {
  for (const status of ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'REJECTED', 'NO_SHOW']) {
    const look = theme.bookingTone[status];
    assert.ok(look && theme.tones[look.tone] && look.icon, status);
  }
});

test('service families are chosen deterministically from the name, never at random', () => {
  const cases = { 'Nhuộm tóc': 'hair', 'Cắt tóc nam': 'hair', 'Gội đầu dưỡng sinh': 'hair', 'Sơn gel': 'nails', 'Chăm sóc móng': 'nails', 'Chăm sóc da': 'skin',
    'Massage body': 'spa', 'Trang điểm': 'brow', 'Điêu khắc lông mày 8D': 'brow', 'Triệt lông': 'glow', '': 'glow' };
  for (const [name, family] of Object.entries(cases)) {
    assert.equal(theme.familyOf(name), family, name);
    assert.equal(theme.familyOf(name), theme.familyOf(name));
  }
  assert.equal(theme.familyOf(null), 'glow');
});

test('type tokens select a font family per weight and never rely on synthetic bold', () => {
  for (const [name, token] of Object.entries(theme.type)) {
    assert.ok(typeof token.fontFamily === 'string' && token.fontFamily.length > 0, name);
    assert.equal('fontWeight' in token, false, name);
    assert.ok(token.fontSize >= 12, `${name} is below the 12px minimum`);
  }
});

test('price labels keep fixed / from / quote semantics instead of one flat number', () => {
  const { servicePriceLabel } = catalogModels;
  assert.equal(servicePriceLabel({ price: 150000, priceKind: 'fixed' }), '150.000 đ');
  assert.equal(servicePriceLabel({ price: 150000, priceKind: 'from' }), 'Từ 150.000 đ');
  assert.equal(servicePriceLabel({ price: 0, priceKind: 'quote' }), 'Cần tư vấn');
  assert.equal(servicePriceLabel({ price: 0 }), 'Liên hệ cơ sở');
  assert.equal(servicePriceLabel({ price: 150000, priceKind: 'from', priceDisplay: '150k – 300k' }), '150k – 300k');
});

test('a service the customer arrived with leads the venue list without reordering anything else', () => {
  const { leadWithRequested } = catalogModels;
  const groups = [
    { name: 'Móng', items: [{ id: 'm1' }, { id: 'm2' }] },
    { name: 'Tóc', items: [{ id: 't1' }, { id: 't2' }, { id: 't3' }] },
    { name: 'Da', items: [{ id: 'd1' }] },
  ];
  const order = list => list.map(group => `${group.name}:${group.items.map(item => item.id).join(',')}`).join(' | ');
  assert.equal(leadWithRequested(groups, []), groups);
  assert.equal(order(leadWithRequested(groups, ['t2'])), 'Tóc:t2,t1,t3 | Móng:m1,m2 | Da:d1');
  assert.equal(order(leadWithRequested(groups, ['d1', 'm2'])), 'Móng:m2,m1 | Da:d1 | Tóc:t1,t2,t3');
  // A stale id from an old link changes nothing, and the source groups are never mutated.
  assert.equal(order(leadWithRequested(groups, ['gone'])), order(groups));
  assert.equal(order(groups), 'Móng:m1,m2 | Tóc:t1,t2,t3 | Da:d1');
});

test('catalogue mapping: variant prices, branch rating aggregate and staff profile come from the API as-is', () => {
  const { mapService, mapBranchDetail, mapStaff } = load('mappers/catalog.ts');
  const base = { id: 's', branchId: 'b', name: 'Dịch vụ', price: 500000, durationMinutes: 60 };
  assert.equal(mapService(base).priceKind, 'fixed');
  const withVariants = mapService({ ...base, variants: [{ id: 'a', name: 'Ngắn', priceType: 'FIXED', price: 300000 }, { id: 'b', name: 'Dài', priceType: 'FIXED', price: '450000' }, { id: 'c', name: 'Tư vấn', priceType: 'QUOTE' }] });
  assert.equal(withVariants.priceKind, 'from'); assert.equal(withVariants.price, 300000);
  assert.equal(mapService({ ...base, variants: [{ id: 'c', name: 'Tư vấn', priceType: 'QUOTE' }, { id: 'd', name: 'Khám', priceType: 'FIXED', price: 1, consultationRequired: true }] }).priceKind, 'quote');

  const rated = mapBranchDetail({ id: 'branch', businessId: 'business', name: 'Chi nhánh', stats: { averageRating: 4.5, totalReviews: '57' } });
  assert.equal(rated.rating, 4.5); assert.equal(rated.reviewCount, 57);
  const unrated = mapBranchDetail({ id: 'branch', businessId: 'business', name: 'Chi nhánh' });
  assert.equal(unrated.rating, 0); assert.equal(unrated.reviewCount, 0);

  const [person] = mapStaff([{ id: 'st', fullName: 'Phan Bích Uyên', professionalTitle: 'Chuyên viên nail', specialties: ['Sơn gel', ''], avatarUrl: null, rating: 4.2, ratingCount: 25 }]);
  assert.equal(person.title, 'Chuyên viên nail'); assert.deepEqual(Array.from(person.specialties), ['Sơn gel']);
  assert.equal(person.avatarUrl, undefined); assert.equal(person.ratingCount, 25);
});

test('booking slots are labelled in the backend booking zone, independent of the device timezone', () => {
  const clock = load('utils/bookingClock.ts');
  // 01:00 UTC = 08:00 in Asia/Ho_Chi_Minh on the same day; 18:30 UTC = 01:30 next day.
  assert.equal(clock.slotClock('2026-10-14T01:00:00.000Z'), '08:00');
  assert.equal(clock.slotHour('2026-10-14T01:00:00.000Z'), 8);
  assert.equal(clock.slotClock('2026-10-14T18:30:00.000Z'), '01:30');
  assert.equal(clock.slotDate('2026-10-14T18:30:00.000Z'), 'Thứ Năm, 15/10/2026');
  assert.equal(clock.slotClock('not-a-date'), '--:--');
  assert.ok(Number.isNaN(clock.slotHour('not-a-date')));
  assert.equal(clock.slotClock('2026-10-14T01:00:00.000Z', 'Asia/Tokyo'), '10:00');
});
