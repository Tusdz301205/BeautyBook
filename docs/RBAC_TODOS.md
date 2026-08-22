# RBAC + Scope Implementation — TODO Tracker

> Companion file cho `RBAC_SCOPE_ANALYSIS.md` (Phần 14).
> Cập nhật status mỗi ngày trong standup. Sprint planning dựa trên cụm Phase.

## Quy ước

- **Status**: `TODO` (chưa làm) / `WIP` (in progress) / `DONE` (hoàn thành) / `BLOCKED` (phụ thuộc chưa xong) / `CANCEL` (bỏ).
- **Effort**: người-ngày (1d = 1 ngày làm việc của 1 dev).
- **Owner**: assign khi sprint planning.

---

## Phase 0 — Setup & Foundation

| ID | Title | Effort | Depends | Owner | Status |
|----|-------|:------:|---------|-------|:------:|
| T0.1 | Khảo sát codebase NestJS hiện tại, vẽ dependency map | 0.5d | — | — | TODO |
| T0.2 | Tạo branch `feat/rbac-scope` + ADR `0001-rbac-scope-design.md` | 0.5d | T0.1 | — | TODO |
| T0.3 | Setup packages: `casl`, `@nestjs/throttler`, `argon2`, `otplib` | 0.5d | T0.2 | — | TODO |
| T0.4 | Setup Redis dev (Docker compose) | 0.5d | — | — | TODO |

## Phase 1 — Data Model (Tuần 2)

| ID | Title | Effort | Depends | Owner | Status |
|----|-------|:------:|---------|-------|:------:|
| T1.1 | Migration `users`, `tenants`, `branches` | 1d | T0.3 | — | TODO |
| T1.2 | Migration `roles`, `permissions`, `role_permissions`, `user_roles` | 1d | T1.1 | — | TODO |
| T1.3 | Migration `bookings`, `booking_health_records`, `payments`, `reviews`, `services`, `staff_profiles`, `schedules` | 2d | T1.2 | — | TODO |
| T1.4 | Migration `promotions`, `commission_ledger`, `audit_logs`, `jwt_revocations` | 1d | T1.3 | — | TODO |
| T1.5 | Migration `support_tickets`, `ticket_access_grants`, `user_devices`, `auth_sessions`, `app_versions` | 1d | T1.4 | — | TODO |
| T1.6 | Bật RLS cho `bookings`, `payments`, `booking_health_records`, `audit_logs` | 1.5d | T1.5 | — | TODO |
| T1.7 | Seed `permission_catalog.md` (Phần 12) | 1d | T1.2 | — | TODO |
| T1.8 | Seed demo data: 5 tenants × nhiều role | 1d | T1.7 | — | TODO |

## Phase 2 — Authentication & Audience (Tuần 3)

| ID | Title | Effort | Depends | Owner | Status |
|----|-------|:------:|---------|-------|:------:|
| T2.1 | AuthModule base: register, login, argon2, JWT (15m) + refresh (7d) | 2d | T1.1 | — | TODO |
| T2.2 | Tách endpoint `/auth/m/*` + `/auth/w/*` | 1.5d | T2.1 | — | TODO |
| T2.3 | JWT `audience` claim + audience guard | 1d | T2.2 | — | TODO |
| T2.4 | `token_version` trên users, bump khi đổi role/lock | 0.5d | T2.1 | — | TODO |
| T2.5 | Blacklist Redis `jwt:revoked:{jti}` | 0.5d | T2.4 | — | TODO |
| T2.6 | Password reset flow qua email token | 1d | T2.1 | — | TODO |
| T2.7 | 2FA TOTP setup, verify, backup codes | 2d | T2.1 | — | TODO |
| T2.8 | Mobile biometric flow | 1.5d | T2.2 | — | TODO |
| T2.9 | `UserDevices` CRUD + push token register | 1d | T1.5 | — | TODO |
| T2.10 | `auth_sessions` tracking + UI list | 1d | T1.5 | — | TODO |

## Phase 3 — Permission Catalog & CASL (Tuần 4)

