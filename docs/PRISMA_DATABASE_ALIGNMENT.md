# Copy-only Prisma / database schema alignment

> Deployment update (20/09/2026): the later authorized finalization task has applied all five migrations to main with per-migration integrity gates PASS. See `HEALTH_ARCHIVE_MAIN_GATE.md` for the current deployment/maintenance state. The 19/09 copy-only findings and test evidence below are historical; their statements that main is pending describe that earlier checkpoint only.

> Final verification (21/09/2026): Prisma validate/generate, controlled diff, backend build and **103 suites /943 PostgreSQL-backed tests** passed on a fresh main-equivalent copy. No additional database migration was required. Final source of truth: `DATABASE_SCHEMA_AUDIT_FINAL.md`.

Date: 19/09/2026. **READY FOR MAIN DEPLOYMENT REVIEW** (not deployed). Scope: source declarations and dedicated copy `beautybook_test_restriction_202609192301`. No main deployment authorization is exercised in this task. Approved health rehearsal DB 1903 and its evidence files are not modified.

## Decisions

Database catalog inspected on the new copy. Applied SQL migrations are evidence, not edited files. Source changes are confined to explicit Prisma declarations and verification tooling/tests.

| OBJECT | DATABASE STATE | PRISMA STATE BEFORE | ROOT CAUSE | BUSINESS INTENT / EVIDENCE | DECISION | SOURCE CHANGE | DB MIGRATION REQUIRED | RISK |
|---|---|---|---|---|---|---|---|---|
| platform_settings.id | uuid, gen_random_uuid() | String/client uuid(), no native type | SQL native type/default omitted from model | Stable setting identity; 20260713_add_platform_settings; PlatformSettingsService.upsert | KEEP_DB_ALIGN_PRISMA | @db.Uuid + @default(dbgenerated("gen_random_uuid()")) | No | Low; generated client still returns JS string, invalid UUID now correctly rejected |
| platform_settings.updated_by | nullable uuid, no FK | String?, no native type | SQL native type omitted | Audit actor set from authenticated user ID; update/reset service | KEEP_DB_ALIGN_PRISMA | @db.Uuid, preserve nullable scalar/no new FK | No | Do not invent relation to text users.id; invalid actors rejected |
| branches.district_id | nullable, ON DELETE RESTRICT / UPDATE CASCADE | Optional relation with implicit SetNull delete | Implicit ORM referential action differs from initial SQL | Preserve referenced geography; initial migration, BranchesService.findMany district lookup and marketplace joins; no district-delete production method found | KEEP_DB_ALIGN_PRISMA | Explicit Restrict/Cascade | No | Maintains current behavior; removing a used district remains blocked |
| canonical_services.replacement_canonical_id | nullable, RESTRICT/CASCADE | Optional relation with implicit SetNull | Missing explicit relation action | MERGED requires replacement; ServicesService.updateCanonical and SQL canonical_services_merge_state_check | KEEP_DB_ALIGN_PRISMA | Explicit Restrict/Cascade | No | Cannot silently erase merge destination |
| platform_settings.updated_at | CURRENT_TIMESTAMP | @updatedAt only | DB insert default omitted | SQL insert timestamp plus ORM update timestamp; settings upsert/reset | KEEP_DB_ALIGN_PRISMA | @default(now()) + @updatedAt | No | Preserve both insert/update semantics |
| business_documents.updated_at | CURRENT_TIMESTAMP | @updatedAt only | Same | Onboarding document history timestamp; catalog and migration | KEEP_DB_ALIGN_PRISMA | @default(now()) + @updatedAt | No | No row rewrite |
| canonical_services.updated_at | CURRENT_TIMESTAMP | @updatedAt only | Same | Catalog creation/update timestamps; taxonomy migration/service | KEEP_DB_ALIGN_PRISMA | @default(now()) + @updatedAt | No | No row rewrite |
| media_files.updated_at | CURRENT_TIMESTAMP | @updatedAt only | Same | Media metadata timestamps; catalog | KEEP_DB_ALIGN_PRISMA | @default(now()) + @updatedAt | No | No row rewrite |
| staff_invitations.updated_at | CURRENT_TIMESTAMP | @updatedAt only | Same | Invitation lifecycle timestamps; catalog | KEEP_DB_ALIGN_PRISMA | @default(now()) + @updatedAt | No | No row rewrite |
| recurring_booking_plans.service_ids | JSONB default [] | Json without default | Existing DB fallback omitted | RecurringService resolves/validates selected services and explicitly supplies list; default is not permission to create invalid booking | KEEP_DB_ALIGN_PRISMA | @default("[]") | No | ORM field becomes optional; API/service validation unchanged |
| recurring_booking_plans.preferred_time | text default 09:00 | String without default | Existing fallback omitted | RecurringPreviewDto still requires time; RecurringService explicitly supplies requested time | KEEP_DB_ALIGN_PRISMA | @default("09:00") | No | No new API fallback or scheduling rule |
| special_working_days_branch_id_date_idx | nonunique btree(branch_id,date); unique index also exists | Only unique declaration | Older schedule index retained when unique constraint was introduced | Booking schedule lookups use branch/date; migrations 20260713 and 20260829 | KEEP_DB_ALIGN_PRISMA | Add explicit @@index with existing name | No | Potential redundant index retained; later removal requires distinct approval |
| user_sessions composite index | PostgreSQL truncated name ending revoked_i | Prisma-generated name ending revok_idx | Identifier length truncation algorithms differ | Same five columns and order; 20260806_section_a_identity_workspace | NAMING_ONLY | Explicit map to actual index name | No | No rebuild/rename |
| booking_violation_events composite index (post-five only) | Truncated name ending occurred_at_id | Prisma-generated name ending occurred_a_idx | Same truncation difference, becomes visible after pending migration 17 | Same customer/business/time lookup; 20260917_booking_violation_events | NAMING_ONLY | Explicit map to actual index name | No | No rebuild/rename; no scoring change |

