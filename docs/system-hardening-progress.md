# Beauty Booking system hardening progress

Audit window: 2026-07-15. Status vocabulary: `NOT_STARTED`, `AUDITING`, `CONFIRMED`, `ALREADY_FIXED`, `IMPLEMENTING`, `TESTING`, `VERIFIED`, `DEFERRED`.

`VERIFIED` means implementation plus a targeted test or reproducible runtime check. Compilation alone is not treated as verification.

## Baseline and final regression

| Item | Status | Evidence |
|---|---|---|
| Git working tree | DEFERRED | The supplied root has an empty/incomplete `.git`; `git status`/`git diff` cannot provide a reliable change set. Existing files were treated as user-owned. |
| Existing 42-route frontend redesign | ALREADY_FIXED | Existing migration reports mark the legacy route UI as removed. This task preserved the new design system and route set. |
| Backend build and unit regression | VERIFIED | `npm.cmd run build` passed; `npm.cmd test -- --runInBand` passed 25 suites / 126 tests. The three environment-gated integration tests are reported separately. |
| PostgreSQL integration | VERIFIED | Container run passed 3/3 tests: date-aware overlap, concurrent payment collection, concurrent refund reservation. Test fixtures were cleaned (`IT-%` count = 0). |
| Frontend production build | VERIFIED | Vite transformed 3,244 modules and emitted route-level chunks. |
| Dependency audit | VERIFIED | `npm.cmd audit --omit=dev` reports 0 vulnerabilities after compatible Nest/Multer/Hono patch upgrades. |
| Docker runtime | VERIFIED | PostgreSQL, Redis, API and web containers are running; API/PostgreSQL/Redis health checks are healthy; Redis returned `PONG`. No seed/reset/volume deletion was run. |
| Browser runtime smoke | VERIFIED | Public booking wizard loaded real branches, Admin scheduler loaded real data, admin-to-salon direct URL redirected to `/admin`, and browser console had no errors/warnings. |
| Permission catalog | VERIFIED | Permission catalog/resource serialization regression passed; unknown controller permission count remains zero. |

## Phase tracker

