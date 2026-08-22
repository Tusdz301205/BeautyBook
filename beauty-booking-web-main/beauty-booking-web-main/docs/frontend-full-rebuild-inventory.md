# BeautyBook full frontend rebuild inventory

Audit date: 2026-07-14. Source of truth: `src/App.jsx`, `src/api/apiClient.js`, `src/store/authStore.js`, and backend-provided permissions/scopes.

## Audit summary

- 42 user-facing routes: 5 auth, 6 public booking, 4 customer, 13 salon/business, 14 platform.
- 11 business roles are represented by four zones: Public, Customer, Salon/Business, Platform. `sessionType` selects a zone; permissions select visible routes and actions.
- 16 real API groups are in use: auth, bookings, reports, users, branches, services, staff, promotions, vouchers, notifications, reviews, admin, business, payments, health records, and the scoped request client.
- Existing behavior to keep: token refresh, `X-Business-Id`/`X-Branch-Id` context, backend permission list, tenant/branch/self checks, booking state machine, payment/refund workflow, consent checks, and all current API contracts.
- Existing presentation to replace: `Shell`, all `gb-*` visual classes, page-local buttons/inputs/cards/tables/dialogs, duplicated status components, and unused Vite starter styles/assets.

## Final migration status — 2026-07-15

All 42 user-facing routes in this inventory are now `LEGACY_REMOVED`. The production build, Docker stack, role-based browser QA, responsive checks, and removal audit are recorded in `docs/frontend-rebuild-progress.md` and `docs/frontend-full-rebuild-report.md`. The per-route status column below is retained as the original audit baseline.

## Route inventory

`KEEP_LOGIC` means business behavior/API calls remain. `REBUILD_UI` means the visual implementation is replaced. Status is intentionally conservative.

