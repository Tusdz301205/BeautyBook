import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { transformSync } from 'esbuild';

// Compile only the actual Field function, keeping unrelated UI changes out of
// the baseline comparison. FIELD_TEST_SOURCE selects a preserved HEAD snapshot.
const source = readFileSync(process.env.FIELD_TEST_SOURCE || new URL('./index.jsx', import.meta.url), 'utf8');
const start = source.indexOf('export function Field(');
const end = source.indexOf('\nconst controlClass', start);
assert.ok(start >= 0 && (end > start || source.trimEnd().endsWith('}')), 'Field source is present');
const fieldSource = source.slice(start, end > start ? end : undefined);
const compiled = transformSync(fieldSource, { loader: 'jsx', jsx: 'automatic', format: 'cjs' }).code;
// Component identities stand in for the imported controls; their rendering,
// hooks, and browser behavior are intentionally outside this Field unit suite.
const Input = React.forwardRef(() => null);
const Select = React.forwardRef(() => null);
const Textarea = React.forwardRef(() => null);
const module = { exports: {} };
vm.runInNewContext(compiled, {
  module, exports: module.exports, React, Input, Select, Textarea,
  useId: () => ':field-test:', cx: (...values) => values.filter(Boolean).join(' '),
  require: name => {
    assert.equal(name, 'react/jsx-runtime');
    return jsxRuntime;
  },
});
const Field = module.exports.Field;
const element = (type, props = {}, ...children) => React.createElement(type, props, ...children);
const nodes = value => Array.isArray(value) ? value.flatMap(nodes)
  : React.isValidElement(value) ? [value, ...nodes(value.props.children)] : [];
const text = value => Array.isArray(value) ? value.map(text).join('')
  : React.isValidElement(value) ? text(value.props.children)
    : value == null || typeof value === 'boolean' ? '' : String(value);
const render = (children, props = {}) => Field({ label: 'Transfer destination', children, ...props });
const controlOf = (tree, type) => nodes(tree).find(node => node.type === type);
function associated(tree, control) {
  assert.equal(tree.type, 'label');
  assert.ok(control.props.id, 'control has an ID');
  assert.equal(tree.props.htmlFor, control.props.id, 'label targets the control');
  assert.match(text(tree.props.children[0]), /Transfer destination/, 'associated label has text');
}
function described(tree, control, message, role) {
  const description = nodes(tree).find(node => node.props.id === control.props['aria-describedby']);
  assert.ok(description, 'aria-describedby resolves to a rendered element');
  assert.equal(text(description), message);
  if (role) assert.equal(description.props.role, role);
}

for (const [name, type] of [['Input', Input], ['Select', Select], ['Textarea', Textarea],
  ['native input', 'input'], ['native select', 'select'], ['native textarea', 'textarea']]) {
  test(`${name}: sole control retains label, required, error and caller props`, () => {
    const onChange = () => {};
    const original = element(type, { name: 'destination', value: 'branch-a', onChange, required: true });
    const tree = render(original, { required: true, error: 'Choose a destination' });
    const control = controlOf(tree, type);
    associated(tree, control);
    assert.equal(control.props['aria-required'], true);
    assert.equal(control.props['aria-invalid'], true);
    described(tree, control, 'Choose a destination', 'alert');
    assert.equal(control.props.name, 'destination');
    assert.equal(control.props.value, 'branch-a');
    assert.equal(control.props.onChange, onChange);
    assert.equal(control.props.required, true);
    assert.equal(original.props.id, undefined);
  });
  test(`${name}: recognized direct control after a paragraph is associated`, () => {
    const tree = render([element('p', { key: 'before' }, 'Before'), element(type, { key: 'control' })]);
    const control = controlOf(tree, type);
    associated(tree, control);
    assert.equal(control.props['aria-invalid'], false);
    assert.equal(control.props['aria-required'], undefined);
    assert.equal(control.props['aria-describedby'], undefined);
    assert.equal(controlOf(tree, 'p').props.id, undefined);
  });
}

for (const sibling of [false, null]) {
  test(`Select plus ${sibling}: actual transfer array gets label and required/error attributes`, () => {
    const tree = render([element(Select, { key: 'destination' }), sibling], {
      required: true, error: 'Destination is required',
    });
    const control = controlOf(tree, Select);
    associated(tree, control);
    assert.equal(control.props['aria-required'], true);
    assert.equal(control.props['aria-invalid'], true);
    described(tree, control, 'Destination is required', 'alert');
  });
}

