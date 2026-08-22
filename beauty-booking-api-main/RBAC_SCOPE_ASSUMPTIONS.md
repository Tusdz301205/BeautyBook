# RBAC + Scope — Assumptions Follow-up

The plan file at
`.cursor/plans/beauty_booking_rbac_scope_plan_a7b2218b.plan.md`
is truncated at line 203, mid-section 3.1 (BOOKINGS permission matrix).
The implementation extends the same RBAC + Scope pattern to the other
modules using the 3-layer actor model (§1) and the data model (§2) as
the contract. The following explicit assumptions were made and should be
validated before merging the change.

---

## 1. Permission matrix extrapolation

The plan only enumerates the BOOKINGS matrix. For the other modules I
derived permissions from the existing controller code plus the 3-layer
actor model. Specifically:

### Branches
- `branch:read:public` — public catalog view (matches the `@Public()`
  on `GET /api/branches`).
- `branch:read:tenant` / `branch:update:tenant` — owner-level writes
  inside their tenant.
- `branch:status:platform` — PLATFORM_ADMIN/COMPLIANCE onboarding &
  suspension.

### Services (catalog)
- `service:read:public` — guest browsing.
- `service:create:branch` / `service:update:branch` / `service:delete:branch`
  — branch-manager catalog CRUD.
- `service:update:tenant` — owner override.

### Users
- `user:read:self` / `user:update:self` — self-service profile.
- `user:read:tenant` — owner reads staff + customers.
- `user:read:platform` — admin search.
- `user:role_assign:tenant` / `user:role_assign:platform` — role
  granting at the two scope levels.
- `user:suspend:platform` — admin suspension.

### Reviews
- `review:create:self` — booking customer can review.
- `review:read:public` — public review feed.
- `review:moderate:tenant` / `review:moderate:platform` — moderation
  queues at the two scope levels.

### Payments
- `payment:create:branch` — receptionist cash collection.
- `payment:read:self` / `payment:read:branch` / `payment:read:tenant` /
  `payment:read:platform` — graduated read scope.
- `payment:refund:tenant` — owner refund (within policy).
- `payment:refund:platform` — support refund (outside policy, audited).

### Admin / Reports
- `admin:trust_snapshot:read` — already in the controller.
- `report:overview:platform` / `report:revenue:tenant` /
  `report:revenue:platform` / `report:user_growth:platform`.
- `audit:read:platform` / `audit:read:tenant`.

### PDPA VN
- `health_record:read:branch` / `health_record:read:tenant` /
  `health_record:read:self` / `health_record:read:sensitive` —
  graduated read; only the last unlocks the raw payload.
- `health_record:create:branch` — staff/manager writes.
- `health_record:consent:manage:self` — customer self-service consent.

---

## 2. Role coverage assumption

The plan's §1.2 lists 10 actors. I assumed the following role-code
mapping (kept stable for back-compat with existing `roles.code`):

| Plan actor                | Role code          | Level   |
|---------------------------|--------------------|---------|
| Platform Admin            | `PLATFORM_ADMIN`   | PLATFORM|
| Onboarding / Compliance   | `COMPLIANCE`       | PLATFORM|
| Support / CS              | `SUPPORT`          | PLATFORM|
| Marketing / Growth        | `MARKETING`        | PLATFORM|
| Finance / Payout          | `FINANCE`          | PLATFORM|
| Chủ Salon (Owner)         | `BUSINESS_OWNER`   | TENANT  |
| Quản lý chi nhánh         | `BRANCH_MANAGER`   | BRANCH  |
| Lễ tân                    | `RECEPTIONIST`     | BRANCH  |
| Nhân viên / Thợ           | `STAFF`            | BRANCH  |
| Khách hàng                | `CUSTOMER`         | CUSTOMER|
| Guest                     | `GUEST`            | CUSTOMER|

The legacy `ADMIN` code (already in the seed) is treated as an alias of
`PLATFORM_ADMIN` everywhere. The legacy role `STAFF` (without tenant
scope) is allowed at the platform level for back-compat with the
existing `auth.service.ts`.

---

## 3. Scope-of-data assumptions

- **Tenant = Business**: the existing `Business` model IS the tenant.
  No separate `Tenant` table was created; the plan's `TENANTS` row in
  §2.1 maps to `Business`.
- **`branch.businessId`** is used as the canonical tenant identifier
  inside the JWT `scopes[].businessId`.
- **No `Booking.tenantId` column** was added — the plan specifies it
  but adding it would require a backfill migration. We derive
  `tenantId` from `branchId` at read time. If direct indexing on tenant
  becomes a hot path, add `tenantId String @map("tenant_id")` to
  `Booking` in a follow-up migration.
- **Cross-tenant joins**: `booking.services[].branchId` must always
  resolve to the same `businessId` as `booking.branchId`; this is an
  application invariant, not enforced in DB. RLS at the DB level is
  out of scope for this PR.

---

## 4. PDPA VN specifics

- The plan calls out a `consent_id` foreign key and separate ACL for
  health records. The existing schema already had `SensitiveConsent`
  and `BookingHealthRecord` — they were extended with a `revokedAt`
  field (already in the schema) and a `lastAccessedAt` /
  `lastAccessedBy` audit trail.
- The plan's table mentions `accessed_by[]` (array of user ids). The
  implementation uses `lastAccessedBy` (single user id) plus the
  generic `audit_logs` table for a full access trail. If you need
  per-record read history, add a `BookingHealthRecordAccess` table in
  a follow-up migration.

---

