# Main migration safety gate — 19/09/2026

## Current deployment checkpoint — 20/09/2026

**MAIN DEPLOYMENT AND FINAL POST-MAIN REGRESSION VERIFIED.** The sections below this checkpoint describe the earlier 19/09 gate, not current pending status.

- User authorized final technical completion and deployment of the exact five migrations. All five applied successfully to `glowbook_db` on 20/09/2026 using `scripts/deploy-main-health.mjs`.
- Evidence: `tmp/main-deployment-20260920193641/main-deploy.json`. Each sequential gate checked ledger/checksums, expected objects, all original table counts/whole-row fingerprints, and FK orphans. All gates PASS.
- All 166 pre-existing table fingerprints/counts preserved. Twelve retired tables moved to `archive_health_20260919`; both original sensitive consents preserved. New violation/policy tables empty at deployment: no historical penalty/restriction backfill.
- Final FK count: 395; orphan count: 0. No historical migration SQL edited and no additional migration deployed.
- Fresh verified backup: `docs/db-backups/beautybook_test_restriction_20260920194500.dump`, 4,068,867 bytes, SHA-256 `443e05626238f93539e88fa2b491bf98a00980f88f019643d15b37330f99d76b`. Restored into the same-named verification database; every original table fingerprint and migration ledger matched main. Dump/evidence are Git-ignored.
- Fresh rehearsal `beautybook_test_restriction_20260920193641`: five migrations PASS, 102 suites / 935 tests PASS, zero skipped. One additional test versus the 934 baseline verifies actual archive TRUNCATE rejection and preservation of two consents. Test safety naming no longer hard-codes 19 September; it still requires a dedicated test database and `NODE_ENV=test`.
- Copy and main smoke: nine HTTP checks each PASS with nine background workers disabled. Main Prisma validate/generate/status PASS, zero pending migrations; controlled diff exactly matches the reviewed copy diff. Post-main backend and frontend builds PASS.
- Maintenance released at `2026-09-20T12:48:44.625Z` only after those gates, a fresh critical-row/archive integrity check and 395 FK / zero orphan verification. Main accepts ordinary read/write connections again; no normal API process was started by the deployment helper. Authorized smoke login changed session/security/last-login metadata, not booking/business/payment/history data.
- A fresh post-main database copy `beautybook_test_restriction_20260920194900` was created for full regression. `tmp/main-deployment-20260920193641/post-main/restore-proof.json` verifies all table counts/fingerprints including the migration ledger match main before tests. Main is never the target of mutating regression.
- Final post-main copy regression ngày 21/09 đạt **103/103 suites, 943/943 tests, 0 skip**; FE **58/58** và build PASS; browser actor/RBAC/booking/responsive **66/66**; concurrency/negative **12/12**. Final audit: `DATABASE_SCHEMA_AUDIT_FINAL.md`. Không có sơ đồ được tạo trong bước này.

Recovery: keep ordinary write traffic stopped if any post-main gate fails. Preserve this database and all evidence. Do not run the copy-only reverse recipe on main or edit applied ledger entries. Restore the verified dump into a new recovery database, validate ledger/data/consents/FKs, then perform a separately reviewed connection switch; never overwrite/drop the existing main database as an automatic recovery step.

## Subsequent copy-only alignment

The user subsequently approved source/copy-only alignment, explicitly forbidding main deployment in that task. See [PRISMA_DATABASE_ALIGNMENT.md](PRISMA_DATABASE_ALIGNMENT.md): listed active-schema mismatches are resolved by declarations, 934 tests passed, no new migration required, main remains unchanged. Status is **READY FOR MAIN DEPLOYMENT REVIEW**, not MAIN APPLIED. The original gate findings below are retained as historical evidence.

**STOP BEFORE MAIN APPLY: unresolved active Prisma/database schema differences.**

User approved rehearsal and conditionally authorized main deployment. This document supersedes the older wording that approval is still pending: approval exists, but deployment safety gates are not all satisfied. No migration, DML, reset, backup restore, or schema change was performed on main during this gate check. No Git push or diagrams.

## Migration history (read-only verified)

All 47 local migration file checksums match corresponding recorded migrations on the rehearsal database. Main applied history matches the common rehearsal history, including the historical rolled-back attempt followed by successful `20260713_add_health_records`. No unresolved failed migration found. Exactly five migrations remain pending on main.

