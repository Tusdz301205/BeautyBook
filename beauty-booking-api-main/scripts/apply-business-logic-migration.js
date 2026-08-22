// Run this script to apply the manual migration safely.
// Usage from project root:  node scripts/apply-business-logic-migration.js
// It will NOT drop any existing data, only create new tables/enums and add columns.
require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is missing in .env');
    process.exit(1);
  }
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'prisma', 'migrations', '20260710_add_business_logic', 'migration.sql'),
    'utf8',
  );

  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    console.log('Connected. Applying migration...');
    await client.query(sql);
    console.log('Migration applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