| Zone | Route | Roles | Permission / guard | Current component | Real API / workflow | Decision | Replacement | Status |
|---|---|---|---|---|---|---|---|---|
| Public | `/login` | Guest, all roles | Public | `LoginScreen` | `authApi.login`; role-derived destination | KEEP_LOGIC + REBUILD_UI | New auth shell/login form | NOT_STARTED |
| Public | `/forgot-password` | Guest | Public | `ForgotPassword` | `authApi.forgotPassword` | KEEP_LOGIC + REBUILD_UI | New recovery form | NOT_STARTED |
| Public | `/reset-password` | Guest | Public token | `ResetPassword` | `authApi.resetPassword` | KEEP_LOGIC + REBUILD_UI | New reset form | NOT_STARTED |
| Public | `/verify-email` | Guest | Public token | `VerifyEmail` | `authApi.verifyEmail` | KEEP_LOGIC + REBUILD_UI | New verification state | NOT_STARTED |
| Public | `/accept-invitation` | Invited staff | Public token | `AcceptInvitation` | `staffApi.acceptInvitation` | KEEP_LOGIC + REBUILD_UI | New invitation form | NOT_STARTED |
| Public | `/book` | Guest, Customer | Public | `BookingStep1` | `branchesApi`, `servicesApi`; branch/service selection | KEEP_LOGIC + REBUILD_UI | Public shell + wizard step 1 | NOT_STARTED |
| Public | `/book/staff` | Guest, Customer | Public | `BookingStep2` | `staffApi.getPublic`; staff selection | KEEP_LOGIC + REBUILD_UI | Wizard step 2 | NOT_STARTED |
| Public | `/book/time` | Guest, Customer | Public | `BookingStep3` | `bookingsApi.getAvailableSlots`; date/time selection | KEEP_LOGIC + REBUILD_UI | Wizard step 3 | NOT_STARTED |
| Public | `/book/info` | Guest, Customer | Public | `BookingStep4` | guest registration/contact/voucher/note capture | KEEP_LOGIC + REBUILD_UI | Wizard step 4 | NOT_STARTED |
| Public | `/book/confirm` | Guest, Customer | Public/session-aware | `BookingConfirm` | price preview, service lookup, booking create | KEEP_LOGIC + REBUILD_UI | Wizard review/confirm | NOT_STARTED |
| Public | `/book/success` | Guest, Customer | Public | `BookingSuccess` | booking success/navigation | KEEP_LOGIC + REBUILD_UI | New success state | NOT_STARTED |
| Customer | `/customer/appointments` | Customer | Customer session | `CustomerAppointments` | own appointments, cancel, change request, review | KEEP_LOGIC + REBUILD_UI | Customer shell/appointment center | NOT_STARTED |
| Customer | `/customer/profile` | Customer | Customer session | `ProfileSettings` | `usersApi.getMe/updateMe` | KEEP_LOGIC + REBUILD_UI | Shared profile form | NOT_STARTED |
| Customer | `/customer/privacy` | Customer | Customer session | `PrivacySettings` | health consent grant/revoke | KEEP_LOGIC + REBUILD_UI | Privacy/consent center | NOT_STARTED |
| Customer | `/customer/security` | Customer | Customer session | `SecuritySettings` | password and session management | KEEP_LOGIC + REBUILD_UI | Shared security center | NOT_STARTED |
| Salon | `/salon` | Owner, Manager, Receptionist, Staff | First allowed salon permission | `SalonLanding`, `SalonOverview` | booking/service/report overview | KEEP_LOGIC + REBUILD_UI | Role-aware salon home | NOT_STARTED |
| Salon | `/salon/services` | Owner, Manager | service update/create tenant/branch | `SalonServices` | service CRUD, categories, accessible branches | KEEP_LOGIC + REBUILD_UI | Service catalog workspace | NOT_STARTED |
| Salon | `/salon/appointments` | Owner, Manager, Receptionist, Staff | booking read tenant/branch | `SalonAppointments` | queue, change requests, status transitions | KEEP_LOGIC + REBUILD_UI | Salon calendar/queue | NOT_STARTED |
| Salon | `/salon/staff` | Owner, Manager | user read tenant/branch; actions separately gated | `SalonStaffManagement` | staff CRUD/invite/schedule/skills/leave | KEEP_LOGIC + REBUILD_UI | Team workspace | NOT_STARTED |
| Salon | `/salon/promotions` | Owner, Manager | promotion manage tenant/branch | `SalonPromotions` | promotion/voucher CRUD and grant | KEEP_LOGIC + REBUILD_UI | Promotion center | NOT_STARTED |
| Salon | `/salon/reviews` | Owner, Manager | review moderate tenant/branch | `SalonReviews` | scoped reviews/replies | KEEP_LOGIC + REBUILD_UI | Review workspace | NOT_STARTED |
| Salon | `/salon/stats` | Owner, Manager | report revenue tenant/branch | `SalonStats` | scoped reports | KEEP_LOGIC + REBUILD_UI | Salon analytics | NOT_STARTED |
| Salon | `/salon/notifications` | Salon roles | notification read self | `SalonNotifications` | list/unread/read-all | KEEP_LOGIC + REBUILD_UI | Notification center | NOT_STARTED |
| Salon | `/salon/profile` | Owner, Manager | branch update tenant/branch | `SalonProfile` | accessible branch update | KEEP_LOGIC + REBUILD_UI | Branch profile/settings | NOT_STARTED |
| Salon | `/salon/onboarding` | Owner | business create self/update tenant | `BusinessOnboarding` | draft/update/submit/review status | KEEP_LOGIC + REBUILD_UI | Onboarding wizard | NOT_STARTED |
| Salon | `/salon/payments` | Owner, Manager, Receptionist where granted | payment read tenant/branch | `PaymentsWorkspace` | collect/refund request/review/process by permission | KEEP_LOGIC + REBUILD_UI | Scoped finance workspace | NOT_STARTED |
| Salon | `/salon/security` | Salon roles | Authenticated | `SecuritySettings` | password/session management | KEEP_LOGIC + REBUILD_UI | Shared security center | NOT_STARTED |
| Salon | `/salon/account` | Salon roles | Authenticated | `ProfileSettings` | own profile | KEEP_LOGIC + REBUILD_UI | Shared account profile | NOT_STARTED |
| Platform | `/admin` | Platform Admin, Compliance, Support, Marketing, Finance | First allowed platform permission | `AdminLanding`, `AdminOverview` | platform reports/branches/bookings | KEEP_LOGIC + REBUILD_UI | Role-aware platform home | NOT_STARTED |
| Platform | `/admin/salons` | Platform roles where granted | branch read platform | `AdminSalons` | branch management/status approval | KEEP_LOGIC + REBUILD_UI | Business/branch directory | VERIFIED |
| Platform | `/admin/users` | Platform roles where granted | user read platform | `AdminUsers` | users, roles/scopes, suspend | KEEP_LOGIC + REBUILD_UI | User management center | VERIFIED |
| Platform | `/admin/appointments` | Platform roles where granted | booking read platform | `AdminAppointmentsView` | scheduler range/filter/move/resize/assign | KEEP_LOGIC + REBUILD_UI | Platform scheduler | VERIFIED |
| Platform | `/admin/payments` | Finance/Admin/Support where granted | payment read platform | `PaymentsWorkspace` | payment/refund workflow | KEEP_LOGIC + REBUILD_UI | Platform finance workspace | NOT_STARTED |
| Platform | `/admin/promotions` | Marketing/Admin where granted | promotion manage platform | `SalonPromotions` | platform promotion/voucher workflow | KEEP_LOGIC + REBUILD_UI | Campaign workspace | NOT_STARTED |
| Platform | `/admin/reports` | Admin/Finance/Marketing where granted | report platform permissions | `AdminReports` | revenue, growth, category, services, staff | KEEP_LOGIC + REBUILD_UI | Platform analytics | NOT_STARTED |
| Platform | `/admin/reviews` | Admin/Support/Compliance where granted | review moderate platform | `AdminReviewsModeration` | search/filter/moderate reviews | KEEP_LOGIC + REBUILD_UI | Moderation workspace | NOT_STARTED |
| Platform | `/admin/violations` | Admin/Compliance/Support where granted | trust snapshot or audit read | `AdminViolations` | trust snapshots and booking violations | KEEP_LOGIC + REBUILD_UI | Risk center | NOT_STARTED |
| Platform | `/admin/notifications` | Platform roles | notification read self | `AdminNotifications` | list/unread/read-all | KEEP_LOGIC + REBUILD_UI | Notification center | NOT_STARTED |
| Platform | `/admin/settings` | Platform Admin | platform settings manage | `AdminSettings` | settings read/update | KEEP_LOGIC + REBUILD_UI | Platform settings | NOT_STARTED |
| Platform | `/admin/compliance` | Compliance/Admin | business review platform | `AdminCompliance` | business review and branch status review | KEEP_LOGIC + REBUILD_UI | Compliance queue | NOT_STARTED |
| Platform | `/admin/security` | Platform roles | Authenticated | `SecuritySettings` | password/session management | KEEP_LOGIC + REBUILD_UI | Shared security center | NOT_STARTED |
| Platform | `/admin/profile` | Platform roles | Authenticated | `ProfileSettings` | own profile | KEEP_LOGIC + REBUILD_UI | Shared account profile | NOT_STARTED |

