/** Read-only Phase 2 evidence collector. Prints JSON; never modifies the DB.
 * Direct delegates/SQL are leads, not proof that a model is unused: nested
 * Prisma relations, constraints and historical retention also matter.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const backend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const inventory = JSON.parse(readFileSync(resolve(backend, '../tmp/manager-refactor/schema-inventory.json'), 'utf8'));
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function emit(value) {
  const json = JSON.stringify(value);
  const size = 20000;
  if (process.argv.includes('--meta')) {
    process.stdout.write(JSON.stringify({ characters: json.length, chunks: Math.ceil(json.length / size) }));
  } else if (process.argv.includes('--chunk')) {
    const index = Number(process.argv[process.argv.indexOf('--chunk') + 1]);
    if (!Number.isInteger(index) || index < 0 || index >= Math.ceil(json.length / size)) throw new Error('Invalid output chunk');
    process.stdout.write(json.slice(index * size, (index + 1) * size));
  } else process.stdout.write(json);
}
function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.ts$/.test(path) && !/\.spec\.ts$/.test(path) ? [path] : [];
  });
}
const sources = sourceFiles(resolve(backend, 'src')).map((file) => ({
  path: file.slice(backend.length + 1).replaceAll('\\', '/'), lines: readFileSync(file, 'utf8').split(/\r?\n/),
}));
const operations = 'findMany|findFirst|findFirstOrThrow|findUnique|findUniqueOrThrow|create|createMany|update|updateMany|upsert|delete|deleteMany|count|aggregate|groupBy';
const models = inventory.models.map((model) => {
  const delegate = model.name[0].toLowerCase() + model.name.slice(1);
  const direct = new RegExp(`\\.${escape(delegate)}\\s*\\.\\s*(${operations})\\s*\\(`);
  const sql = new RegExp(`\\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\\s+["']?${escape(model.tableName)}["']?\\b`, 'i');
  const references = sources.flatMap((source) => source.lines.flatMap((line, index) => {
    const hit = direct.exec(line);
    return hit || sql.test(line) ? [{ path: source.path, line: index + 1, operation: hit?.[1] || 'SQL', text: line.trim() }] : [];
  }));
  return {
    name: model.name, table: model.tableName, line: model.sourceLine,
    fields: model.fields.filter((f) => f.kind !== 'relation').map((f) => ({ name: f.name, column: f.columnName, type: f.type, optional: f.optional, list: f.list, line: f.sourceLine })),
    pk: model.primaryKeys.map((k) => k.fields), unique: model.uniqueConstraints.map((k) => k.fields),
    indexes: model.indexes.map((i) => i.raw),
    fks: model.fields.filter((f) => f.relation?.fields.length).map((f) => ({ field: f.name, ...f.relation, optional: f.optional })),
    relationReaders: inventory.models.flatMap((parent) => parent.fields.filter((f) => f.kind === 'relation' && f.type === model.name).map((f) => ({ model: parent.name, field: f.name, list: f.list, optional: f.optional }))),
    references,
  };
});
const enums = inventory.enums.map((e) => ({ name: e.name, line: e.sourceLine, values: e.values.map((v) => v.name),
  fields: models.flatMap((m) => m.fields.filter((f) => f.type === e.name).map((f) => `${m.name}.${f.name}`)),
  sourceReferences: sources.flatMap((s) => s.lines.flatMap((line, i) => new RegExp(`\\b${escape(e.name)}\\b`).test(line) ? [`${s.path}:${i + 1}`] : [])),
}));
if (process.argv.includes('--models')) {
  const start = Number(process.argv[process.argv.indexOf('--models') + 1] || 0);
  for (const m of models.slice(start, start + 45)) {
    console.log(`${m.name} [${m.table}:${m.line}] ${m.fields.map((f) => `${f.name}:${f.type}${f.optional ? '?' : ''}`).join(' ')}\n  Usage ${m.references.length}: ${[...new Set(m.references.map((r) => r.path))].join(', ') || '(none direct)'}\n  FK ${m.fks.map((r) => `${r.fields.join('+')}→${r.targetModel}${r.optional ? '?' : ''}`).join(', ')}`);
  }
} else if (process.argv.includes('--enums')) {
  console.log(JSON.stringify(enums, null, 2));
} else if (process.argv.includes('--database')) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout = '30s'");
    const tables = (await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`)).rows;
    for (const t of tables) {
      if (!/^[A-Za-z0-9_]+$/.test(t.tablename)) throw new Error('Unexpected table identifier');
      t.count = (await client.query(`SELECT count(*) AS count FROM "${t.tablename}"`)).rows[0].count;
      t.model = models.find((m) => m.table === t.tablename)?.name || null;
    }
    const constraints = (await client.query(`SELECT t.relname AS table_name,c.conname AS name,c.contype AS type,
      c.convalidated AS validated,c.confdeltype AS delete_action,p.relname AS parent,
      pg_get_constraintdef(c.oid,true) AS definition
      FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
      JOIN pg_namespace n ON n.oid=t.relnamespace LEFT JOIN pg_class p ON p.oid=c.confrelid
      WHERE n.nspname='public' ORDER BY t.relname,c.conname`)).rows;
    const indexes = (await client.query(`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname`)).rows;
    const enumColumns = (await client.query(`SELECT t.typname AS type,c.relname AS table_name,a.attname AS column_name
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_type t ON t.oid=a.atttypid WHERE n.nspname='public' AND t.typtype='e' AND a.attnum>0 AND NOT a.attisdropped
      ORDER BY t.typname,c.relname,a.attname`)).rows;
    const dbEnums = (await client.query(`SELECT t.typname AS name,array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
      FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid
      WHERE n.nspname='public' GROUP BY t.typname ORDER BY t.typname`)).rows;
    const triggers = (await client.query(`SELECT c.relname AS table_name,t.tgname AS name,pg_get_triggerdef(t.oid) AS definition,p.proname AS function_name
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_proc p ON p.oid=t.tgfoid WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`)).rows;
    await client.query('ROLLBACK');
    emit({ at: new Date().toISOString(), tables, constraints, indexes, enumColumns, dbEnums, triggers });
  } finally { await client.end(); }
} else {
  emit({ counts: inventory.counts, sourceSha256: inventory.sourceSha256, scannedProductionFiles: sources.length, models, enums });
}
