import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  console.log('=== STEP 1: Create salon_members table ===');
  await pool.query(`
    DO $$ BEGIN
      CREATE TYPE "SalonMemberRole" AS ENUM ('OWNER', 'RECEPTIONIST');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "salon_members" (
      "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "user_id"     TEXT NOT NULL,
      "business_id" TEXT NOT NULL,
      "branch_id"   TEXT,
      "role"        "SalonMemberRole" NOT NULL,
      "is_active"   BOOLEAN NOT NULL DEFAULT true,
      "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "deleted_at"  TIMESTAMP(3),
      CONSTRAINT "salon_members_user_id_business_id_key" UNIQUE ("user_id", "business_id")
    );
  `);

  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE "salon_members" ADD CONSTRAINT "salon_members_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);

  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE "salon_members" ADD CONSTRAINT "salon_members_business_id_fkey"
        FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS "salon_members_business_id_idx" ON "salon_members"("business_id");
    CREATE INDEX IF NOT EXISTS "salon_members_branch_id_idx" ON "salon_members"("branch_id");
    CREATE INDEX IF NOT EXISTS "salon_members_user_id_idx" ON "salon_members"("user_id");
  `);

  console.log('Table created.');

  console.log('\n=== STEP 2: Seed SalonMember rows ===');
  const owners: any = await pool.query(`
    SELECT bop.user_id, b.id AS business_id, u.email, b.name
    FROM business_owner_profiles bop
    JOIN businesses b ON b.owner_id = bop.id
    JOIN users u ON u.id = bop.user_id
  `);
  for (const o of owners.rows) {
    const r: any = await pool.query(`
      INSERT INTO salon_members (user_id, business_id, role, is_active, updated_at)
      VALUES ($1, $2, 'OWNER', true, NOW())
      ON CONFLICT (user_id, business_id) DO UPDATE SET is_active = true, deleted_at = NULL
      RETURNING id, role
    `, [o.user_id, o.business_id]);
    console.log(`  ✓ ${o.email} → ${o.name} (${r.rows[0].role})`);
  }

  console.log('\n=== STEP 3: Verify bookings per owner ===');
  for (const o of owners.rows) {
    const r: any = await pool.query(`
      SELECT COUNT(*) FROM bookings bk
      JOIN branches br ON br.id = bk.branch_id
      WHERE br.business_id = $1 AND bk.deleted_at IS NULL
    `, [o.business_id]);
    console.log(`  ${o.email} (${o.name}) → ${r.rows[0].count} bookings`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await pool.end(); });