| Phase | Issue | Priority | Status | Verification |
|---|---|---:|---|---|
| 1 | WebSocket JWT + live-session authentication | P0 | VERIFIED | Gateway tests and live anonymous Socket.IO connection rejection. |
| 1 | Permission/scope-aware rooms | P0 | VERIFIED | Tests cover customer, branch and platform-permission room selection. |
| 1 | Cross-tenant-safe minimal booking events | P0 | VERIFIED | No global broadcast; test proves PII/note exclusion and scoped dispatch. |
| 1 | Production WebSocket CORS | P0 | VERIFIED | Allowlist is environment-driven and production wildcard is rejected by test. |
| 1 | Frontend authenticated reconnect | P0 | VERIFIED | Scheduler supplies current access token and handles create/update/delete events; frontend build/browser scheduler smoke passed. |
| 2 | Canonical DATE + TIME appointment helper | P0 | VERIFIED | Unit tests cover storage split, full instant reconstruction and timezone stability. |
| 2 | Staff/customer overlap includes appointment date | P0 | VERIFIED | Unit query assertions plus real PostgreSQL different-day/same-day/adjacent checks. |
| 2 | Transactional create overlap recheck | P0 | VERIFIED | Create rechecks staff/customer collision inside Serializable transaction. |
| 2 | Cancellation/reschedule cutoff | P0 | VERIFIED | Cutoffs now combine DB DATE + TIME into the canonical instant. |
| 2 | Scheduler timezone stability | P0 | VERIFIED | Backend timezone normalization, frontend wall-clock adapter and browser scheduler smoke passed. |
| 3 | Shared availability/final-validation rules | P0 | VERIFIED | Slot generation and create/move/resize/assign reuse the final validator. |
| 3 | Leave/break/holiday/special day rules | P0 | VERIFIED | Targeted tests cover leave/break; implementation checks branch hours, holidays and special working days. |
| 4 | Concurrent payment collection | P1 | VERIFIED | Serializable row lock + partial unique index; real two-request test settled exactly one payment. |
| 4 | Refund reservation/processing concurrency | P1 | VERIFIED | Payment row lock and conditional transitions; real concurrent requests reserved only 80/100 once. |
| 4 | Honest payment provider behavior | P1 | VERIFIED | Unsupported MOMO/VNPAY/ZaloPay/card methods return a semantic error; mock mode is explicit and production-gated. |
| 5 | Redis idempotency + fingerprint | P1 | VERIFIED | Atomic `SET NX EX`, actor/route/key hash, stable payload hash, replay/conflict/in-flight/error-release behavior; unit tests pass and runtime Redis is healthy. |
| 5 | Token/secret exclusion from idempotency cache | P1 | VERIFIED | Idempotency is allowlisted to duplicate-sensitive booking/payment/voucher mutations; auth login/refresh exclusion is tested. |
| 6 | Frontend refresh single-flight | P1 | VERIFIED | One shared refresh promise; retry preserves the original mutation Idempotency-Key; frontend build passed. |
| 6 | HttpOnly access/refresh cookies + CSRF | P1 | DEFERRED | Current Zustand session persists tokens in localStorage. A cookie migration changes the auth contract and needs a coordinated rollout. |
| 6 | JWT last-active write throttle | P1 | VERIFIED | Session `lastActiveAt` updates at most once per five minutes via conditional update. |
| 6 | Proxy-aware rate limiting | P1 | VERIFIED | Bounded `TRUST_PROXY_HOPS`; authenticated tracker uses user + resolved IP; sensitive auth endpoints have tighter limits. |
| 7 | Append-only health access audit | P1 | VERIFIED | Dedicated table/migration; real DB trigger test proved UPDATE and DELETE are blocked. No record payload is written. |
| 7 | Change-request expiry and review race | P1 | VERIFIED | Lazy expiry, expiry-aware listing and conditional PENDING claim; targeted service tests pass. |
| 7 | Critical mutation audit coverage | P1 | VERIFIED | Payment/refund, booking workflow, business policy/onboarding, settings and schedule-management routes are decorated; exception messages are not persisted/logged raw. |
| 8 | Trust-score fairness | P1 | VERIFIED | Customer-caused cancellation/no-show is observed but does not penalize salon trust; unit test passes. |
| 8 | Gross/refund/net consistency | P1 | VERIFIED | Shared FinancialMetricsService handles partial refunds; reports/admin finance reuse it; unit test proves 1,000,000 - 200,000 = 800,000 net. |
| 9 | Public marketplace query performance | P2 | VERIFIED | Branch cards are paged (max 100), use relation counts + page-scoped SQL AVG, and no longer hydrate all bookings/reviews; service listing is paged. DB indexes and tests added. |
| 9 | Collision-safe booking codes | P1 | VERIFIED | PostgreSQL sequence-backed `BB-YYYY-NNNNNNN`; sequence/migration existence checked in the live DB. |
| 9 | Serializable retry semantics | P1 | VERIFIED | Bounded P2034 retry with jitter and semantic 409; no unbounded or external-provider retry. |
| 9 | OpenAPI contract | P2 | VERIFIED | 114 paths regenerated; selective Idempotency-Key, pagination and reusable error response schema documented. |
| 9 | Frontend route lazy-loading | P2 | VERIFIED | Heavy scheduler/admin/chart/salon/customer pages are lazy with an accessible fallback; build emits separate route chunks. |
| 9 | Full TypeScript / TanStack Query migration | P2 | DEFERRED | JSX/manual server-state architecture remains; broad migration was not justified for the critical hardening scope. |
| 9 | Business Owner advanced scope/date dashboard | P2 | DEFERRED | Existing dashboard uses real APIs, but the full multi-branch action-center/date-range enhancement was not completed. |
| 10 | Full voucher/RBAC/WebSocket PostgreSQL matrix | P1/P2 | DEFERRED | Critical booking/payment/refund paths have real DB coverage; the exhaustive matrix remains future test work. |
| 10 | Full Playwright mutation journey | P2 | DEFERRED | Browser smoke is read-only. A complete guest-to-review/admin journey would mutate the user's long-lived dataset and needs isolated fixtures. |
| 11 | Deployment hardening | P1 | VERIFIED | Helmet, compression, body limits, CORS, bounded proxy trust, liveness/readiness, request ID, graceful shutdown and production-secret rejection implemented/tested. |
| 11 | `.env` hygiene | P1 | VERIFIED | `.env` remains local and gitignored; `.env.example` documents required settings. Local development secrets were not deleted. |
| 11 | Real PSP, object storage and mobile push | P1/P2 | DEFERRED | Provider credentials/contracts are outside this workspace; capabilities are reported honestly as absent/partial. |
| 12 | Admin Portal compatibility | P0/P1 | VERIFIED | All platform roles remain; permission-aware Admin scheduler loaded successfully through Docker/browser. |

## Data-safety record

- Did not run `prisma db seed`.
- Did not run `docker compose down -v` or remove any named volume.
- Did not reset or recreate PostgreSQL.
- Integration fixtures used unique `IT-*` booking codes and were rolled back/deleted; final count is zero.
- Existing frontend redesign and all role routes were preserved.
