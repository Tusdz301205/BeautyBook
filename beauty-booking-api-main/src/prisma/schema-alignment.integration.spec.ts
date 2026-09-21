import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === '1';
if (enabled && (!/^\/beautybook_test_restriction_\d+$/.test(new URL(process.env.DATABASE_URL ?? '').pathname) || process.env.NODE_ENV === 'production')) {
  throw new Error('Schema alignment tests only permit a dedicated restriction test copy');
}
(enabled ? describe : describe.skip)('Prisma declarations preserve existing PostgreSQL behavior', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  afterAll(async () => { await prisma.$disconnect(); await pool.end(); });
  const rollback = new Error('intentional fixture rollback');
  async function rolledBack(work: (tx: any) => Promise<void>) {
    await expect(prisma.$transaction(async tx => { await work(tx); throw rollback; })).rejects.toBe(rollback);
  }
  test('PlatformSetting native UUID create/read/update, nullable and valid UUID actor', async () => {
    await rolledBack(async tx => {
      const key = 'alignment-' + randomUUID();
      const row = await tx.platformSetting.create({ data: { key, value: { version: 1 } } });
      expect(row.id).toMatch(/^[0-9a-f-]{36}$/i); expect(row.updatedBy).toBeNull();
      const actor = randomUUID();
      const changed = await tx.platformSetting.update({ where: { id: row.id }, data: { updatedBy: actor, value: { version: 2 } } });
      expect(changed.updatedBy).toBe(actor);
      expect((await tx.platformSetting.findUnique({ where: { key } })).value).toEqual({ version: 2 });
      expect(changed.updatedAt.getTime()).toBeGreaterThanOrEqual(row.updatedAt.getTime());
    });
  });
  test('PlatformSettingsService upsert and reset retain UUID actor and audit', async () => {
    await rolledBack(async tx => {
      const actor = await tx.user.findFirstOrThrow();
      const service = new PlatformSettingsService(tx);
      await service.update({}, actor.id);
      expect((await tx.platformSetting.findUniqueOrThrow({ where: { key: 'platform' } })).updatedBy).toBe(actor.id);
      await service.reset(actor.id);
      expect((await service.getView()).configured).toEqual({});
    });
  });
  test('invalid UUID actor is rejected, not converted to text', async () => {
    await expect(prisma.$transaction(async tx => {
      await tx.platformSetting.create({ data: { key: randomUUID(), value: {}, updatedBy: 'invalid-uuid' } });
    })).rejects.toThrow();
  });
  test.each(['business_documents','canonical_services','media_files','platform_settings','staff_invitations'])('%s keeps CURRENT_TIMESTAMP database default', async table => {
    const r = await pool.query('SELECT column_default FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name=$3', ['public',table,'updated_at']);
    expect(r.rows).toEqual([{ column_default: 'CURRENT_TIMESTAMP' }]);
  });
  test('raw PlatformSetting insertion exercises database UUID and timestamp defaults', async () => {
    const db = await pool.connect();
    try { await db.query('BEGIN');
      const r = await db.query('INSERT INTO platform_settings(key,value) VALUES ($1,$2) RETURNING id,updated_at,pg_typeof(id)::text type',[randomUUID(),'{}']);
      expect(r.rows[0].type).toBe('uuid'); expect(r.rows[0].updated_at).toBeInstanceOf(Date);
    } finally { await db.query('ROLLBACK'); db.release(); }
  });
  test.each([['service_ids',"'[]'::jsonb"],['preferred_time',"'09:00'::text"]])('recurring %s keeps its database default', async (column, value) => {
    const r = await pool.query('SELECT column_default FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name=$3',['public','recurring_booking_plans',column]);
    expect(r.rows).toEqual([{column_default:value}]);
  });
  test('district referenced by branch cannot be deleted', async () => {
    const db = await pool.connect();
    try { await db.query('BEGIN');
      const r = await db.query('SELECT district_id FROM branches WHERE district_id IS NOT NULL LIMIT 1'); expect(r.rowCount).toBe(1);
      await expect(db.query('DELETE FROM districts WHERE id=$1',[r.rows[0].district_id])).rejects.toMatchObject({code:'23001',constraint:'branches_district_id_fkey'});
    } finally { await db.query('ROLLBACK'); db.release(); }
  });
  test('merged canonical cannot lose its replacement through deletion', async () => {
    const db = await pool.connect();
    try { await db.query('BEGIN'); const target=randomUUID(), alias=randomUUID();
      await db.query('INSERT INTO canonical_services(id,code,slug,name) VALUES ($1,$1,$1,$1)',[target]);
      await db.query("INSERT INTO canonical_services(id,code,slug,name,status,replacement_canonical_id) VALUES ($1,$1,$1,$1,'MERGED',$2)",[alias,target]);
      await expect(db.query('DELETE FROM canonical_services WHERE id=$1',[target])).rejects.toMatchObject({code:'23001',constraint:'canonical_services_replacement_canonical_id_fkey'});
    } finally { await db.query('ROLLBACK'); db.release(); }
  });
  test.each(['special_working_days_branch_id_date_idx','special_working_days_branch_id_date_key','user_sessions_user_id_workspace_business_id_branch_id_revoked_i','booking_violation_events_customer_id_business_id_occurred_at_id'])('index %s remains present', async name => {
    expect((await pool.query('SELECT indexname FROM pg_indexes WHERE schemaname=$1 AND indexname=$2',['public',name])).rows).toEqual([{indexname:name}]);
  });
});