| Order | Migration | Applied main? | Required before archive? | Data impact | Destructive? | Rehearsed? | Result |
|---|---|---|---|---|---|---|---|
| 1 | 20260916_account_separation | No | Ordered application rollout prerequisite, not a health-table SQL dependency | Check mixed accounts, add role-separation trigger | No row deletion | Yes; checksum matches | Pending; held |
| 2 | 20260917_booking_violation_events | No | Ordered rollout; required by migration 3 | Add event table, enum, indexes, checks and triggers; no historical penalty backfill | No | Yes; checksum matches | Pending; held |
| 3 | 20260918_customer_booking_policy | No | Ordered application rollout prerequisite | Add policy table referencing violation events; no restriction backfill | No | Yes; checksum matches | Pending; held |
| 4 | 20260919_archive_retired_health | No | Archive operation | Move 12 tables, 10 enums and existing append-only function to archive | No historical row/table deletion | Yes; checksum matches | Pending; held |
| 5 | 20260919_health_archive_row_guard | No | Must follow 4 before reopening application | Replace new statement DML guard with row guard; retain TRUNCATE guard | No historical row deletion | Yes; checksum matches | Pending; held |

## Main database read-only result

- Database: `glowbook_db`, native local PostgreSQL.
- 166 public application/history tables (excluding Prisma migration ledger), 386 FK checked, zero orphan.
- Users 1,038; businesses 5; branches 11; staff profiles 29.
- Bookings 4,000; booking services 4,000; payments 4,000; reviews 871.
- All 12 health tables still in public. Two consent rows match the rehearsal fingerprint exactly. Other 11 health tables remain empty.
- Count and whole-row fingerprint captured for all 166 tables. Constraint definitions captured.
- No other main database connections observed at snapshot time. This is NOT a maintenance lock or guarantee against future connections.
- Evidence: `tmp/manager-refactor/main-health-preflight.json`; read-only runner `beauty-booking-api-main/scripts/preflight-main-health.mjs`.

## Blocking schema differences

Read-only `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma` reported expected pending tables/retired archive objects, but also differences outside the five authorized migrations:

| Object | Actual DB | Active Prisma | Significance |
|---|---|---|---|
| platform_settings.id | UUID with database default gen_random_uuid() | String without @db.Uuid, client uuid() default | Native type/default mismatch; do not auto-convert PK |
| platform_settings.updated_by | UUID | String without @db.Uuid | Native type mismatch |
| branches.district_id FK | ON DELETE RESTRICT | Optional relation with implicit default | Referential-action mismatch; requires explicit intended policy |
| canonical_services.replacement_canonical_id FK | ON DELETE RESTRICT | Optional relation with implicit default | Referential-action mismatch; requires explicit intended policy |
| Several updated_at / recurring defaults | Database defaults present | Defaults absent in Prisma | Classify historical intentional defaults vs schema omissions |
| special_working_days index | Extra branch/date index | Not in active schema | Review; no automatic index drop |
| user_sessions index name | Existing truncated name | Different generated name | Naming difference, not evidence of row loss |

The UUID columns and both FK actions were checked directly on BOTH main and rehearsal 1903: they are identical between those databases. These are **pre-existing source/schema mismatches**, not a changed main migration history and not damage from the health cleanup. Passing previous tests does not establish complete schema parity. Archive/history tables absent from Prisma are intentional and must not be dropped from a generated diff.

No schema synchronization SQL was executed. The diff command only described differences.

## Required next decision

Approve a separate, copy-only alignment/classification pass for these pre-existing mismatches. Prefer preserving native UUID types and existing FK behavior by making Prisma declarations explicit where confirmed by business rules, rather than converting or dropping main objects. Do not edit applied migrations. Any required new database migration must be rehearsed and separately reviewed before main deployment resumes.

## Deployment status and recovery

- New full main backup / restore verification: not started; stopped at earlier schema gate.
- Maintenance window: not opened; no app processes stopped.
- Main migrations: none applied in this task; last successful migration remains `20260915_remove_manager_role`.
- Post-main regression/build/readiness: not run; there is no post-main state yet.
- Prior rehearsal results remain historical evidence only: 917 BE/PG, 57 FE, 15 browser tests passed. They are not newly executed results.
- Recovery: unnecessary for main because it was not changed. Existing copy-only reverse recipe remains `beauty-booking-api-main/scripts/recover-health-archive.sql`; do not execute it against main by bypassing its guard.
- Root `git diff --check`: exit 0 (line-ending warnings only).
- Active source: 121 models / 92 enums per approved rehearsal. Final audit is not complete; do not declare schema final or start diagrams.
