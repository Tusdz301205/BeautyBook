# Database migration policy and audit rollout

Migrations are append-only. Never edit, rename, delete, or insert a migration before the latest committed migration. Correct historical behavior in a new forward migration; filesystem modification dates alone are not evidence of production checksum drift. CI replays the complete history on a disposable PostgreSQL database.

## 20260909_audit_integrity

Adds 80 explicit parent foreign keys for the 24 business-completion models, 15 single-row amount/balance checks, three hot-path indexes, and changes customer/owner profile deletion from CASCADE to RESTRICT. Application user deletion is soft deletion; failed staff registration only deletes a newly created unassociated user. Financial and audit references are retained, including after soft deletion. Signed loyalty transaction points, booking adjustment deltas, and price adjustments intentionally remain signed; ledger amounts are nonnegative with CREDIT/DEBIT direction. Cross-row payment/refund limits remain enforced in serializable application transactions.

Deployment procedure:

1. Back up the target database with `pg_dump` and verify a restore in isolation. Do not seed/reset the target.
2. Run `scripts/audit-integrity-preflight.sql` read-only. Investigate every nonzero violation; do not silently delete or reassign orphan records.
3. Rehearse migration and application tests on the restored copy. Compare row counts before/after; this migration performs no data writes.
4. Schedule a maintenance window: indexes are deliberately transactional (not CONCURRENTLY) for atomic rollback. A 10-second lock timeout aborts safely when busy. Large installations should prebuild equivalent indexes CONCURRENTLY in a reviewed separate deployment plan.
5. Run `prisma migrate deploy`; verify all new constraints have `convalidated = true`, rerun preflight, and test booking, loyalty, invoices, ownership and refunds. Health-record data and removed payment/fee features are not reintroduced.
6. On failure the transaction rolls back; retain the error, resolve the cause, then use Prisma's failed-migration recovery procedure. Never mark a partially applied migration successful. A rollback after success requires a new reviewed forward migration restoring the two previous profile FKs and dropping only the 80 named FKs, 16 checks and three indexes in this migration. Never remove unrelated constraints.

The isolated integration suite must use an explicitly named `_test`/`_e2e` database. It intentionally retains immutable ledger evidence until that disposable database is discarded. A CI pass does not replace backup/restore rehearsal on a deployment's actual data.
