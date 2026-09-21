-- Manager-retirement prerequisite audit. This file never changes data/schema.
-- Run only against the intended database with a read-only database account.
-- Supply connection details through the operator's existing secure connection;
-- do not paste credentials into this file or into captured audit output.
-- Requires the current BeautyBook active tables. A missing relation/column is
-- a schema-drift blocker: stop and inspect migrations, never reset or seed.
-- No names, emails, phones, password hashes, tokens, or JSON row snapshots are
-- returned. Opaque business/branch IDs identify scopes needing a mapping rule.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';

-- 1. Exact persisted role definitions, assignment counts (including Guest),
-- and whether grants are presently usable. Empty roles still appear.
SELECT r.code::text AS role_code, r.level::text AS role_level,
       count(ur.id) AS assignment_count,
       count(DISTINCT ur.user_id) AS assigned_users,
       count(ur.id) FILTER (
         WHERE ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP
       ) AS unexpired_assignments,
       count(ur.id) FILTER (
         WHERE (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP)
           AND u.is_active AND u.deleted_at IS NULL
       ) AS usable_assignments,
       (SELECT count(*) FROM public.role_permissions rp WHERE rp.role_id = r.id)
         AS role_permission_count
FROM public.roles r
LEFT JOIN public.user_roles ur ON ur.role_id = r.id
LEFT JOIN public.users u ON u.id = ur.user_id
GROUP BY r.id, r.code, r.level
ORDER BY r.code::text;

-- 2. All Manager assignments grouped by exact nullable scope. A branch/business
-- mismatch or unscoped assignment is not safe to infer/reassign automatically.
SELECT ur.business_id, ur.branch_id,
       count(*) AS assignments, count(DISTINCT ur.user_id) AS users,
       count(*) FILTER (WHERE ur.expires_at IS NULL) AS nonexpiring_assignments,
       count(*) FILTER (WHERE ur.expires_at <= CURRENT_TIMESTAMP) AS expired_assignments,
       count(*) FILTER (WHERE ur.business_id IS NULL) AS missing_business_scope,
       count(*) FILTER (WHERE ur.branch_id IS NULL) AS missing_branch_scope,
       count(*) FILTER (WHERE ur.business_id IS NOT NULL AND b.id IS NULL)
         AS orphan_business_scope,
       count(*) FILTER (WHERE ur.branch_id IS NOT NULL AND br.id IS NULL)
         AS orphan_branch_scope,
       count(*) FILTER (
         WHERE br.id IS NOT NULL AND br.business_id IS DISTINCT FROM ur.business_id
       ) AS branch_business_mismatches
FROM public.user_roles ur
JOIN public.roles r ON r.id = ur.role_id AND r.code::text = 'BRANCH_MANAGER'
LEFT JOIN public.businesses b ON b.id = ur.business_id
LEFT JOIN public.branches br ON br.id = ur.branch_id
GROUP BY ur.business_id, ur.branch_id
ORDER BY ur.business_id NULLS FIRST, ur.branch_id NULLS FIRST;

-- 3. Destination-role collision / existing-role audit. Null scopes compare
-- null-safely; never merge attribution or expiry solely on an ON CONFLICT.
WITH manager_assignments AS (
  SELECT ur.*
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id AND r.code::text = 'BRANCH_MANAGER'
)
SELECT destination.code::text AS existing_role_code,
       count(DISTINCT manager.user_id) AS manager_users_with_this_role,
       count(*) AS assignment_pairs,
       count(*) FILTER (
         WHERE existing.business_id IS NOT DISTINCT FROM manager.business_id
           AND existing.branch_id IS NOT DISTINCT FROM manager.branch_id
       ) AS exact_scope_pairs,
       count(*) FILTER (
         WHERE existing.expires_at IS NULL OR existing.expires_at > CURRENT_TIMESTAMP
       ) AS unexpired_existing_pairs
FROM manager_assignments manager
JOIN public.user_roles existing ON existing.user_id = manager.user_id
JOIN public.roles destination ON destination.id = existing.role_id
WHERE destination.code::text <> 'BRANCH_MANAGER'
GROUP BY destination.code
ORDER BY destination.code::text;

