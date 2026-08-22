# Beauty Booking system hardening report

Date: 2026-07-15  
Scope: final Beauty Booking backend, frontend, PostgreSQL/Redis runtime and Docker deployment.

## 1. Outcome

The P0 correctness/security issues and the critical P1 concurrency, audit, finance and deployment issues were implemented and verified. The existing frontend redesign, Admin Portal structure, 11-role model, RBAC catalog and long-lived PostgreSQL/Redis volumes were preserved.

This report deliberately does **not** call the system production-ready. Real payment gateways, HttpOnly-cookie authentication, mobile push delivery, media/object storage and an isolated full mutation E2E environment are still absent.

## 2. Issues audited and confirmed

The audit confirmed these material defects in the supplied code:

- unauthenticated Socket.IO connections, wildcard WebSocket CORS, global booking broadcasts and over-broad event payloads;
- PostgreSQL `DATE`/`TIME` values treated as standalone JavaScript instants, with overlap queries missing `appointmentDate`;
- cancellation/reschedule cutoff calculations based on a TIME-only value;
- available-slot and final mutation validation using divergent schedule rules;
- payment/refund race windows and process-local idempotency;
- refresh races and a session `lastActiveAt` write on every authenticated request;
- no append-only health-record access history;
- change requests vulnerable to expiry/review races;
- inconsistent partial-refund revenue calculations and unfair customer-caused trust penalties;
- low-entropy/random booking code generation;
- public branch listing hydrating every booking/review to calculate cards;
- eager import of all frontend pages;
- missing Helmet/compression/bounded proxy trust/production-secret rejection;
- vulnerable dependency versions reported by npm audit.

## 3. Already fixed before this task

- The 42-route frontend redesign and removal of matching legacy UI had already been completed and documented.
- The project already had a strong permission catalog, permission-aware navigation and scope helpers.
- Global DTO validation, JWT sessions, basic throttling, Docker/PostgreSQL/Redis and the new Admin Portal were present.
- The frontend already used real API data in the implemented routes; this task did not replace the visual system.

## 4. WebSocket security changes

- Every handshake now validates the access JWT through the same session/user validation path as HTTP; revoked sessions and suspended users are rejected.
- Authorized rooms are derived from actual permissions/scopes: `user:{id}`, `branch:{id}`, `business:{id}` and `platform`.
- A platform role such as MARKETING does not enter the platform booking room without `booking:read:platform`.
- Booking events target scoped rooms only; no `server.emit(...)` wildcard remains.
- Event bodies contain only `id`, `status`, `branchId` and `updatedAt`—no customer PII, health data, notes or internal records.
- WebSocket CORS uses `CORS_ORIGINS`; `*` is rejected in production.
- The scheduler sends the current access token during connection/reconnection and handles create/update/delete events.
- Runtime evidence: an anonymous Socket.IO client received `WebSocket authentication failed`.

## 5. Booking datetime and availability changes

A canonical helper now owns conversion between:

- PostgreSQL `appointment_date DATE`;
- PostgreSQL start/end `TIME` wall-clock values;
- a full UTC instant interpreted in `BOOKING_TIME_ZONE` (default `Asia/Ho_Chi_Minh`).

Staff and customer overlap queries now include the appointment date and use half-open intervals, so an appointment ending at 10:00 is adjacent to—not overlapping—one starting at 10:00. Create, move, resize and assignment paths normalize storage consistently. Cancellation and reschedule cutoffs reconstruct the full appointment instant before comparing with `Date.now()`.

Slot generation and final validation now share checks for active staff, skill, branch, staff working hours, breaks, approved leave, branch holiday, branch hours and special working days. Final create/move/resize/assign still validates inside the transaction. New cross-midnight writes are explicitly rejected because the split legacy schema cannot represent them unambiguously.

## 6. Payment and refund concurrency changes