for (const position of ['before', 'after']) {
  test(`Select plus paragraph ${position}: preserves text and accessible error association`, () => {
    const paragraph = element('p', { key: 'explanation', id: 'transfer-explanation' }, 'Only eligible branches appear');
    const select = element(Select, { key: 'destination' });
    const children = position === 'before' ? [paragraph, select] : [select, paragraph];
    const tree = render(children, { required: true, hint: 'Choose carefully', error: 'Choose another branch' });
    const control = controlOf(tree, Select);
    associated(tree, control);
    assert.equal(control.props['aria-required'], true);
    assert.equal(control.props['aria-invalid'], true);
    described(tree, control, 'Choose another branch', 'alert');
    assert.equal(controlOf(tree, 'p').props.id, 'transfer-explanation');
    assert.equal(text(controlOf(tree, 'p')), 'Only eligible branches appear');
    assert.ok(!text(tree).includes('Choose carefully'), 'error takes precedence over Field hint');
    const content = React.Children.toArray(tree.props.children).filter(node => node.type === Select || node.type === 'p');
    assert.deepEqual(content.map(node => node.type), position === 'before' ? ['p', Select] : [Select, 'p']);
  });
}

test('existing custom control ID is used by the label while description IDs remain resolvable', () => {
  for (const feedback of [{ hint: 'Transfer guidance' }, { error: 'Transfer blocked' }]) {
    const tree = render([element(Select, { id: 'transfer-branch', key: 'control' }), false], feedback);
    const control = controlOf(tree, Select);
    associated(tree, control);
    assert.equal(control.props.id, 'transfer-branch');
    described(tree, control, feedback.hint || feedback.error);
  }
});

test('only the first recognized control receives generated ID and Field aria attributes', () => {
  for (const secondaryProps of [{}, { id: 'secondary', 'aria-describedby': 'own-help', 'aria-invalid': false, 'aria-required': false }]) {
    const secondary = element(Input, { key: 'secondary', ...secondaryProps });
    const tree = render([element(Select, { key: 'primary' }), secondary], { required: true, error: 'Primary error' });
    const primary = controlOf(tree, Select);
    const other = controlOf(tree, Input);
    associated(tree, primary);
    assert.notEqual(other.props.id, primary.props.id);
    assert.deepEqual(other.props, secondary.props, 'secondary props remain intact');
  }
});

test('ordinary text, numeric children, paragraphs and hints survive without mutating input objects', () => {
  const onChange = () => {};
  const original = element(Select, { key: 'control', name: 'destination', onChange }, element('option', { value: 'a' }, 'Branch A'));
  const paragraph = element('p', { key: 'explanation' }, 'Additional guidance');
  const propsBefore = { ...original.props };
  const paragraphBefore = { ...paragraph.props };
  const children = Object.freeze(['Before ', false, original, null, paragraph, ' After ', 0]);
  const tree = render(children, { hint: 'Field guidance' });
  const control = controlOf(tree, Select);
  associated(tree, control);
  described(tree, control, 'Field guidance');
  assert.match(text(tree), /Before Branch AAdditional guidance After 0Field guidance/);
  assert.deepEqual(original.props, propsBefore);
  assert.deepEqual(paragraph.props, paragraphBefore);
  assert.equal(children[2], original);
  assert.equal(children[4], paragraph);
  assert.equal(control.props.children, original.props.children);
  assert.equal(control.props.onChange, onChange);
  assert.equal(original.props.id, undefined);
  assert.equal(paragraph.props['aria-describedby'], undefined);
});

test('unknown single custom child preserves historical generated and existing ID behavior', () => {
  const CustomControl = () => null;
  for (const id of [undefined, 'custom-control']) {
    const original = element(CustomControl, { id });
    const tree = render(original, { required: true, hint: 'Custom guidance' });
    const control = controlOf(tree, CustomControl);
    associated(tree, control);
    assert.equal(control.props.id, id || ':field-test:');
    assert.equal(control.props['aria-required'], true);
    described(tree, control, 'Custom guidance');
    assert.equal(original.props.id, id);
  }
});

test('empty and text-only children retain content without creating a control', () => {
  for (const children of [null, undefined, false, [], ['Text only ', 0]]) {
    const tree = render(children, { hint: 'Guidance' });
    assert.equal(tree.type, 'label');
    assert.equal(nodes(tree).filter(node => [Input, Select, Textarea, 'input', 'select', 'textarea'].includes(node.type)).length, 0);
    assert.ok(text(tree).includes(text(children)));
    assert.ok(text(tree).includes('Guidance'));
  }
});