-- 4. Duplicate nullable role scopes relevant to a potential mapping.
SELECT r.code::text AS role_code, ur.business_id, ur.branch_id,
       count(*) AS duplicated_principals, sum(duplicate_scope.rows_in_scope) AS rows_in_duplicates
FROM (
  SELECT user_id, role_id, business_id, branch_id, count(*) AS rows_in_scope
  FROM public.user_roles
  GROUP BY user_id, role_id, business_id, branch_id
  HAVING count(*) > 1
) duplicate_scope
JOIN public.roles r ON r.id = duplicate_scope.role_id
CROSS JOIN LATERAL (
  SELECT duplicate_scope.business_id, duplicate_scope.branch_id
) ur
WHERE r.code::text IN ('BRANCH_MANAGER', 'RECEPTIONIST', 'STAFF')
GROUP BY r.code, ur.business_id, ur.branch_id
ORDER BY r.code::text, ur.business_id NULLS FIRST, ur.branch_id NULLS FIRST;

-- 5. All membership roles and statuses, not only active memberships.
SELECT sm.role::text AS member_role, sm.is_active,
       (sm.deleted_at IS NOT NULL) AS soft_deleted,
       count(*) AS memberships, count(DISTINCT sm.user_id) AS users
FROM public.salon_members sm
GROUP BY sm.role, sm.is_active, (sm.deleted_at IS NOT NULL)
ORDER BY sm.role::text, sm.is_active, soft_deleted;

-- 6. Manager memberships have their own scope and may disagree with RBAC.
SELECT sm.business_id, sm.branch_id, sm.is_active,
       (sm.deleted_at IS NOT NULL) AS soft_deleted, count(*) AS memberships,
       count(*) FILTER (WHERE br.id IS NOT NULL
         AND br.business_id IS DISTINCT FROM sm.business_id) AS branch_business_mismatches,
       count(*) FILTER (WHERE sm.branch_id IS NOT NULL AND br.id IS NULL) AS orphan_branches,
       count(*) FILTER (WHERE NOT EXISTS (
         SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
         WHERE ur.user_id = sm.user_id AND r.code::text = 'BRANCH_MANAGER'
           AND ur.business_id IS NOT DISTINCT FROM sm.business_id
           AND ur.branch_id IS NOT DISTINCT FROM sm.branch_id
           AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP)
       )) AS without_unexpired_exact_scope_manager_grant
FROM public.salon_members sm
LEFT JOIN public.branches br ON br.id = sm.branch_id
WHERE sm.role::text = 'MANAGER'
GROUP BY sm.business_id, sm.branch_id, sm.is_active, (sm.deleted_at IS NOT NULL)
ORDER BY sm.business_id, sm.branch_id NULLS FIRST, sm.is_active, soft_deleted;

-- 7. Every Manager invitation, including accepted, expired and revoked rows.
SELECT si.status::text AS status, si.business_id, si.branch_id,
       count(*) AS invitations,
       count(*) FILTER (WHERE si.expires_at > CURRENT_TIMESTAMP) AS not_yet_expired,
       count(*) FILTER (WHERE si.staff_profile_id IS NOT NULL) AS linked_staff_profiles,
       count(*) FILTER (WHERE b.id IS NULL) AS orphan_business_scope,
       count(*) FILTER (WHERE si.branch_id IS NOT NULL AND br.id IS NULL) AS orphan_branch_scope,
       count(*) FILTER (WHERE br.id IS NOT NULL
         AND br.business_id IS DISTINCT FROM si.business_id) AS branch_business_mismatches
FROM public.staff_invitations si
LEFT JOIN public.businesses b ON b.id = si.business_id
LEFT JOIN public.branches br ON br.id = si.branch_id
WHERE si.role_code::text = 'BRANCH_MANAGER'
GROUP BY si.status, si.business_id, si.branch_id
ORDER BY si.status::text, si.business_id, si.branch_id NULLS FIRST;

