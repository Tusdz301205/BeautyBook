# BeautyBook frontend rebuild progress

Final audit: 2026-07-15. Status vocabulary: `NOT_STARTED`, `DESIGNING`, `IMPLEMENTING`, `MIGRATED`, `VERIFIED`, `LEGACY_REMOVED`.

`LEGACY_REMOVED` means the replacement is wired to real APIs and existing workflows, browser-verified for its allowed roles, responsive-checked, and the corresponding old visual code/imports have been removed before the final production build.

| Zone | Route | Current status | Final evidence |
|---|---|---|---|
| Public | `/login` | LEGACY_REMOVED | Demo role login verified for all 10 authenticated roles; mobile touch targets pass |
| Public | `/forgot-password` | LEGACY_REMOVED | Public API/error state and mobile layout verified |
| Public | `/reset-password` | LEGACY_REMOVED | Token guard/error state and responsive layout verified |
| Public | `/verify-email` | LEGACY_REMOVED | Token guard/error state and responsive layout verified |
| Public | `/accept-invitation` | LEGACY_REMOVED | Invitation token guard/error state and responsive layout verified |
| Public booking | `/book` | LEGACY_REMOVED | Real branch/service APIs, desktop/mobile and empty/loading states verified |
| Public booking | `/book/staff` | LEGACY_REMOVED | Real public staff API; invalid-state redirect verified |
| Public booking | `/book/time` | LEGACY_REMOVED | Real available-slot API; invalid-state redirect verified |
| Public booking | `/book/info` | LEGACY_REMOVED | Guest/contact/consent workflow retained; invalid-state redirect verified |
| Public booking | `/book/confirm` | LEGACY_REMOVED | Preview/create/conflict workflow retained; invalid-state redirect verified |
| Public booking | `/book/success` | LEGACY_REMOVED | Success state and responsive navigation verified |
| Customer | `/customer/appointments` | LEGACY_REMOVED | Own-scope list/change/cancel/review UI and role guard verified |
| Customer | `/customer/profile` | LEGACY_REMOVED | Real profile API and Customer shell verified |
| Customer | `/customer/privacy` | LEGACY_REMOVED | Real consent grant/revoke UI and own scope verified |
| Customer | `/customer/security` | LEGACY_REMOVED | Password/session UI, role guard and mobile layout verified |
| Salon | `/salon` | LEGACY_REMOVED | Real overview only; Owner and Manager landing plus restricted-role redirects verified |
| Salon | `/salon/services` | LEGACY_REMOVED | CRUD/action RBAC, branch scope, dialog keyboard behavior and mobile cards verified |
| Salon | `/salon/appointments` | LEGACY_REMOVED | Queue/update and change-request permissions split; Owner/Manager/Receptionist/Staff verified |
| Salon | `/salon/staff` | LEGACY_REMOVED | CRUD/invite/schedule/services/leaves RBAC and 390px overflow fix verified |
| Salon | `/salon/promotions` | LEGACY_REMOVED | Promotion/voucher/grant API workflows and action RBAC verified |
| Salon | `/salon/reviews` | LEGACY_REMOVED | Real manage contract, scoped search/pagination/reply verified |
| Salon | `/salon/stats` | LEGACY_REMOVED | Real scoped reports and role access verified |
| Salon | `/salon/notifications` | LEGACY_REMOVED | Shared real notification APIs and all salon roles verified |
| Salon | `/salon/profile` | LEGACY_REMOVED | Branch-scope update UI and responsive layout verified |
| Salon | `/salon/onboarding` | LEGACY_REMOVED | Draft/update/submit workflow and Owner-only guard verified |
| Salon | `/salon/payments` | LEGACY_REMOVED | Collect/request/review/process actions permission-gated; no native prompts |
| Salon | `/salon/security` | LEGACY_REMOVED | Shared security center verified for salon roles |
| Salon | `/salon/account` | LEGACY_REMOVED | Shared account profile verified for salon roles |
| Platform | `/admin` | LEGACY_REMOVED | Role-aware workspace verified for Admin, Compliance, Support, Marketing, Finance |
| Platform | `/admin/salons` | LEGACY_REMOVED | Real branch management/status workflow, desktop/mobile tables/cards verified |
| Platform | `/admin/users` | LEGACY_REMOVED | Real user/role/suspend workflow, desktop/mobile tables/cards verified |
| Platform | `/admin/appointments` | LEGACY_REMOVED | Scheduler/list/stats and read-only specialist RBAC verified |
| Platform | `/admin/payments` | LEGACY_REMOVED | Admin/Support/Finance visibility and refund workflow verified |
| Platform | `/admin/promotions` | LEGACY_REMOVED | Admin/Marketing real campaign/voucher workspace verified |
| Platform | `/admin/reports` | LEGACY_REMOVED | Permission-gated real report endpoints and responsive charts verified |
| Platform | `/admin/reviews` | LEGACY_REMOVED | Admin/Marketing moderation route and backend role alignment verified |
| Platform | `/admin/violations` | LEGACY_REMOVED | Trust snapshots plus platform audit-log API verified for Compliance/Admin |
| Platform | `/admin/notifications` | LEGACY_REMOVED | Shared real notification center verified for platform roles |
| Platform | `/admin/settings` | LEGACY_REMOVED | Real allowlisted settings, no fabricated defaults, Admin-only guard verified |
| Platform | `/admin/compliance` | LEGACY_REMOVED | Real review queue, required notes and branch status workflow verified |
| Platform | `/admin/security` | LEGACY_REMOVED | Shared security center verified for all platform roles |
| Platform | `/admin/profile` | LEGACY_REMOVED | Shared profile API verified for all platform roles |

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 0 | Repository audit and 42-route inventory | VERIFIED |
| 1 | Local UX/UI skill and 10 external references | VERIFIED |
| 2 | Design system source of truth | VERIFIED |
| 3 | Public, Customer, Salon and Platform shells | VERIFIED |
| 4 | Shared UI primitives | VERIFIED |
| 5 | Authentication | VERIFIED |
| 6 | Public and Customer | VERIFIED |
| 7 | Booking flow | VERIFIED |
| 8 | Salon workspace | VERIFIED |
| 9 | Business Owner coverage | VERIFIED |
| 10 | Platform backoffice | VERIFIED |
| 11 | Compliance/Support/Marketing/Finance | VERIFIED |
| 12 | Reports/charts | VERIFIED |
| 13 | Responsive/accessibility | VERIFIED |
| 14 | Legacy/mock removal | LEGACY_REMOVED |
| 15 | Build/test/Docker/final report | VERIFIED |