## Remaining diff classification

The complete final machine output is preserved in `tmp/schema-alignment/diff-current-main-equivalent-final.log` and `diff-post-five.log`. A second untouched copy `beautybook_test_restriction_202609192302` was restored from main and its entire snapshot matched the initial baseline, so the final main-equivalent diff uses the final source without reverting any copy migrations. The arrows in Prisma diff are proposed changes to reach a target schema, **not changes executed in this task**. Do not turn these logs into DROP SQL or run db push.

| OBJECT / GROUP | DB STATE | PRISMA STATE | ROOT CAUSE | BUSINESS INTENT | DECISION | SOURCE CHANGE | MIGRATION REQUIRED | RISK / EVIDENCE |
|---|---|---|---|---|---|---|---|---|
| booking_violation_events + BookingViolationKind | Missing in main-equivalent copy before chain | Active model/enum | Approved migration 17 pending on main | Valid-event evidence without historical backfill | INTENTIONAL_DRIFT (pending) | None | Existing migration 17 only | Disappears from post-five diff |
| customer_booking_policies | Missing before chain | Active model | Approved migration 18 pending | Same-business restriction state | INTENTIONAL_DRIFT (pending) | None | Existing migration 18 only | Disappears from post-five diff |
| 12 health/consultation tables + 10 enums | Public before chain, archive_health_20260919 after chain | Absent from active Prisma | Approved retired domain archive | Preserve consent/history outside runtime | INTENTIONAL_DRIFT | None; prior cleanup untouched | Existing archive + row-guard only | Two consent fingerprints preserved; no drop |
| archive_20260829_* (28 tables) | Historical public archive tables | Intentionally absent | Workforce retirement retained history | Traceability/recovery | INTENTIONAL_DRIFT | None | No | Keep rows/FKs; audit inventory already documents them |
| archive_20260911_staff_profiles_on_leave | Historical archive | Absent | Prior status normalization | Retain original staff status evidence | INTENTIONAL_DRIFT | None | No | Preserve |
| archive_20260915_manager_retirement | Historical archive | Absent | Prior manager retirement | Retain conversion/session evidence | INTENTIONAL_DRIFT | None | No | Preserve |
| legacy_role_migration_audit | Historical audit | Absent | Role cleanup evidence | Traceability | INTENTIONAL_DRIFT | None | No | Preserve |
| legacy_role_reference_audit | Historical audit | Absent | Role-reference cleanup evidence | Traceability | INTENTIONAL_DRIFT | None | No | Preserve |
| legacy_service_category_migration_audit | Historical audit | Absent | Taxonomy cleanup evidence | Traceability | INTENTIONAL_DRIFT | None | No | Preserve |
| cash_shifts, cash_movements | Existing empty retired tables | Absent | Retired cash-shift domain, already recorded in schema audit | Keep untouched pending separately approved cleanup | REMOVE_LATER | None | Not for this alignment; separate future decision | DATABASE_SCHEMA_AUDIT_DRAFT.md records candidates; no active runtime reference found |
| Legacy workforce enums + RoleCode_archive_20260915 | Existing types retained by historical objects | Absent | Archived domain needs types | Preserve archive graph | INTENTIONAL_DRIFT | None | No | No DROP TYPE |
| CashMovementType / CashShiftStatus | Existing types of retired cash tables | Absent | Same cash-shift retirement | Follow separate table cleanup decision | REMOVE_LATER | None | No current migration | Not a newly discovered business-rule mismatch |
| Existing SQL checks, triggers, partial indexes | DB-enforced policy/immutability | Not fully representable in Prisma | ORM expressiveness limits | Keep DB invariants | INTENTIONAL_DRIFT | None | No | Prisma diff alone is not proof of trigger/check parity; integration coverage is required |

