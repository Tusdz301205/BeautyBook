# BeautyBook remediation plan

## Status

Work started on 2026-07-26. This is the execution ledger for the production
remediation specification, not a production-readiness declaration.

## Phase 0 baseline

| Gate | Result |
| --- | --- |
| Prisma schema validation | PASS |
| Backend build | PASS |
| Backend unit tests | PASS — 35 suites, 191 tests; 1 suite / 4 tests skipped |
| Backend E2E | PASS — 1 suite, 2 tests |
| Backend lint (read-only) | FAIL — 455 errors, 61 warnings |
| Frontend production build | PASS |
| Frontend tests | NOT AVAILABLE — no test script or test files |
| Frontend lint | BLOCKED — config exists but its packages are absent from `package.json` |
| Database migration status | FAIL — database is reachable but 10 checked-in migrations are unapplied |
| Docker Compose verification | BLOCKED — Docker CLI is not available in the current PATH |

The current database must not receive new migrations until its ten-migration
drift has been reconciled and backed up. New schema changes remain checked in
but unapplied until that precondition is met.

## Execution order

1. P0 tenant isolation, fail-closed identity/RBAC, guest identity, private
   media, session revocation and staff deactivation.
2. Booking state machine, concurrency, pricing, voucher/combo reservation,
   recurring booking, idempotency, payment and refund correctness.
3. Privacy center, purpose-scoped consent, consultation records, access logs,
   export and data-subject requests.
4. Business-owner signup and resumable onboarding.
5. Ordered service-combo domain and atomic scheduling.
6. Attendance and staff lifecycle.
7. Role-specific frontend completion and responsive/accessibility polish.
8. Full quality gates, migration rehearsal and final reports.

## P0 acceptance tests

- Tenant A cannot attach media to an entity from tenant B even if the request
  supplies tenant A identifiers.
- Empty tenant/branch scope always returns zero records and zero statistics.
- Booking category and customer drill-downs are tenant/branch scoped.
- A customer role without a customer profile is rejected.
- Guest phone numbers never look up, update, or attach to a registered user;
  contact data is snapshotted on the booking.
- Branch roles require a branch and the branch/business pair must match.
- Staff deactivation revokes workforce roles, persistent sessions and access
  tokens.
- Logout revokes the current server-side session before clearing the client.
- Legal documents require explicit permission and every read is audited.

## Migration and rollback rule

Every migration is additive first and includes a reconciliation path for
legacy rows. Destructive enum or column cleanup is deferred until all callers
and historic rows are proven migrated. Rollback is application-first: deploy
code compatible with both schemas, stop new writes to the new shape, then
remove additive objects only after confirming retained data is independent.