## Shared-code inventory

| Area | Current implementation | Migration decision |
|---|---|---|
| Routing/guards | `App.jsx`, `ProtectedRoute`, `PermissionGate` | KEEP behavior; split route config and lazy-load pages later |
| Authentication/RBAC | `store/authStore.js` | KEEP semantics and backend enforcement; expose role/context to new shells |
| API/scope | `api/apiClient.js` | KEEP contracts, refresh flow, and scope headers; add adapters only when presentation needs normalization |
| Booking state | `store/bookingStore.js` | KEEP workflow and persistence semantics |
| Shell | `components/layout/Shell.jsx` | REBUILD as Public, Customer, Salon, Platform shells |
| Status | `constants/status.js`, duplicated badges | KEEP enums/labels; REBUILD one status primitive |
| Forms | page-local controls and `gb-input` | REBUILD with persistent labels, helper/error slots, disabled/loading states |
| Tables | page-local HTML tables/cards | REBUILD one responsive table/card system |
| Dialogs/drawers | page-local fixed overlays | REBUILD accessible dialog/drawer primitives with focus restoration |
| Charts | Recharts components | KEEP calculations/data; migrate visual tokens and remove mock color imports |
| Scheduler | custom scheduler components | KEEP adapters/business actions; standardize visuals/states |
| Legacy styles | `styles/tokens.css` `gb-*`, `App.css` Vite starter | REMOVE only after all imports/usages are gone and routes are verified |

## Route aliases and fallbacks

`/`, `/customer`, `/salon`, `/admin`, and wildcard routes contain redirects/landing selection. They remain part of route verification but do not add separate business workflows. Redirect destinations must continue to be permission-aware.