No KEEP_PRISMA_CHANGE_DB decision. No new migration file. No applied migration edited. No new material mismatch outside this scope identified.

## Verification and boundaries

- Fresh native dump/restore of main into the new copy; fingerprint/count of all 166 pre-existing tables plus migration ledger matched before testing.
- Backup is local and Git-ignored under `docs/db-backups/beautybook_test_restriction_202609192301.dump`.
- Prisma validate/generate passed.
- Main-equivalent diff: all listed active UUID/FK/default/index mismatches are gone; pending models and intentionally unmanaged historical objects remain.
- The unchanged five migration files applied on the new copy only. All 166 pre-existing table fingerprints/counts preserved; new events/policies empty at migration time.
- Post-five diff: only unmanaged historical/retired tables, their FKs and legacy enum types remain. No active-model table alteration remains.
- This task does not rerun reverse health archive recovery or modify its approved rehearsal DB/results.
- Test artifacts are local under `tmp/schema-alignment`; never commit the dump or local environment.
- Full backend/PostgreSQL run after final changes: **102 suites / 934 tests passed, zero failed or skipped** (existing 917 plus 17 alignment tests; 777 unit and 157 PostgreSQL integration cases).
- Backend build passed with final generated client. Root and nested FE `git diff --check` passed. No FE source change was required.
- New tests cover PlatformSetting ORM create/read/update, UUID actor/null/invalid UUID, actual PlatformSettingsService upsert/reset, native SQL UUID/timestamp defaults, every listed timestamp/recurring default, both RESTRICT deletes, all four relevant index names.
- Initial run: old 917 tests passed; two new FK assertions incorrectly expected SQLSTATE 23503. Actual PostgreSQL RESTRICT correctly returned 23001. Assertions were corrected to require 23001 and the exact FK names; no application/DB behavior changed. Initial log is preserved as `backend-postgres-tests-initial.log`.
- Final read-only check at **2026-09-19 22:40:04 +07:00**: 395 FK, zero orphan, all 12 archive table fingerprints unchanged after tests. Main's 166 tables AND migration ledger still match the initial snapshot exactly. All 47 migration file checksums still match the recorded preflight history/pending chain.
- Existing non-failing test warnings: pg concurrent-query deprecation and development in-memory blacklist without Redis. These are not newly introduced schema mismatches and are not proof of production readiness.

## Status

**READY FOR MAIN DEPLOYMENT REVIEW.**

- Resolved: all UUID/native-default, two FK action, seven timestamp/recurring default declarations and retained schedule index differences listed above.
- Naming-only: user_sessions and booking_violation_events composite indexes, mapped to existing names.
- New DB migrations required: **0**. No applied or pending migration SQL modified.
- Unresolved active-schema mismatches in this scope: **0**.
- Intentionally nonempty diff: historical archives/audit tables, legacy enum types, and separately deferred cash-shift objects. They must remain untouched by deployment tooling.
- Deferred decisions: optional redundant schedule index removal and cash-shift retirement cleanup. Neither is required to align runtime declarations; this is not a final schema audit or authorization for diagram work.
- Main database: unchanged, five migrations still pending. Original approved health rehearsal remains unchanged.
- No Git push; no final diagrams; no main migration. A separate deployment review must refresh main safety gates, backup/restore verification and maintenance plan before applying anything.