| ID | Title | Effort | Depends | Owner | Status |
|----|-------|:------:|---------|-------|:------:|
| T3.1 | `PermissionCacheService` với Redis (TTL 10 min) | 1d | T0.4, T1.2 | — | TODO |
| T3.2 | CASL ability builder + scope mapping | 1.5d | T3.1 | — | TODO |
| T3.3 | `PolicyHook` + `throwUnlessCan` | 0.5d | T3.2 | — | TODO |
| T3.4 | Audience + Roles + Jwt guards chain | 1d | T2.3, T3.3 | — | TODO |
| T3.5 | `EntitlementsGuard` cho plan features | 1d | T1.3 | — | TODO |
| T3.6 | Role transition audit + cache invalidation | 0.5d | T3.1, T4.5 | — | TODO |

## Phase 4 — Customers API (Tuần 5)

| ID | Title | Effort | Depends | Owner | Status |
|----|-------|:------:|---------|-------|:------:|
| T4.1 | CustomerModule skeleton: bookings, salons, profile, reviews, payments, devices | 2d | T2, T3 | — | TODO |
| T4.2 | Apply policy cho booking: customer `*:*:own`. IDOR tests | 1.5d | T4.1, T3.3 | — | TODO |
| T4.3 | Booking write flow: create draft → confirm → cancel. Time-window validation | 2d | T4.2 | — | TODO |
| T4.4 | Review flow: create (30d), edit (24h), delete | 1d | T4.1 | — | TODO |
| T4.5 | Right-to-be-forgotten (PDPA) | 1d | T1.3 | — | TODO |
| T4.6 | Sensitive data qua `booking_health_records`, consent check | 1d | T1.3 | — | TODO |

## Phase 5 — Salon API (Tuần 6–7)

| ID | Title | Effort | Depends | Owner | Status |
|----|-------|:------:|---------|-------|:------:|
| T5.1 | SalonModule skeleton: dashboard, scheduler, bookings CRUD | 3d | T4 | — | TODO |
| T5.2 | Role-based policy: staff `:own/:assigned`, rec `:branch`, BM `:branch`, owner `:tenant` | 2d | T5.1, T3.3 | — | TODO |
| T5.3 | Staff flows: assigned bookings, swap request, time-off | 1.5d | T5.2 | — | TODO |
| T5.4 | Receptionist flows: check-in, collect cash, partial refund ≤ limit | 1.5d | T5.2 | — | TODO |
| T5.5 | Branch Manager flows: CRUD services, swap approve, refund ≤ BM limit | 2d | T5.2 | — | TODO |
| T5.6 | Owner flows: multi-branch, payout, role assign, audit export | 2d | T5.2 | — | TODO |
| T5.7 | Cross-role guard: BM không gán được owner/BM role | 1d | T5.6, T3.6 | — | TODO |
| T5.8 | Multi-branch Owner view | 1.5d | T5.6 | — | TODO |
| T5.9 | Multi-role `switch-role` flow | 1d | T3.6 | — | TODO |

## Phase 6 — Payments & Gateways (Tuần 8)

| ID | Title | Effort | Depends | Owner | Status |
|----|-------|:------:|---------|-------|:------:|
| T6.1 | PaymentModule: intent, capture, refund, partial refund, idempotency | 2d | T5 | — | TODO |
| T6.2 | VNPay integration: URL + IPN HMAC verify | 2d | T6.1 | — | TODO |
| T6.3 | MoMo integration | 1.5d | T6.1 | — | TODO |
| T6.4 | Stripe (optional, nếu KH quốc tế) | 1d | T6.1 | — | TODO |
| T6.5 | Refund authority: Rec 200k, BM 1tr, Owner 10tr, trên = Platform | 1d | T6.1, T8.x | — | TODO |
| T6.6 | Double-sign refund > 5tr | 1.5d | T6.5 | — | TODO |
| T6.7 | Cash payment walk-in + signature | 1d | T6.1 | — | TODO |
| T6.8 | Webhook security: HMAC + replay protection | 1d | T6.2 | — | TODO |

## Phase 7 — Admin/Platform API (Tuần 9–10)

