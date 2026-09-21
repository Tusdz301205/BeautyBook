/** Read-only evidence for account separation and cancellation policy. No PII. */
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await client.query("SET LOCAL statement_timeout = '30s'");
  const result = { at: new Date().toISOString(), tables: {}, checks: {} };
  for (const table of ['users', 'roles', 'user_roles', 'salon_members', 'customer_profiles',
    'staff_profiles', 'bookings', 'booking_services', 'reviews', 'loyalty_accounts',
    'loyalty_transactions', 'notifications', 'audit_logs', 'appointment_change_requests']) {
    result.tables[table] = (await client.query(`SELECT count(*)::int AS count FROM "${table}"`)).rows[0].count;
  }
  const queries = {
    roleCombinations: `SELECT roles, count(*)::int AS users FROM (
      SELECT ur.user_id, array_agg(DISTINCT r.code::text ORDER BY r.code::text) AS roles
      FROM user_roles ur JOIN roles r ON r.id=ur.role_id
      WHERE ur.expires_at IS NULL OR ur.expires_at>now() GROUP BY ur.user_id
    ) q GROUP BY roles ORDER BY roles`,
    operationalCustomerProfiles: `SELECT r.code::text AS role, count(DISTINCT cp.id)::int AS profiles
      FROM customer_profiles cp JOIN user_roles ur ON ur.user_id=cp.user_id JOIN roles r ON r.id=ur.role_id
      WHERE r.code::text IN ('BUSINESS_OWNER','RECEPTIONIST','STAFF','PLATFORM_ADMIN')
      AND (ur.expires_at IS NULL OR ur.expires_at>now()) GROUP BY r.code`,
    profilesWithoutCustomerRole: `SELECT count(*)::int AS profiles FROM customer_profiles cp
      WHERE NOT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id
      WHERE ur.user_id=cp.user_id AND r.code::text='CUSTOMER' AND (ur.expires_at IS NULL OR ur.expires_at>now()))`,
    bookingStates: 'SELECT status::text, count(*)::int AS count FROM bookings GROUP BY status ORDER BY status',
    cancellationActors: `SELECT cancelled_by_type::text, count(*)::int AS count,
      count(cancelled_at)::int AS has_timestamp, count(cancelled_by)::int AS has_actor
      FROM bookings WHERE status='CANCELLED' GROUP BY cancelled_by_type`,
    noShowHistory: `SELECT count(DISTINCT b.id)::int AS bookings, count(h.id)::int AS status_events,
      count(h.changed_by)::int AS attributed_events FROM bookings b LEFT JOIN booking_status_histories h
      ON h.booking_id=b.id AND h.status='NO_SHOW' WHERE b.status='NO_SHOW'`,
    requests: `SELECT request_type::text, status::text, requested_by_type::text, count(*)::int AS count
      FROM appointment_change_requests GROUP BY request_type,status,requested_by_type`,
    migrations: `SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL
      AND rolled_back_at IS NULL ORDER BY migration_name DESC LIMIT 5`,
  };
  for (const [name, sql] of Object.entries(queries)) result.checks[name] = (await client.query(sql)).rows;
  console.log(JSON.stringify(result, null, 2));
} finally {
  await client.query('ROLLBACK').catch(() => undefined);
  await client.end();
}
