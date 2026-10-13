import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

const nodes = value => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(nodes) : [value, ...nodes(value.props?.children)];
const text = value => value == null || typeof value === 'boolean' ? '' : typeof value === 'function' ? text(value({ isActive: false })) : Array.isArray(value) ? value.map(text).join(' ') : typeof value === 'object' ? text(value.props?.children) : String(value);
const jsx = (type, props) => ({ type, props });
const symbols = new Proxy({}, { get: (_, key) => key });
function compile(relative, modules) {
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
  const module = { exports: {} };
  vm.runInNewContext(transformSync(source, { loader: 'jsx', jsx: 'automatic', format: 'cjs' }).code, {
    module, exports: module.exports, URLSearchParams, require: key => { assert.ok(key in modules, `Unexpected dependency ${key}`); return modules[key]; },
  });
  return module.exports;
}

for (const role of ['BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF', 'PLATFORM_ADMIN']) {
  test(`actual ${role} sidebar has no ownership entry while retaining account/navigation`, () => {
    const user = { fullName: 'Demo dài', roles: [role], scopes: [], businessId: 'biz' };
    const store = selector => selector({ user, can: () => true, logout() {} });
    const module = compile('../components/layout/AppShell.jsx', {
      react: { useState: value => [value, () => {}], useRef: value => ({ current: value }), useEffect() {}, useMemo: fn => fn() },
      'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-router-dom': { NavLink: 'NavLink', useNavigate: () => () => {} },
      'lucide-react': symbols, '../../store/authStore': { useAuthStore: store }, '../../api/apiClient': { businessApi: {} },
      '../../config/featureAvailability': { FINANCE_WORKSPACE_ENABLED: false }, '../ui': { IconButton: 'IconButton', cx: (...x) => x.filter(Boolean).join(' ') },
      '../../hooks/useUnreadNotifications': { useUnreadNotifications: () => 0 },
    });
    const tree = module.AppShell({ zone: role === 'PLATFORM_ADMIN' ? 'platform' : 'salon', children: 'Current workspace' });
    const links = nodes(tree).filter(x => x.type === 'NavLink');
    assert.ok(links.length > 0);
    assert.ok(links.every(x => !/ownership/.test(x.props.to)));
    assert.ok(!/chuyển chủ|Chuyển quyền sở hữu/i.test(text(tree)));
    assert.ok(text(tree).includes('Thông báo'));
    assert.ok(text(tree).includes('Current workspace'));
  });
}

for (const tab of ['documents', 'audit', 'unknown']) {
  test(`actual staff detail normalizes legacy ${tab} tab and renders profile without raw audit`, () => {
    const params = new URLSearchParams(`tab=${tab}&branchId=kept`), replacements = [], effects = [];
    const staff = { fullName: 'Mai Phúc Mạnh', position: 'Chuyên viên nail', branch: { name: 'Lan Anh', id: 'branch' }, auditTrail: [{ action: 'RAW_PRIVATE_ACTION', entityType: 'RawEntity' }] };
    let stateIndex = 0; const initial = [staff, false, ''];
    const module = compile('../pages/Salon/StaffDetail.jsx', {
      react: { useEffect: fn => effects.push(fn), useMemo: fn => fn(), useState: () => [initial[stateIndex++], () => {}] },
      'react/jsx-runtime': { jsx, jsxs: jsx },
      'react-router-dom': { Link: 'Link', useParams: () => ({ staffId: 'staff' }), useSearchParams: () => [params, (value, options) => replacements.push({ value, options })] },
      'lucide-react': symbols, 'react-hot-toast': {}, '../../api/apiClient': { staffApi: {} },
      '../../store/authStore': { useAuthStore: () => () => false }, '../../components/ui': symbols,
      '../../utils/displayLabels': { statusLabel: value => value },
    });
    const tree = module.default(); effects[0]();
    assert.deepEqual(nodes(tree).filter(x => x.props?.role === 'tab').map(x => text(x)), ['Tổng quan', 'Tài khoản', 'Vai trò & chi nhánh', 'Dịch vụ']);
    assert.ok(text(tree).includes('Mai Phúc Mạnh'));
    assert.ok(!text(tree).includes('RAW_PRIVATE_ACTION'));
    assert.equal(replacements.length, 1); assert.equal(replacements[0].value.get('tab'), 'profile');
    assert.equal(replacements[0].value.get('branchId'), 'kept'); assert.equal(replacements[0].options.replace, true);
  });
}