| ID | Title | Effort | Depends | Owner | Status |
|----|-------|:------:|---------|-------|:------:|
| T7.1 | AdminModule skeleton: dashboard, salons list | 2d | T5 | — | TODO |
| T7.2 | Compliance: approve KYC, suspend, handle report | 2d | T7.1 | — | TODO |
| T7.3 | Support/CS: ticket queue + scope-limited access + small refund | 2d | T7.1 | — | TODO |
| T7.4 | Marketing: banner, featured salon, platform promotions | 1.5d | T7.1 | — | TODO |
| T7.5 | Finance: payout review, approve/reject/execute, report export | 2d | T7.1, T6.5 | — | TODO |
| T7.6 | Platform Admin super_admin_action flag | 1d | T7.1 | — | TODO |
| T7.7 | Impersonate user (time-bound, full audit) | 1d | T7.1 | — | TODO |
| T7.8 | Audit log full-text search (PostgreSQL tsvector) | 1d | T1.4 | — | TODO |
| T7.9 | Audit log export CSV/NDJSON | 0.5d | T7.8 | — | TODO |

## Phase 8 — Security & Compliance (Tuần 11)

| ID | Title | Effort | Depends | Owner | Status |
|----|-------|:------:|---------|-------|:------:|
| T8.1 | Field-level masking (commission, salary, health) | 1d | T5, T4.6 | — | TODO |
| T8.2 | JwtAuthGuard blacklist + token_version check | 0.5d | T2.5 | — | TODO |
| T8.3 | Helmet, CORS strict, CSP headers | 0.5d | T2 | — | TODO |
| T8.4 | Rate limit `/auth/login` (5/15min/IP) per audience | 1d | T2 | — | TODO |
| T8.5 | Lock user sau 5 fail login | 0.5d | T2.4 | — | TODO |
| T8.6 | CSRF middleware cho web, không bắt buộc mobile | 1d | T2 | — | TODO |
| T8.7 | Input validation + mass-assignment prevention | 1d | T4-T7 | — | TODO |
| T8.8 | GDPR consent banner + persist | 1d | T1.1 | — | TODO |
| T8.9 | Data retention cron (health records, inactive users) | 1d | T1.3 | — | TODO |
| T8.10 | Secrets management (Vault / KMS / AWS Secrets) | 1d | T0 | — | TODO |

## Phase 9 — Realtime, Push, Notification (Tuần 12)

| ID | Title | Effort | Depends | Owner | Status |
|----|-------|:------:|---------|-------|:------:|
| T9.1 | Socket.IO gateway 3 namespaces | 2d | T4-T7 | — | TODO |
| T9.2 | WS JWT auth + room theo audience + scope | 1d | T9.1, T2.3 | — | TODO |
| T9.3 | WS subscribe policy (CASL guard cho event) | 1d | T9.2 | — | TODO |
| T9.4 | Realtime event dispatch (booking events) | 2d | T9.3 | — | TODO |
| T9.5 | Push: FCM (Android) + APNs (iOS), theo `user_devices` | 2d | T1.5, T4 | — | TODO |
| T9.6 | In-app notification center + `GET /notifications` | 1d | T4, T5 | — | TODO |
| T9.7 | Notification preferences per user | 0.5d | T9.6 | — | TODO |

## Phase 10 — Test Matrix & CI (Tuần 13)

| ID | Title | Effort | Depends | Owner | Status |
|----|-------|:------:|---------|-------|:------:|
| T10.1 | E2E test cho mỗi ô trong Phần 4 (positive + negative). Ước 500 cases | 5d | T4-T7 | — | TODO |
| T10.2 | Tenant isolation tests (2 tenant fixtures, mọi endpoint) | 1d | T10.1 | — | TODO |
| T10.3 | Privilege escalation tests (mass-assignment, role escalation, audience mismatch) | 1d | T10.1 | — | TODO |
| T10.4 | JWT tests (expired, revoked, version mismatch, blacklist, signature) | 1d | T10.1 | — | TODO |
| T10.5 | Audit log tests (write log, UPDATE/DELETE blocked) | 1d | T10.1 | — | TODO |
| T10.6 | Field masking tests | 0.5d | T10.1 | — | TODO |
| T10.7 | CI pipeline chạy matrix tests, block merge on failure | 1d | T10.1 | — | TODO |
| T10.8 | Coverage gate: controller ≥ 100%, service ≥ 90% | 0.5d | T10.7 | — | TODO |

## Phase 11 — Monitoring & DevOps (Tuần 14)

