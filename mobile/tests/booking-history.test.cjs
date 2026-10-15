const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const value = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/bookingHistory.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { module: value, exports: value.exports, Date, Number, Set });
const { filterHistory, historySummary, historyDate, historyYears } = value.exports;
const row = (id, date, rawStatus, extra = {}) => ({ id, date, rawStatus, isReal: true, ...extra });

test('summary never treats elapsed check-in, no-show, rejection or expiry as completion/cancellation', () => {
  const entries = [row('1', '15/10/2026', 'COMPLETED'), row('2', '15/10/2026', 'CANCELLED'),
    row('3', '15/10/2026', 'CHECKED_IN', { status: 'completed' }), row('4', '15/10/2026', 'NO_SHOW'),
    row('5', '15/10/2026', 'REJECTED'), row('6', '15/10/2026', 'EXPIRED')];
  assert.deepEqual(JSON.parse(JSON.stringify(historySummary(entries))), { total: 6, completed: 1, cancelled: 1 });
});

test('month/year filters use the appointment wall date and keep list/stat counts aligned', () => {
  const entries = [row('1', '01/10/2026', 'COMPLETED'), row('2', '31/10/2026', 'CANCELLED'),
    row('3', '30/09/2026', 'COMPLETED'), row('4', '01/10/2025', 'COMPLETED')];
  const filtered = filterHistory(entries, { month: 10, year: 2026 });
  assert.deepEqual(Array.from(filtered, entry => entry.id), ['1', '2']);
  assert.equal(historySummary(filtered).total, 2);
  assert.equal(filterHistory(entries, { month: 10, year: null }).length, 3);
  assert.equal(filterHistory(entries, { month: 11, year: 2026 }).length, 0);
});

test('ignores duplicate/demo rows, validates dates, supports all periods and historical years', () => {
  const entries = [row('1', '29/02/2024', 'COMPLETED'), row('1', '29/02/2024', 'COMPLETED'),
    row('demo', '12/10/2026', 'COMPLETED', { isReal: false })];
  assert.equal(filterHistory(entries, { month: null, year: null }).length, 1);
  assert.equal(historyDate('29/02/2025'), null);
  assert.equal(historyDate('31/04/2026'), null);
  assert.deepEqual(Array.from(historyYears(entries, 2026)), [2026, 2024]);
});
