/**
 * Read-only mechanical Prisma inventory. Emits an apply_patch payload to stdout;
 * does not connect to a database or modify the schema/generated Prisma client.
 * Run from any directory: node scripts/build-schema-inventory.mjs
 * The receiving tool applies only the two tmp/manager-refactor artifact files.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(backendRoot, 'prisma/schema.prisma');
const source = readFileSync(sourcePath, 'utf8');
const lines = source.split(/\r?\n/);

function splitArguments(input) {
  const parts = [];
  let start = 0;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if ('([{'.includes(char)) depth += 1;
    else if (')]}'.includes(char)) depth -= 1;
    else if (char === ',' && depth === 0) {
      parts.push(input.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (input.slice(start).trim()) parts.push(input.slice(start).trim());
  return parts;
}

function parseAttributes(input, sourceLine) {
  const attributes = [];
  let i = 0;
  while (i < input.length) {
    if (/\s/.test(input[i])) { i += 1; continue; }
    if (input.slice(i, i + 2) === '//') break;
    const match = /^(@@?)([A-Za-z_][\w.]*)/.exec(input.slice(i));
    if (!match) throw new Error(`Unsupported attribute at line ${sourceLine}: ${input.slice(i)}`);
    const start = i;
    i += match[0].length;
    let args = [];
    if (input[i] === '(') {
      const argumentStart = i + 1;
      let depth = 1;
      let quoted = false;
      let escaped = false;
      i += 1;
      while (i < input.length && depth > 0) {
        const char = input[i];
        if (quoted) {
          if (escaped) escaped = false;
          else if (char === '\\') escaped = true;
          else if (char === '"') quoted = false;
        } else if (char === '"') quoted = true;
        else if (char === '(') depth += 1;
        else if (char === ')') depth -= 1;
        i += 1;
      }
      if (depth !== 0) throw new Error(`Unbalanced attribute at line ${sourceLine}`);
      args = splitArguments(input.slice(argumentStart, i - 1));
    }
    attributes.push({ name: match[2], block: match[1] === '@@', arguments: args, raw: input.slice(start, i) });
  }
  return attributes;
}

const declarations = [];
let current;
for (let i = 0; i < lines.length; i += 1) {
  const raw = lines[i].trim();
  if (!current) {
    const declaration = /^(model|enum)\s+(\w+)\s*\{$/.exec(raw);
    if (declaration) {
      current = { kind: declaration[1], name: declaration[2], sourceLine: i + 1, fields: [], attributes: [] };
      declarations.push(current);
    }
    continue;
  }
  if (raw === '}') { current.endLine = i + 1; current = undefined; continue; }
  if (!raw || raw.startsWith('//')) continue;
  if (raw.startsWith('@@')) {
    current.attributes.push(...parseAttributes(raw, i + 1).map((attribute) => ({ ...attribute, sourceLine: i + 1 })));
    continue;
  }
  if (current.kind === 'enum') {
    const value = /^(\w+)\s*(.*)$/.exec(raw);
    if (!value) throw new Error(`Unsupported enum declaration line ${i + 1}`);
    current.fields.push({ name: value[1], attributes: parseAttributes(value[2], i + 1), sourceLine: i + 1, raw });
    continue;
  }
  const field = /^(\w+)\s+(\w+)(\[\]|\?)?\s*(.*)$/.exec(raw);
  if (!field) throw new Error(`Unsupported model declaration line ${i + 1}: ${raw}`);
  current.fields.push({
    name: field[1], type: field[2], list: field[3] === '[]', optional: field[3] === '?',
    attributes: parseAttributes(field[4], i + 1), sourceLine: i + 1, raw,
  });
}
if (current) throw new Error(`Unterminated ${current.kind} ${current.name}`);

const models = declarations.filter((item) => item.kind === 'model');
const enums = declarations.filter((item) => item.kind === 'enum');
const modelNames = new Set(models.map((item) => item.name));
const enumNames = new Set(enums.map((item) => item.name));
const attr = (item, name) => item.attributes.find((entry) => entry.name === name);
const unquote = (value) => value?.startsWith('"') ? JSON.parse(value) : value;
const fieldList = (value) => value?.startsWith('[') ? splitArguments(value.slice(1, -1)) : [];

for (const model of models) {
  model.tableName = unquote(attr(model, 'map')?.arguments[0]) ?? model.name;
  for (const field of model.fields) {
    field.kind = modelNames.has(field.type) ? 'relation' : enumNames.has(field.type) ? 'enum' : 'scalar';
    field.columnName = field.kind === 'relation' ? null : unquote(attr(field, 'map')?.arguments[0]) ?? field.name;
    field.isId = Boolean(attr(field, 'id'));
    field.isUnique = Boolean(attr(field, 'unique'));
    const relation = attr(field, 'relation');
    if (field.kind === 'relation') {
      const argumentsByName = Object.fromEntries((relation?.arguments ?? [])
        .filter((argument) => /^\w+:/.test(argument))
        .map((argument) => {
          const colon = argument.indexOf(':');
          return [argument.slice(0, colon), argument.slice(colon + 1).trim()];
        }));
      field.relation = {
        targetModel: field.type,
        name: unquote(relation?.arguments.find((argument) => argument.startsWith('"'))) ?? null,
        fields: fieldList(argumentsByName.fields), references: fieldList(argumentsByName.references),
        onDelete: argumentsByName.onDelete ?? null, onUpdate: argumentsByName.onUpdate ?? null,
        map: unquote(argumentsByName.map) ?? null,
        explicit: Boolean(relation),
      };
    }
  }
  model.indexes = model.attributes.filter((item) => item.name === 'index' || item.name === 'fulltext');
  model.uniqueConstraints = [
    ...model.attributes.filter((item) => item.name === 'unique').map((item) => ({ ...item, fields: fieldList(item.arguments[0]) })),
    ...model.fields.filter((field) => field.isUnique).map((field) => ({ ...attr(field, 'unique'), fields: [field.name], sourceLine: field.sourceLine })),
  ];
  model.primaryKeys = [
    ...model.attributes.filter((item) => item.name === 'id').map((item) => ({ ...item, fields: fieldList(item.arguments[0]) })),
    ...model.fields.filter((field) => field.isId).map((field) => ({ ...attr(field, 'id'), fields: [field.name], sourceLine: field.sourceLine })),
  ];
  model.relationFields = model.fields.filter((field) => field.kind === 'relation').map((field) => field.name);
}
for (const enumItem of enums) {
  enumItem.values = enumItem.fields;
  delete enumItem.fields;
}

const inventory = {
  status: 'MECHANICAL_INVENTORY_ONLY_PHASE_2_CLASSIFICATION_DEFERRED',
  source: 'beauty-booking-api-main/prisma/schema.prisma',
  sourceSha256: createHash('sha256').update(source).digest('hex'),
  counts: {
    models: models.length, enums: enums.length,
    fields: models.reduce((sum, model) => sum + model.fields.length, 0),
    relationFields: models.reduce((sum, model) => sum + model.relationFields.length, 0),
    indexes: models.reduce((sum, model) => sum + model.indexes.length, 0),
    uniqueConstraints: models.reduce((sum, model) => sum + model.uniqueConstraints.length, 0),
    primaryKeys: models.reduce((sum, model) => sum + model.primaryKeys.length, 0),
    enumValues: enums.reduce((sum, enumItem) => sum + enumItem.values.length, 0),
  },
  limitations: [
    'This inventories checked-in Prisma declarations only; it is not introspection of the live database.',
    'SQL-only indexes, constraints, triggers, functions, archived tables and legacy enum types require separate live catalog inspection.',
    'Relations without explicit actions report null; no referential action is inferred.',
    'No keep/remove/merge or normalized-role classification is finalized until Manager Phase 1 is verified.',
  ],
  models, enums,
};

if (models.length !== 131 || enums.length !== 101) {
  throw new Error(`Schema baseline changed: ${models.length} models / ${enums.length} enums. Review before regenerating inventory.`);
}
const escapeCell = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
const md = [
  '# Full mechanical Prisma schema inventory', '',
  'Status: mechanical inventory only. Phase 2 classification is deferred until Manager Phase 1 is verified.', '',
  `Source: \`${inventory.source}\``, '',
  `Source SHA-256: \`${inventory.sourceSha256}\``, '',
  `Counts: **${models.length} models**, **${enums.length} enums**, ${inventory.counts.fields} model fields, ${inventory.counts.relationFields} relation fields, ${inventory.counts.indexes} model indexes, ${inventory.counts.uniqueConstraints} unique constraints, ${inventory.counts.primaryKeys} primary keys, ${inventory.counts.enumValues} enum values.`, '',
  ...inventory.limitations.map((limitation) => `- ${limitation}`), '',
  '## Model index', '',
  '| Model | SQL table | Fields | Relation fields | Indexes | Unique | Source line |',
  '| --- | --- | ---: | ---: | ---: | ---: | ---: |',
  ...models.map((model) => `| ${model.name} | ${model.tableName} | ${model.fields.length} | ${model.relationFields.length} | ${model.indexes.length} | ${model.uniqueConstraints.length} | ${model.sourceLine} |`), '',
];
for (const model of models) {
  md.push(`## Model ${model.name}`, '', `SQL table: \`${model.tableName}\`. Source line: ${model.sourceLine}.`, '',
    '| Field | Type | Kind | SQL column | Attributes | Line |', '| --- | --- | --- | --- | --- | ---: |');
  for (const field of model.fields) {
    md.push(`| ${field.name} | ${field.type}${field.list ? '[]' : field.optional ? '?' : ''} | ${field.kind} | ${field.columnName ?? '(relation)'} | ${escapeCell(field.attributes.map((attribute) => attribute.raw).join(' '))} | ${field.sourceLine} |`);
  }
  md.push('', 'Model-level attributes (indexes, compound keys, mappings and other declarations):', '');
  md.push(...(model.attributes.length ? model.attributes.map((attribute) => `- \`${attribute.raw}\` (line ${attribute.sourceLine})`) : ['- None.']), '');
  md.push('Relations:', '');
  for (const field of model.fields.filter((field) => field.kind === 'relation')) {
    const relation = field.relation;
    md.push(`- \`${field.name}\` → \`${relation.targetModel}\`${field.list ? ' (list)' : field.optional ? ' (optional)' : ' (required)'}`
      + `; relation name: ${relation.name ?? '(implicit)'}`
      + `; local fields: [${relation.fields.join(', ')}]; referenced fields: [${relation.references.join(', ')}]`
      + `; onDelete: ${relation.onDelete ?? '(not explicit)'}; onUpdate: ${relation.onUpdate ?? '(not explicit)'}.`);
  }
  if (!model.relationFields.length) md.push('- None.');
  md.push('');
}
md.push('## Enums', '', '| Enum | Values | Source line |', '| --- | --- | ---: |');
for (const enumItem of enums) {
  md.push(`| ${enumItem.name} | ${escapeCell(enumItem.values.map((value) => value.raw).join(', '))} | ${enumItem.sourceLine} |`);
}
md.push('');

const outputs = [
  ['tmp/manager-refactor/schema-inventory.json', `${JSON.stringify(inventory, null, 2)}\n`],
  ['tmp/manager-refactor/schema-inventory.md', `${md.join('\n')}\n`],
];
const patch = `*** Begin Patch\n${outputs.map(([path, content]) =>
  `*** Add File: ${path}\n${content.trimEnd().split('\n').map((line) => `+${line}`).join('\n')}`
).join('\n')}\n*** End Patch\n`;
// Chunked transport keeps tool output limits from silently truncating an
// otherwise complete inventory. Concatenate every chunk before apply_patch.
const chunkSize = 80000;
if (process.argv.includes('--meta')) {
  process.stdout.write(JSON.stringify({ characters: patch.length, chunks: Math.ceil(patch.length / chunkSize), counts: inventory.counts }));
} else if (process.argv.includes('--chunk')) {
  const index = Number(process.argv[process.argv.indexOf('--chunk') + 1]);
  if (!Number.isInteger(index) || index < 0 || index >= Math.ceil(patch.length / chunkSize)) {
    throw new Error('Invalid inventory patch chunk index');
  }
  process.stdout.write(patch.slice(index * chunkSize, (index + 1) * chunkSize));
} else {
  process.stdout.write(patch);
}