-- 8. Preserve professional profiles and booking references while retiring RBAC.
WITH affected_users AS (
  SELECT ur.user_id FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id AND r.code::text = 'BRANCH_MANAGER'
  UNION
  SELECT user_id FROM public.salon_members WHERE role::text = 'MANAGER'
)
SELECT sp.status::text AS staff_status, sp.is_bookable, sp.public_visible,
       (sp.deleted_at IS NOT NULL) AS soft_deleted,
       count(*) AS staff_profiles,
       sum((SELECT count(*) FROM public.staff_branch_assignments sba WHERE sba.staff_id = sp.id))
         AS branch_assignment_rows,
       sum((SELECT count(*) FROM public.booking_services bs WHERE bs.staff_id = sp.id))
         AS all_booking_service_rows,
       sum((SELECT count(*) FROM public.booking_services bs
            JOIN public.bookings b ON b.id = bs.booking_id
            WHERE bs.staff_id = sp.id AND b.deleted_at IS NULL
              AND b.status::text IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
              AND bs.status::text IN ('SCHEDULED', 'IN_PROGRESS')))
         AS active_booking_service_rows
FROM public.staff_profiles sp
JOIN affected_users affected ON affected.user_id = sp.user_id
GROUP BY sp.status, sp.is_bookable, sp.public_visible, (sp.deleted_at IS NOT NULL)
ORDER BY sp.status::text, sp.is_bookable, sp.public_visible, soft_deleted;

-- 9. Count sessions to revoke without printing identifiers or credentials.
WITH affected_users AS (
  SELECT ur.user_id FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id AND r.code::text = 'BRANCH_MANAGER'
  UNION
  SELECT user_id FROM public.salon_members WHERE role::text = 'MANAGER'
)
SELECT session.workspace::text AS workspace,
       count(*) AS sessions,
       count(*) FILTER (WHERE session.revoked_at IS NULL
         AND session.expires_at > CURRENT_TIMESTAMP) AS unrevoked_unexpired_sessions
FROM public.user_sessions session
JOIN affected_users affected ON affected.user_id = session.user_id
GROUP BY session.workspace ORDER BY session.workspace::text;

-- 10. Direct user grants are independent of role removal; inventory, do not
-- automatically revoke unrelated grants or copy the retired role's powers.
WITH affected_users AS (
  SELECT ur.user_id FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id AND r.code::text = 'BRANCH_MANAGER'
  UNION
  SELECT user_id FROM public.salon_members WHERE role::text = 'MANAGER'
)
SELECT permission.code AS permission_code, grant_row.bundle_code,
       count(*) AS direct_grants,
       count(*) FILTER (WHERE grant_row.revoked_at IS NULL
         AND (grant_row.expires_at IS NULL OR grant_row.expires_at > CURRENT_TIMESTAMP))
         AS usable_direct_grants
FROM public.user_permissions grant_row
JOIN affected_users affected ON affected.user_id = grant_row.user_id
JOIN public.permissions permission ON permission.id = grant_row.permission_id
GROUP BY permission.code, grant_row.bundle_code
ORDER BY permission.code, grant_row.bundle_code NULLS FIRST;

-- 11. Real enum labels; archival enum types may legitimately retain Manager.
SELECT namespace.nspname AS type_schema, enum_type.typname AS enum_type,
       enum_value.enumsortorder, enum_value.enumlabel
FROM pg_type enum_type
JOIN pg_namespace namespace ON namespace.oid = enum_type.typnamespace
JOIN pg_enum enum_value ON enum_value.enumtypid = enum_type.oid
WHERE enum_type.typname ILIKE '%RoleCode%'
   OR enum_type.typname ILIKE '%SalonMemberRole%'
ORDER BY namespace.nspname, enum_type.typname, enum_value.enumsortorder;

-- 12. Direct enum and enum-array column dependencies, INCLUDING archives.
-- Do not DROP TYPE CASCADE or erase archived BRANCH_MANAGER/MANAGER values.
SELECT relation_namespace.nspname AS relation_schema, relation.relname AS relation_name,
       attribute.attname AS column_name,
       format_type(attribute.atttypid, attribute.atttypmod) AS column_type,
       attribute.attnotnull AS not_null,
       pg_get_expr(default_value.adbin, default_value.adrelid) AS column_default
