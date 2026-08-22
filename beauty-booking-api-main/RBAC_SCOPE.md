# Beauty Booking Marketplace — RBAC + Scope

This document describes the role-based-access-control + scope system that
guards every endpoint in the Beauty Booking Marketplace API.

> Source of truth: `src/common/permissions/permission-catalog.ts`
> Implementation contract: the `Plan` file under `.cursor/plans/` (truncated
> mid-§3.1; this document captures the extended matrix).

---

## 1. Architecture (3 layers × 5 levels)

The system models the marketplace as three actor layers, each with a
level and a scope (the multi-tenant isolation axis).

```mermaid
flowchart TB
    subgraph Platform[Platform layer]
        PA[PLATFORM_ADMIN]
        CO[COMPLIANCE]
        SU[SUPPORT]
        MK[MARKETING]
        FI[FINANCE]
    end
    subgraph Tenant[Tenant (business) layer]
        OW[BUSINESS_OWNER]
        BM[BRANCH_MANAGER]
        RC[RECEPTIONIST]
        ST[STAFF]
    end
    subgraph Customer[Customer layer]
        GU[GUEST]
        CU[CUSTOMER]
    end
```

| Level   | Scope axis        | Where the resource lives             |
|---------|-------------------|--------------------------------------|
| PLATFORM | cross-tenant     | all tenants                          |
| TENANT   | single business   | all branches inside that business    |
| BRANCH   | single branch     | one branch only                      |
| SELF     | the data subject  | the caller's own rows                |
| OWN      | the data owner    | the row's `userId` (e.g. customer)   |
| PUBLIC   | everyone          | marketing / catalog pages            |

Permission codes use the canonical format
`resource:action:scope`. The trailing `:scope` is matched against the
catalog's `defaultScope` so the policy engine can route to the right
ownership check.

---

## 2. Permission catalog

| Module        | Sample codes                                                              |
|---------------|---------------------------------------------------------------------------|
| BOOKINGS      | `booking:create:branch`, `booking:cancel:platform`, `booking:check_in:branch` |
| BRANCHES      | `branch:read:public`, `branch:update:tenant`, `branch:status:platform`    |
| SERVICES      | `service:read:public`, `service:create:branch`, `service:update:tenant`   |
| USERS         | `user:read:self`, `user:read:tenant`, `user:role_assign:platform`         |
| REVIEWS       | `review:create:self`, `review:moderate:tenant`, `review:moderate:platform`|
| PAYMENTS      | `payment:create:branch`, `payment:read:tenant`, `payment:refund:platform` |
| ADMIN         | `admin:trust_snapshot:read`, `audit:read:platform`                        |
| REPORTS       | `report:revenue:tenant`, `report:revenue:platform`, `report:user_growth:platform` |
| CHANGE REQS   | `change_request:create:self`, `change_request:approve:branch`             |
| HEALTH REC.   | `health_record:read:branch`, `health_record:read:sensitive`, `health_record:consent:manage:self` |

The full list lives in `permission-catalog.ts#PERMISSIONS`. The
`ROLE_PERMISSIONS` map at the bottom of that file maps each role to its
permission grants. New roles or permissions MUST be added in **both**
places.

---

## 3. Two-layer enforcement

Every protected endpoint runs through **two layers**:

1. **Gateway guard** (`RolesGuard` + `ScopeGuard` + `PolicyGuard`,
   registered as `APP_GUARD`). Cheap, declarative; rejects obviously
   unauthorized requests before hitting the database.
2. **Service-layer ownership check** (e.g. `BookingsAccessService.assertWrite`,
   `assertCanAccessBooking`, `HealthRecordsService.assertReadAccess`).
   Always re-verifies the row-level relationship against the database.

```ts
@Post(':id/cancel')
@Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
@RequirePermission('booking:cancel:branch', 'booking:cancel:tenant')
@Audited({ action: AuditAction.CANCEL, entityType: 'Booking' })
async cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
  // gateway guard checked role + scope; here we re-check ownership
  const info = await this.bookingsAccess.assertWrite(user, id);
  return this.bookingsService.cancel(info.bookingId, user.id);
}
```

This pattern matches plan §1.1 (3-layer actor model) and §3.1 (BOOKINGS
matrix). The same shape extends to branches, services, users, reviews,
payments, admin, and reports.

---

## 4. JWT payload

The JWT issued by `AuthService` now carries a `scopes[]` array on top of
the legacy `roles[]` array:

```ts
interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  scopes: { code: string; businessId?: string|null; branchId?: string|null; expiresAt?: string|null }[];
  sessionType: 'admin' | 'salon' | 'customer';
}
```

`JwtStrategy.validate()` re-queries `user_roles` on every request and
ignores expired role assignments.

---

## 5. Multi-tenancy

`common/utils/multi-tenancy.ts` exposes:

- `resolveBusinessIdsForUser(prisma, user)` — returns the list of
  business ids the user can touch (or `['__ALL__']` for platform roles).
- `assertBusinessAccess(prisma, user, businessId)` — throws
  `ForbiddenException` if the user is not allowed.
- `assertBranchAccess(prisma, user, branchId)` — resolves branch →
  business → checks access.
- `tenantScope(allowedIds, extra)` / `tenantBranchScope(prisma, user, extra)` —
  produce Prisma `where` fragments for safe filtering.
- `assertSameTenant(entity, allowedIds, resource)` — service-layer check
  after a row is loaded.

The `Business` model IS the tenant (per the plan's §2.1 mermaid). The
`Branch` model is the inner scope, the `Booking.branchId` resolves
upwards to a `businessId`.

---

## 6. Audit

The `AuditInterceptor` (registered globally via `APP_INTERCEPTOR`)
captures any route carrying `@Audited({...})` and writes an
`audit_logs` row on both success and failure. For sensitive write
operations (e.g. force-cancel, refund, role-assign), controllers and
services should call `auditLog(prisma, {...})` directly so the
before/after JSON is captured precisely.

All audit failures are swallowed — never break a business operation
because the audit table is unavailable.

---

## 7. PDPA VN — Health Records

Health records (skin conditions, allergies, medication, …) live in a
separate table with a stricter ACL:

- Read access requires either:
  - **Booking owner**: `health_record:read:self`
  - **Branch staff/manager/receptionist**: `health_record:read:branch`
  - **Tenant owner**: `health_record:read:tenant`
- **Raw payload** is only returned to callers that hold
  `health_record:read:sensitive`. Everyone else gets a masked payload
  (`{ field: '***' }`).
- Writes require an active `SensitiveConsent` from the customer.
- Customers manage their own consent via `POST /api/health-records/consent`.

See `HealthRecordsService` and `health-records.controller.ts`.

---

## 8. How to add a new role

1. Add a row to the `RoleCode` enum in `prisma/schema.prisma` (or extend
   the `roles.code` free-form column if you don't want a schema change).
2. Add a constant in `permission-catalog.ts#ROLE_PERMISSIONS` listing
   the codes the role grants. The codes must already exist in
   `PERMISSIONS`.
3. Add a row in `ROLE_LEVELS` so the seed script knows the level
   (PLATFORM/TENANT/BRANCH/CUSTOMER).
4. Run `npx tsx prisma/seed-permissions.ts` to upsert.

## 9. How to add a new permission

1. Add an entry to `permission-catalog.ts#PERMISSIONS` (resource, action,
   defaultScope, description).
2. Add the code to the appropriate role(s) in `ROLE_PERMISSIONS`.
3. Run `npx tsx prisma/seed-permissions.ts` to upsert.
4. Decorate the route with `@RequirePermission('your:new:code')` and
   (optionally) `@Audited({...})` for sensitive writes.
5. Add a unit test in `policy.spec.ts` exercising both positive and
   negative cases.

---

## 10. Running tests

```bash
cd beauty-booking-api-main
npm test
```

Unit tests cover:

- `src/common/utils/policy.spec.ts` — full role × action × scope matrix
  including cross-tenant blocking, expired scope, and unknown-permission
  fail-closed behaviour.
- `src/common/guards/guards.spec.ts` — `RolesGuard`, `ScopeGuard`,
  `PolicyGuard` positive/negative paths.
- `src/bookings/bookings-access.spec.ts` — cross-tenant blocking at the
  service layer.
- `src/health-records/health-records.service.spec.ts` — masked payload
  + sensitive-permission unlock.

The Jest config (`rootDir: src`, `testRegex: '.*\\.spec\\.ts$'`) means
no extra wiring is required.

---

## 11. Assumptions made because the plan was truncated

The plan file ends mid-section 3.1 (BOOKINGS matrix). The following
assumptions were made to extend the same RBAC + Scope pattern to the
other modules — see `RBAC_SCOPE_ASSUMPTIONS.md` for the full list:

- Permissions not enumerated in §3.1 were inferred from the existing
  controller code (`controllers/*.ts`) and the established 3-layer
  actor model.
- The "Platform" layer adds 5 roles (PLATFORM_ADMIN, COMPLIANCE,
  SUPPORT, MARKETING, FINANCE). The legacy `ADMIN` code is treated as
  an alias of `PLATFORM_ADMIN` for back-compat.
- `BUSINESS_OWNER` is tenant-wide (all branches in their business);
  `BRANCH_MANAGER`, `RECEPTIONIST`, `STAFF` are branch-scoped.
- The `Booking` table already carries `branchId`; `tenantId` is derived
  from `branch.businessId` at read time. No explicit `tenantId` column
  was added to `Booking` to avoid a breaking migration.
- Health records (`booking_health_records`) live in a separate table
  per plan §2.3; consent tracking uses the
  `sensitive_consents` table that already existed in the schema.