| ID | Title | Effort | Depends | Owner | Status |
|----|-------|:------:|---------|-------|:------:|
| T11.1 | Prometheus metrics endpoint | 1d | T0.3 | — | TODO |
| T11.2 | Grafana dashboard | 1d | T11.1 | — | TODO |
| T11.3 | Alerting rules (403 burst, super_admin outside hours, audit ERROR) | 1d | T11.2 | — | TODO |
| T11.4 | Sentry cho NestJS + React + RN | 0.5d | T0 | — | TODO |
| T11.5 | Structured logging (Pino + ELK/Loki) với `request_id` correlation | 1d | T4-T7 | — | TODO |
| T11.6 | Backup strategy: DB hourly + audit log retention | 1d | T1 | — | TODO |
| T11.7 | Disaster recovery runbook + drill | 1d | T11.6 | — | TODO |
| T11.8 | Keycloak SSO integration cho admin | 2d | T2, T7 | — | TODO |

## Phase 12 — Documentation & Handoff (Tuần 15)

| ID | Title | Effort | Depends | Owner | Status |
|----|-------|:------:|---------|-------|:------:|
| T12.1 | OpenAPI/Swagger spec đầy đủ | 1.5d | T4-T7 | — | TODO |
| T12.2 | Postman/Insomnia collection | 0.5d | T12.1 | — | TODO |
| T12.3 | README per service + role map cheat sheet | 0.5d | T12.1 | — | TODO |
| T12.4 | On-call runbook (403 storm, Redis down, DB slow) | 1d | T11.3 | — | TODO |
| T12.5 | Security checklist: OWASP top 10, pentest plan | 1d | All | — | TODO |
| T12.6 | User training videos (Owner, BM, Rec) | 1d | T12.3 | — | TODO |
| T12.7 | Cutover plan (nếu migration từ hệ thống cũ) | 1d | T12.6 | — | TODO |

---

## Summary

| Phase | Tuần | Effort (dev-day) | TODOs | Status count |
|-------|:----:|:----------------:|:-----:|:------------:|
| 0 — Setup | 1 | 2 | 4 | 0/4 |
| 1 — Data model | 2 | 8.5 | 8 | 0/8 |
| 2 — Auth & Audience | 3 | 12 | 10 | 0/10 |
| 3 — CASL | 4 | 6.5 | 6 | 0/6 |
| 4 — Customer API | 5 | 8.5 | 6 | 0/6 |
| 5 — Salon API | 6–7 | 16 | 9 | 0/9 |
| 6 — Payments | 8 | 11 | 8 | 0/8 |
| 7 — Admin API | 9–10 | 12.5 | 9 | 0/9 |
| 8 — Security | 11 | 8.5 | 10 | 0/10 |
| 9 — Realtime + Push | 12 | 9.5 | 7 | 0/7 |
| 10 — Test & CI | 13 | 10.5 | 8 | 0/8 |
| 11 — DevOps | 14 | 7.5 | 8 | 0/8 |
| 12 — Docs | 15 | 6.5 | 7 | 0/7 |
| **Tổng** | **15** | **119.5** | **100** | **0/100** |

---

## Velocity Tracker

| Sprint | Start | End | Planned (d) | Done (d) | Notes |
|--------|-------|-----|:------------:|:--------:|-------|
| Sprint 1 (Phases 0-1) | — | — | — | — | — |
| Sprint 2 (Phase 2) | — | — | — | — | — |
| Sprint 3 (Phases 3-4) | — | — | — | — | — |
| Sprint 4 (Phase 5) | — | — | — | — | — |
| Sprint 5 (Phase 5 cont.) | — | — | — | — | — |
| Sprint 6 (Phase 6) | — | — | — | — | — |
| Sprint 7 (Phase 7) | — | — | — | — | — |
| Sprint 8 (Phase 7 cont.) | — | — | — | — | — |
| Sprint 9 (Phase 8) | — | — | — | — | — |
| Sprint 10 (Phase 9) | — | — | — | — | — |
| Sprint 11 (Phase 10) | — | — | — | — | — |
| Sprint 12 (Phase 11) | — | — | — | — | — |
| Sprint 13 (Phase 12) | — | — | — | — | — |

---

## Quick Status Commands

- "Đánh dấu T0.1 WIP" — set status WIP.
- "Hoàn thành T1.1" — set status DONE.
- "Block T4.2" — set BLOCKED + reason.
- "Cập nhật burndown" — show velocity summary.
- "Next recommended tasks" — show các TODO có deps thỏa mãn + chưa WIP.
