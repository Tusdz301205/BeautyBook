import 'dotenv/config';
import { Pool, type PoolClient } from 'pg';

type Finding = { check: string; count: number; severity: 'INFO' | 'WARN' | 'BLOCK'; note: string };

async function columnExists(client: PoolClient, table: string, column: string) {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     ) AS exists`,
    [table, column],
  );
  return result.rows[0]?.exists ?? false;
}

async function tableExists(client: PoolClient, table: string) {
  const result = await client.query<{ exists: boolean }>('SELECT to_regclass($1) IS NOT NULL AS exists', [`public.${table}`]);
  return result.rows[0]?.exists ?? false;
}

async function count(client: PoolClient, sql: string) {
  const result = await client.query<{ count: string }>(sql);
  return Number(result.rows[0]?.count ?? 0);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  const findings: Finding[] = [];
  try {
    await client.query('BEGIN READ ONLY');

    const duplicateRoleScopes = await count(client, `
      SELECT COUNT(*) FROM (
        SELECT user_id, role_id, business_id, branch_id
        FROM user_roles
        GROUP BY user_id, role_id, business_id, branch_id
        HAVING COUNT(*) > 1
      ) duplicates
    `);
    findings.push({ check: 'duplicate_role_scopes', count: duplicateRoleScopes, severity: duplicateRoleScopes ? 'BLOCK' : 'INFO', note: 'Phải xử lý trước khi partial unique indexes được áp dụng.' });

    const duplicateStaffUsers = await count(client, `
      SELECT COUNT(*) FROM (
        SELECT user_id FROM staff_profiles
        WHERE user_id IS NOT NULL AND deleted_at IS NULL
        GROUP BY user_id HAVING COUNT(*) > 1
      ) duplicates
    `);
    findings.push({ check: 'duplicate_staff_profile_user_links', count: duplicateStaffUsers, severity: duplicateStaffUsers ? 'BLOCK' : 'INFO', note: 'Không tự merge StaffProfile.' });

    const invitationHasProfile = await columnExists(client, 'staff_invitations', 'staff_profile_id');
    const legacyInvitations = invitationHasProfile
      ? await count(client, `SELECT COUNT(*) FROM staff_invitations WHERE staff_profile_id IS NULL`)
      : await count(client, `SELECT COUNT(*) FROM staff_invitations`);
    findings.push({ check: 'legacy_invitations_without_staff_profile', count: legacyInvitations, severity: legacyInvitations ? 'WARN' : 'INFO', note: invitationHasProfile ? 'Chỉ backfill khi quan hệ profile xác định chắc chắn.' : 'Migration Section A chưa được áp dụng; toàn bộ invitation hiện là legacy.' });

    const assignmentsExist = await tableExists(client, 'staff_branch_assignments');
    const missingAssignments = assignmentsExist ? await count(client, `
      SELECT COUNT(*)
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      JOIN staff_profiles sp ON sp.user_id = ur.user_id AND sp.deleted_at IS NULL
      WHERE ur.branch_id IS NOT NULL
        AND sp.status NOT IN ('INACTIVE', 'LOCKED')
        AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP)
        AND r.code IN ('STAFF', 'RECEPTIONIST')
        AND NOT EXISTS (
          SELECT 1 FROM staff_branch_assignments sba
          WHERE sba.staff_id = sp.id AND sba.branch_id = ur.branch_id
            AND sba.status = 'ACTIVE'
        )
    `) : 0;
    const safeAssignmentMatches = assignmentsExist ? await count(client, `
      SELECT COUNT(DISTINCT sp.id)
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      JOIN staff_profiles sp ON sp.user_id = ur.user_id AND sp.deleted_at IS NULL
      WHERE ur.branch_id IS NOT NULL AND sp.branch_id = ur.branch_id
        AND sp.status NOT IN ('INACTIVE', 'LOCKED')
        AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP)
        AND r.code IN ('STAFF', 'RECEPTIONIST')
        AND NOT EXISTS (
          SELECT 1 FROM staff_branch_assignments sba
          WHERE sba.staff_id = sp.id AND sba.branch_id = ur.branch_id
            AND sba.status = 'ACTIVE'
        )
    `) : 0;
    findings.push({ check: 'branch_roles_without_active_assignment', count: missingAssignments, severity: !assignmentsExist ? 'BLOCK' : missingAssignments > safeAssignmentMatches ? 'BLOCK' : missingAssignments ? 'WARN' : 'INFO', note: assignmentsExist ? `${safeAssignmentMatches} hồ sơ khớp chính xác primary branch và có thể backfill an toàn; ${Math.max(0, missingAssignments - safeAssignmentMatches)} cần review thủ công.` : 'Bảng staff_branch_assignments chưa tồn tại vì migration cũ chưa được áp dụng.' });

    const workspaceExists = await columnExists(client, 'user_sessions', 'workspace');
    const inactiveWithSessions = await count(client, `
      SELECT COUNT(DISTINCT sp.id)
      FROM staff_profiles sp
      JOIN user_sessions session ON session.user_id = sp.user_id
      WHERE sp.status = 'INACTIVE' AND session.revoked_at IS NULL
        AND session.expires_at > CURRENT_TIMESTAMP
        ${workspaceExists ? `AND session.workspace = 'SALON'` : ''}
    `);
    findings.push({ check: 'inactive_staff_with_active_sessions', count: inactiveWithSessions, severity: inactiveWithSessions ? 'WARN' : 'INFO', note: workspaceExists ? 'Có thể revoke đúng SALON workspace.' : 'Chưa có workspace column; không tự revoke vì có thể là Customer session.' });

    const pendingReviews = await count(client, `SELECT COUNT(*) FROM reviews WHERE status = 'PENDING' AND deleted_at IS NULL`);
    findings.push({ check: 'legacy_pending_reviews', count: pendingReviews, severity: pendingReviews ? 'WARN' : 'INFO', note: 'Không tự publish hàng loạt; review policy/flag trước khi chuyển trạng thái.' });

    const migrationRows = await client.query<{ migration_name: string; state: string }>(`
      SELECT migration_name,
        CASE WHEN rolled_back_at IS NOT NULL THEN 'ROLLED_BACK' ELSE 'UNFINISHED' END AS state
      FROM _prisma_migrations
      WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL
      ORDER BY started_at
    `);
    const failedMigrations = migrationRows.rows.filter((row) => row.state === 'UNFINISHED').length;
    findings.push({ check: 'unfinished_migrations', count: failedMigrations, severity: failedMigrations ? 'BLOCK' : 'INFO', note: 'Rolled-back history được liệt kê riêng và không tự xem là blocker.' });

    await client.query('ROLLBACK');
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), mode: 'READ ONLY', findings, migrationHistoryExceptions: migrationRows.rows }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