FROM pg_attribute attribute
JOIN pg_class relation ON relation.oid = attribute.attrelid
JOIN pg_namespace relation_namespace ON relation_namespace.oid = relation.relnamespace
JOIN pg_type column_type ON column_type.oid = attribute.atttypid
LEFT JOIN pg_type array_element ON array_element.oid = column_type.typelem
LEFT JOIN pg_attrdef default_value ON default_value.adrelid = attribute.attrelid
  AND default_value.adnum = attribute.attnum
WHERE attribute.attnum > 0 AND NOT attribute.attisdropped
  AND (column_type.typname ILIKE '%RoleCode%'
    OR column_type.typname ILIKE '%SalonMemberRole%'
    OR array_element.typname ILIKE '%RoleCode%'
    OR array_element.typname ILIKE '%SalonMemberRole%')
ORDER BY relation_schema, relation_name, column_name;

-- 13. Other direct enum dependencies (including defaults, arrays, functions).
-- Inspect dependencies of listed objects too before choosing enum DDL.
SELECT namespace.nspname AS type_schema, enum_type.typname AS enum_type,
       dependency.deptype AS dependency_type,
       pg_describe_object(dependency.classid, dependency.objid, dependency.objsubid)
         AS dependent_object
FROM pg_type enum_type
JOIN pg_namespace namespace ON namespace.oid = enum_type.typnamespace
JOIN pg_depend dependency ON dependency.refclassid = 'pg_type'::regclass
  AND dependency.refobjid = enum_type.oid
WHERE enum_type.typname ILIKE '%RoleCode%'
   OR enum_type.typname ILIKE '%SalonMemberRole%'
ORDER BY type_schema, enum_type.typname, dependent_object;

-- 14. Relevant constraints and indexes, including FK delete behavior. Archived
-- references survive table renames and can block/cascade active parent writes.
SELECT namespace.nspname AS table_schema, relation.relname AS table_name,
       constraint_row.conname AS constraint_name,
       pg_get_constraintdef(constraint_row.oid, true) AS definition
FROM pg_constraint constraint_row
JOIN pg_class relation ON relation.oid = constraint_row.conrelid
JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
WHERE constraint_row.conrelid IN (
  'public.roles'::regclass, 'public.role_permissions'::regclass,
  'public.user_roles'::regclass, 'public.salon_members'::regclass,
  'public.staff_invitations'::regclass
) OR constraint_row.confrelid = 'public.roles'::regclass
ORDER BY table_schema, table_name, constraint_name;

SELECT schemaname AS table_schema, tablename AS table_name, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('roles', 'role_permissions', 'user_roles', 'salon_members', 'staff_invitations')
ORDER BY tablename, indexname;

-- 15. Archive presence and estimates only; no historical payloads are exposed.
-- Row estimates are NOT exact counts and do not establish emptiness.
SELECT schemaname AS table_schema, relname AS archive_table,
       n_live_tup AS estimated_rows
FROM pg_stat_user_tables
WHERE relname LIKE 'archive_20260829_%'
ORDER BY schemaname, relname;

-- 16. All enum types still used by workforce archives for deferred Phase 2.
SELECT DISTINCT namespace.nspname AS table_schema, relation.relname AS archive_table,
       attribute.attname AS column_name, enum_type.typname AS enum_type
FROM pg_attribute attribute
JOIN pg_class relation ON relation.oid = attribute.attrelid
JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
JOIN pg_type enum_type ON enum_type.oid = attribute.atttypid AND enum_type.typtype = 'e'
WHERE attribute.attnum > 0 AND NOT attribute.attisdropped
  AND relation.relname LIKE 'archive_20260829_%'
ORDER BY table_schema, archive_table, column_name;

-- End explicitly without committing. Read-only remains enforced throughout.
-- Function bodies may contain role literals without a pg_depend enum edge.
SELECT namespace.nspname AS function_schema, routine.proname AS function_name,
       pg_get_function_identity_arguments(routine.oid) AS arguments
FROM pg_proc routine
JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
WHERE namespace.nspname = 'public' AND routine.prokind = 'f'
  AND (routine.prosrc ILIKE '%BRANCH_MANAGER%' OR routine.prosrc ILIKE '%MANAGER%')
ORDER BY function_schema, function_name;

ROLLBACK;
