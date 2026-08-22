-- Platform governance accounts must never become tenant operators through
-- legacy direct permission grants. Preserve the rows for auditability and
-- revoke active grants in-place.
UPDATE "user_permissions" AS up
SET "revoked_at" = COALESCE(up."revoked_at", CURRENT_TIMESTAMP)
FROM "permissions" AS p
WHERE p."id" = up."permission_id"
  AND up."revoked_at" IS NULL
  AND p."code" IN (
    'booking:create:platform',
    'booking:update:platform',
    'branch:create:platform',
    'service:create:platform',
    'service:update:platform',
    'staff_schedule:manage:platform',
    'change_request:approve:platform'
  );