- Collection runs in a bounded Serializable transaction, takes a booking row lock and rechecks existing settled payments.
- A partial unique PostgreSQL index allows only one `PAID`, `PARTIALLY_REFUNDED` or `REFUNDED` payment per booking.
- Unique/serialization races return semantic conflict responses rather than generic 500 errors.
- Refund request/processing takes a payment row lock and reloads reserved/completed totals.
- `PENDING`, `APPROVED` and `REFUNDED` requests reserve refundable balance; concurrent requests cannot over-reserve.
- Review and process operations use conditional state transitions so duplicate approval/processing loses safely.
- Payment status becomes `PARTIALLY_REFUNDED` or `REFUNDED` from the completed total.
- MOMO, VNPAY, ZaloPay and card methods are rejected honestly until gateway callback/signature flows exist. CASH and BANK_TRANSFER are supported; MOCK is explicit and production-gated.

Real PostgreSQL results:

- two simultaneous collection calls: exactly one success and one rejection, exactly one settled payment;
- two simultaneous refund requests of 80 against a payment of 100: exactly one success, reserved total 80;
- all integration fixtures were removed afterward.

## 7. Redis idempotency changes

- Duplicate-sensitive booking/payment/refund/voucher POST routes use atomic Redis `SET NX EX` reservation.
- The storage key hashes actor, HTTP method, route and client key; the record stores a stable SHA-256 request fingerprint.
- Same key + same payload replays the status/body; same key + different payload returns 409; in-flight duplicates return 409.
- Failed business requests release the reservation.
- Production fails closed when Redis is unavailable; memory fallback is development-only.
- Login, refresh and other authentication routes are deliberately excluded, so access/refresh tokens and passwords are never cached in Redis.
- `IDEMPOTENCY_TTL_SECONDS` controls the bounded retention period.

## 8. Authentication, session and rate-limit changes

- The frontend uses one shared refresh promise, preventing a burst of simultaneous refresh requests.
- Retried mutations retain their original `Idempotency-Key`.
- JWT validation updates `lastActiveAt` only when stale by at least five minutes and uses a conditional update.
- The global throttler runs after JWT resolution and tracks authenticated user + resolved IP, or anonymous resolved IP.
- Login, register, refresh, verification and password-reset endpoints have tighter route limits.
- `TRUST_PROXY_HOPS` is bounded from 0 to 5; invalid values stop startup.

Known auth limitation: access and refresh tokens are still persisted by Zustand/localStorage. Moving to HttpOnly Secure SameSite cookies requires coordinated backend/frontend refresh, CSRF and logout/session contract work and was deferred rather than partially introduced.

## 9. Health, audit and change-request changes

- `health_record_access_logs` stores actor/role, record/booking/customer/business/branch/consent scope, purpose, action, result, IP, user agent and timestamp—never the health payload.
- PostgreSQL triggers reject UPDATE and DELETE. A real transaction inserted a test row, proved both guards fired, and rolled it back.
- Health reads write GRANTED or DENIED entries; list reads log each returned record.
- Change requests lazily expire stale rows, hide expired pending rows and conditionally claim `PENDING AND expiresAt > now()` before approval/rejection.
- Critical payment/refund, booking workflow, business onboarding/policy, platform setting and schedule-management mutations received audit coverage.
- Generic audit metadata includes actor roles/scopes, request ID and IP. Request bodies and raw exception messages are not persisted or printed.

## 10. Financial reporting and trust fairness

`FinancialMetricsService` is now the common calculation source:

`gross revenue - completed refund amount = net revenue`

A partially refunded payment remains part of gross revenue. Admin finance and business reports use the same totals. A regression test proves a 1,000,000 payment with a 200,000 refund yields 1,000,000 gross, 200,000 refund and 800,000 net.

Salon trust no longer loses score for customer-caused cancellation/no-show. No-show remains observable as a metric; the fairness test verifies a customer event does not reduce the salon score.

## 11. Booking codes and Serializable retry

- Booking codes use the PostgreSQL `booking_code_seq` and the format `BB-YYYY-NNNNNNN`.
- The database unique constraint remains the final guard.
- Serializable conflicts (`P2034`) receive at most two retries with short jitter, then a semantic 409.
- External provider calls are not blindly retried inside this helper.

## 12. Marketplace performance

The old branch list included every service and every booking/review, then aggregated ratings in Node.js. It now:

- supports `page`/`limit` and caps page size at 100;
- returns lightweight card fields;
- uses Prisma relation counts instead of hydrating bookings/services;
- computes approved rating averages in PostgreSQL for the current page only;
- adds composite branch/service/review indexes for active, non-deleted listings;
- pages the public service listing as well.

The array response shape was retained to avoid breaking current frontend callers.

## 13. OpenAPI and frontend engineering

- `docs/openapi.generated.json` was regenerated with 114 paths.
- Idempotency headers are documented only on routes that actually require them.
- Public branch/service pagination parameters, bounded key length, reusable error response schema and 409 conflict responses were added.
- Heavy admin, scheduler, reports/charts, salon and customer pages are route-level lazy chunks behind a shared accessible loading fallback.
- Vite output confirms separate route chunks; the main application chunk is no longer forced to include each page module.
- API refresh logic is single-flight while keeping the existing domain exports and behavior.

Full TypeScript conversion, domain-file splitting and TanStack Query migration were not performed. The existing JSX architecture remains functional, and a broad mechanical rewrite would have added regression risk without addressing a confirmed critical defect.

## 14. Deployment and dependency hardening

- Helmet security headers, compression and bounded JSON/form body sizes are enabled.
- CORS is an explicit allowlist and rejects wildcard in production.
- Production refuses missing, short or recognizable default JWT secrets.
- Request IDs are accepted only in a bounded safe format or generated as UUIDs and returned as `X-Request-Id`.
- Liveness and database readiness endpoints are available.
- Nest graceful shutdown hooks are enabled.
- Nest packages were patched to 11.1.28, pulling Multer 2.2.0; Hono was pinned to the compatible fixed 1.19.13 transitive version.
- Final production dependency audit: 0 vulnerabilities.
- `.env` is gitignored; `.env.example` documents timezone, Redis, idempotency, proxy, body and mock-payment settings.
- Local Compose intentionally uses `NODE_ENV=development` and explicit local-only mock/development secrets. Production validation remains strict.

## 15. Notification and domain-model reality

Notification capability classification:

- in-app notification persistence/read state: **IMPLEMENTED**;
- transactional email through configured SMTP: **IMPLEMENTED/PARTIAL** (delivery depends on environment credentials);
- scoped booking WebSocket realtime: **IMPLEMENTED**;
- device-token registration: **PARTIAL**;
- FCM/APNs provider delivery, retry and delivery receipts: **NOT IMPLEMENTED**.

Domain-model classification:

- core booking, service, promotion/voucher, payment/refund, review and RBAC flows: **IMPLEMENTED**;
- combo and recurring booking models: **PARTIAL/SCHEMA_ONLY** in the current API/UI;
- media/image models: **SCHEMA_ONLY/PARTIAL**; no complete authorized upload/storage/validation/delete workflow exists;
- legal document input remains JSON-backed; no complete document-upload UX/provider abstraction exists.

No schema was deleted merely because its workflow is incomplete.

## 16. Files modified

Principal backend files:

- `src/scheduler/scheduler.gateway.ts`, `scheduler.module.ts` and gateway tests;
- `src/common/utils/booking-datetime.ts`, `serializable-transaction.ts` and tests;
- `src/bookings/bookings.validation.ts`, `bookings.service.ts`, `change-requests.service.ts`, health controller/service and tests;
- `src/payments/payments.service.ts`, `financial-metrics.service.ts` and tests;
- `src/common/interceptors/idempotency.interceptor.ts`, `audit.interceptor.ts` and tests;
- `src/auth/strategies/jwt.strategy.ts`, `src/auth/auth.controller.ts`;
- `src/common/guards/user-aware-throttler.guard.ts`;
- `src/reports/reports.service.ts`, `src/admin/admin.service.ts`, `trust-snapshot.service.ts` and tests;
- `src/branches/branches.service.ts`/controller/tests and `src/services/services.service.ts`/controller;
- critical booking/payment/business/staff/admin controllers for audit annotations;
- `src/main.ts`, `src/health.controller.ts`, `src/app.module.ts`, deployment tests;
- `scripts/generate-openapi.mjs`, `docs/openapi.generated.json`;
- `prisma/schema.prisma`, Dockerfile, package manifests and environment examples.

Principal frontend files:

- `src/api/apiClient.js`;
- `src/store/authStore.js`;
- `src/components/admin/scheduler/SchedulerView.jsx`;
- `src/App.jsx`.

Workspace/deployment documentation:

- root `docker-compose.yml`;
- `docs/system-hardening-progress.md`;
- `docs/system-hardening-report.md`.

## 17. Migrations added

- `20260715_add_health_access_logs`: append-only health access history and indexes;
- `20260715_harden_payment_concurrency`: one-settled-payment partial unique index;
- `20260715_harden_booking_codes`: sequence-backed public booking codes;
- `20260715_optimize_public_marketplace`: composite public-list indexes.

All four are applied in the running PostgreSQL database. No migration reset was used.

## 18. Tests added or strengthened

- WebSocket CORS, room scope, payload minimization and anonymous rejection;
- booking timezone/date split and overlap predicate tests;
- leave/break/final-validator consistency;
- payment authorization, provider honesty, refund balance and conditional transition tests;
- Redis idempotency fingerprint/replay/conflict/auth-exclusion tests;
- production secret validation;
- append-only health access behavior and no-payload audit assertions;
- expired/concurrent change-request review;
- partial-refund financial totals and trust fairness;
- marketplace paging/DB aggregation;
- real PostgreSQL date-aware overlap, concurrent payment and concurrent refund tests.

## 19. Final command results

| Check | Result |
|---|---|
| Backend build | PASS |
| Backend unit/regression | PASS — 25 suites, 126 tests; integration suite skipped unless explicitly enabled |
| PostgreSQL integration | PASS — 1 suite, 3 tests |
| Permission/security contracts | PASS — 2 suites, 5 tests |
| Frontend production build | PASS — 3,244 modules |
| npm production audit | PASS — 0 vulnerabilities |
| Docker image build | PASS — API and web |
| Docker runtime | PASS — API/PostgreSQL/Redis healthy, web running |
| Health API | PASS — `/health/live` 200, `/health/ready` 200/database up |
| Security headers/request ID | PASS — CSP, `nosniff`, UUID request ID observed |
| Anonymous WebSocket | PASS — rejected |
| Browser smoke | PASS — public booking, Admin scheduler, direct URL redirect, no console error |
| Data cleanup | PASS — no `IT-*` integration booking remains |

## 20. Known limitations and deferred P2 work

1. Tokens remain in localStorage; HttpOnly cookie + CSRF migration is required before stronger browser-session claims.
2. Real payment provider callbacks, signature verification, reconciliation and webhook idempotency are not implemented.
3. Rate-limit storage remains process-local; multi-instance production should use a shared throttler store.
4. `BOOKING_TIME_ZONE` is one application-wide zone and new cross-midnight appointments are rejected.
5. Full voucher quota concurrency, exhaustive tenant/branch/customer API isolation and authenticated cross-tenant WebSocket integration matrices remain to be automated against isolated fixtures.
6. There is no committed Playwright/Vitest/RTL suite; the final browser check was a read-only runtime smoke test.
7. The full guest → booking → operations → payment → review → analytics journey was not run against the user's persistent dataset.
8. Business Owner dashboard has real data but not the full requested multi-branch/date-range/action-center enhancement.
9. Media/document upload, object storage and validation workflows are incomplete.
10. FCM/APNs mobile push delivery is absent.
11. Audit logs are append-style at application level, but only the health access table has database-enforced UPDATE/DELETE immutability.
12. Trust snapshot history is not a full append-only time series in the existing domain model.
13. The supplied `.git` metadata is incomplete, so a trustworthy Git diff/commit report could not be produced.

## 21. Safe operating notes

- Do not use `docker compose down -v` unless permanent database/Redis deletion is intended.
- Do not run `npx prisma db seed` against a database whose current data must be retained; this project's seed logs and behavior remove old data.
- Normal restart: `docker compose up -d` from the workspace root.
- Schema deployment: `docker compose exec api npx prisma migrate deploy` (the API container also runs this during startup).
- Production must replace every local credential/secret, set `NODE_ENV=production`, use an explicit CORS allowlist, provide Redis, disable mock payments and terminate TLS at a trusted proxy matching `TRUST_PROXY_HOPS`.