## 5. Things the truncated plan doesn't specify (and the chosen default)

1. **Permission granularity**: I split each module into `read`,
   `create`, `update`, `delete`, `cancel`, `assign`, `complete`,
   `check_in`, `reschedule`, `refund`, `suspend`, `moderate`,
   `role_assign`, `consent:manage`. Add more fine-grained actions as
   needed (e.g. `service:read:price`).
2. **Scope expansion**: For tenant-level roles on a branch-scoped
   resource, the policy permits the action when the user's
   `businessId` matches the branch's `businessId` even if their
   `branchId` is unset (i.e. tenant-wide grant). The reverse
   (branch-scoped role on a tenant resource) does NOT auto-promote.
3. **Audit retention**: not specified; existing `audit_logs` table is
   append-only and not pruned by application code. Add a cron job to
   archive rows older than N days if required.
4. **Soft delete vs hard delete**: existing schema uses `deletedAt`
   everywhere. Force-cancel writes a `FORCE_CANCEL` audit row but does
   NOT set `deletedAt` (preserves accounting history).
5. **Public-facing endpoints**: any `@Public()` route is reachable
   without authentication. The plan implies public read access to
   branches / services / reviews — confirmed.

---

## 6. Open questions for the plan author

1. Should `STAFF` (no scope) be allowed to perform booking reads at the
   platform level, or restricted to branch-scoped queries only? The
   current implementation denies cross-branch reads.
2. Should the customer be able to read reviews for any salon (current
   implementation: yes, via `review:read:public`) or only for salons
   they have a booking with?
3. Should `PLATFORM_ADMIN` be allowed to read `health_record` raw
   payloads without holding the explicit `health_record:read:sensitive`
   permission? Current implementation: NO — even admins must hold the
   sensitive permission. This matches the strict PDPA VN interpretation
   but may need adjustment if there's an explicit "admin override" use
   case.

---

## 7. Validation steps before merge

1. Run `npx prisma migrate dev --name rbac_scope` (or `prisma db push`
   for prototyping) to apply the schema changes.
2. Run `npx tsx prisma/seed-permissions.ts` to upsert permissions and
   role mappings.
3. `npx tsc --noEmit` to confirm type soundness.
4. `npm test` to run unit tests.
5. Manually exercise:
   - Customer login → only sees own bookings.
   - Branch-staff login → only sees branch bookings.
   - Owner login → sees all branches in tenant.
   - PLATFORM_ADMIN login → sees everything.
   - Cross-tenant: Owner of A tries to GET booking of B → 403.
   - Health record: STAFF sees masked payload; PLATFORM_ADMIN with
     `health_record:read:sensitive` sees raw.

---

## 8. Files added / changed (summary)

### Added
- `src/common/permissions/permission-catalog.ts`
- `src/common/decorators/scope.decorator.ts`
- `src/common/guards/scope.guard.ts`
- `src/common/guards/policy.guard.ts` (rewritten to match the new
  decorator shape; old version was a draft)
- `src/common/utils/ownership.ts`
- `src/health-records/health-records.service.ts`
- `src/health-records/health-records.controller.ts`
- `src/health-records/health-records.module.ts`
- `prisma/seed-permissions.ts`
- `RBAC_SCOPE.md`, `RBAC_SCOPE_ASSUMPTIONS.md`
- `*.spec.ts` for policy / guards / bookings-access / health-records

### Changed
- `prisma/schema.prisma` — added `RoleLevel`, `TenantStatus`,
  `SubscriptionTier`, `PermissionScope`, `UserStatus`, etc.; added
  `Permission`, `RolePermission`, extended `UserRole` with
  `businessId/branchId/expiresAt`; added `SensitiveConsent`,
  `BookingHealthRecord`.
- `src/auth/jwt.strategy.ts` — returns `scopes[]` alongside `roles[]`.
- `src/auth/auth.service.ts` — issues tokens with `scopes[]`.
- `src/common/decorators/current-user.decorator.ts` — `AuthUser` now
  has `scopes[]`.
- `src/common/guards/roles.guard.ts` — composite guard handling
  `@Roles()`, `@RequireScope()` (both shapes), and `@Public()`.
- `src/common/utils/policy.ts` — added `can`, `cannot`,
  `canOnResource`, `ensureCanOnResource`, `roleGrantsPermission`,
  `expandRolePermissions`.
- `src/common/utils/multi-tenancy.ts` — added `tenantScope`,
  `tenantBranchScope`, `assertSameTenant`, `assertBranchAccess`,
  `resolveBranchIdsForUser`, `pickScope`, `hasRoleAtTenant`,
  `hasRoleAtBranch`.
- `src/common/utils/audit.ts` — keeps the `auditLog()` helper;
  `AuditInterceptor` lives separately in
  `src/common/interceptors/audit.interceptor.ts` (not modified here).
- `src/common/utils/scope-helpers.ts` — added `PLATFORM_ROLE_CODES`,
  `isPlatformRole`, `isSelf` (used by `BookingsAccessService`).
- `src/app.module.ts` — registers `ScopeGuard`, `PolicyGuard`,
  `AuditInterceptor` globally; imports `HealthRecordsModule`.
- `src/common/decorators/permission.decorator.ts` — already
  variadic-shape compatible; no changes needed.
- Frontend `src/store/authStore.js` — adds `can()`, `hasRoleAt()`,
  `accessibleTenantIds()` client-side mirrors of the policy matrix.
- Frontend `src/App.jsx` — `<ProtectedRoute>` now supports a `can`
  prop for fine-grained route guards.