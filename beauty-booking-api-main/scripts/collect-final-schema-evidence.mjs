// Incremental evidence refresh; never changes source, schema or database rows.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { Prisma } from '@prisma/client';
import pg from 'pg';
const require = createRequire(import.meta.url);
const { scanControllers } = require('./controller-metadata.cjs');
const { PERMISSIONS, ROLE_PERMISSIONS } = require('../dist/src/common/permissions/permission-catalog');
const old = JSON.parse(readFileSync('../docs/schema-audit-decisions.json'));
const url = new URL(process.env.DATABASE_URL); assert.equal(url.pathname, '/glowbook_db');
const modelSummary = Prisma.dmmf.datamodel.models.map(m => ({
  name: m.name, table: m.dbName ?? m.name, pk: m.primaryKey?.fields ?? m.fields.filter(f => f.isId).map(f => f.name),
  previousDecision: old.models[m.name]?.action,
  fields: m.fields.filter(f => f.kind !== 'object').map(f => ({ name: f.name, column: f.dbName ?? f.name, type: f.type, required: f.isRequired })),
  references: m.fields.filter(f => f.kind === 'object' && f.relationFromFields?.length).map(f => ({ field: f.name, target: f.type, from: f.relationFromFields, to: f.relationToFields, onDelete: f.relationOnDelete })),
}));
const db = new pg.Client({ connectionString: url.toString() }); await db.connect();
try {
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const roleRows = (await db.query('SELECT r.code,count(ur.id)::int assignments FROM roles r LEFT JOIN user_roles ur ON ur.role_id=r.id GROUP BY r.code ORDER BY r.code')).rows;
  const permissions = (await db.query('SELECT p.code,count(up.id)::int direct_grants FROM permissions p LEFT JOIN user_permissions up ON up.permission_id=p.id GROUP BY p.code ORDER BY p.code')).rows;
  const codeSet = new Set(PERMISSIONS.map(p => p.code));
  const unmanaged = (await db.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','archive_health_20260919') ORDER BY schemaname,tablename")).rows.filter(t => !modelSummary.some(m => t.schemaname === 'public' && m.table === t.tablename) && t.tablename !== '_prisma_migrations');
  for (const t of unmanaged) {
    assert.match(t.schemaname + t.tablename, /^[a-z0-9_]+$/);
    t.count = (await db.query(`SELECT count(*)::int count FROM "${t.schemaname}"."${t.tablename}"`)).rows[0].count;
  }
  const constraints = (await db.query("SELECT n.nspname schema,c.relname table_name,k.conname,k.contype,pg_get_constraintdef(k.oid) definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','archive_health_20260919') ORDER BY n.nspname,c.relname,k.conname")).rows;
  const result = { checkedAt: new Date().toISOString(), database: 'glowbook_db', readOnly: true,
    schemaSha256: createHash('sha256').update(readFileSync('prisma/schema.prisma')).digest('hex'),
    activeModels: modelSummary.length, activeEnums: [...readFileSync('prisma/schema.prisma', 'utf8').matchAll(/^enum\s+\w+\s*\{/gm)].length,
    runtimeCatalogRoles: Object.keys(ROLE_PERMISSIONS), databaseRoles: roleRows,
    runtimePermissionCount: PERMISSIONS.length, databasePermissionCount: permissions.length,
    legacyPermissions: permissions.filter(p => !codeSet.has(p.code)), unmanaged, constraints,
    modelSummary, routes: scanControllers(process.cwd()).routes,
  };
  writeFileSync('../tmp/main-deployment-20260920193641/final-schema-evidence.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ activeModels: result.activeModels, activeEnums: result.activeEnums, roles: roleRows, legacyPermissions: result.legacyPermissions, unmanagedTables: unmanaged.length, routes: result.routes.length }));
} finally { await db.end(); }
