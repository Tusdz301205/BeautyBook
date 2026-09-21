# BeautyBook — Technical Final Baseline

Ngày chốt: **21/09/2026**. Đây là source of truth kỹ thuật cho bước lập sơ đồ khóa luận riêng. Tài liệu này chỉ mô tả, không chứa sơ đồ hoặc đặc tả use case.

## 1. Final actors và account roles

Actors: Guest, Customer, Business Owner, Receptionist, Staff, Platform Admin.

Account roles duy nhất:

- `CUSTOMER`
- `BUSINESS_OWNER`
- `RECEPTIONIST`
- `STAFF`
- `PLATFORM_ADMIN`

Guest là public actor, không phải account role. Một tài khoản vận hành không được mượn quyền Customer; một người cần hai persona phải dùng hai tài khoản tách biệt.

## 2. Kiến trúc và công nghệ

- Frontend: React 18, React Router, Zustand, Vite, Socket.IO client.
- Backend: NestJS 11, TypeScript, REST `/api/v1`, JWT, guards/decorators RBAC, Socket.IO scheduler events.
- Data: PostgreSQL 18, Prisma 7 + PostgreSQL adapter; Redis tùy chọn cho blacklist/cache, dev có fallback in-memory được cảnh báo.
- Verification: Jest/Supertest/PostgreSQL integration, Node test runner, Playwright, Docker Compose.
- Kiến trúc: SPA → REST/WebSocket API → service/domain policy → Prisma/PostgreSQL. Tenant là Business; branch scope nằm dưới Business.

## 3. Active business domains

Authentication/session; user/RBAC; business and branch onboarding; service catalog and branch offerings; staff profiles/capabilities; booking and scheduler; cancellation/change request; no-show/violation/restriction; promotions/vouchers; manual payment, ledger, refund and invoice; reviews/moderation; notifications; media; privacy; ownership/legal/payout history; reporting; waitlist; loyalty; recurring booking; saved services.

Retired: Manager role family, health/consultation runtime, HR attendance/timesheet/payroll/salary/workforce, online card payment, cancellation/no-show fee.

## 4. Core routes

| Actor | Function | Route | Permission | Controller / service |
| --- | --- | --- | --- | --- |
| Guest | Xem cơ sở công khai | `GET /api/v1/branches/:id` | Public decorator | `BranchesController` / `BranchesService` |
| Guest | Xem dịch vụ công khai | `GET /api/v1/services` | Public decorator | `ServicesController` / `ServicesService` |
| User | Đăng nhập/chọn workspace | `POST /api/v1/auth/login` | Public; workspace validation | `AuthController` / `AuthService` |
| Customer | Tạo lịch | `POST /api/v1/bookings` | `booking:create:self` | `BookingsController` / `BookingsService` |
| Customer | Xem lịch của mình | `GET /api/v1/bookings/my-appointments` | `booking:read:self` | `BookingsController` / access service |
| Customer | Hủy lịch đúng hạn | `PATCH /api/v1/bookings/:id/status` | `booking:cancel:self` | `BookingsController` / `BookingsService` |
| Customer | Gửi yêu cầu hủy muộn | `POST /api/v1/bookings/:id/change-requests` | `change_request:create:self` | `BookingsController` / `ChangeRequestsService` |
| Customer | Lưu dịch vụ | `POST /api/v1/saved-services/:serviceId` | Customer self | `SavedServicesController` / service |
| Customer | Đánh giá | `POST /api/v1/reviews` | `review:create:self` | `ReviewsController` / `ReviewsService` |
| Customer | Xem voucher | `GET /api/v1/vouchers/mine` | `voucher:read:self` | `VouchersController` / admin service |
| Customer | Danh sách chờ | `POST /api/v1/waitlist` | `booking:create:self` | `WaitlistController` / `WaitlistService` |
| Owner/Receptionist | Tạo lịch tại quầy | `POST /api/v1/bookings` | tenant/branch create | `BookingsController` / `BookingsService` |
| Owner/Receptionist | Vận hành scheduler | booking scheduler routes | tenant/branch read/update | `BookingsController` / booking services |
| Owner/Receptionist | Xác nhận no-show | `PATCH /api/v1/bookings/:id/status` | tenant/branch update | `BookingsController` / violation policy |
| Owner/Receptionist | Xử lý change request | booking change-request review route | tenant/branch approve | `BookingsController` / `ChangeRequestsService` |
| Owner | Quản lý cơ sở/chi nhánh | `/api/v1/business`, `/api/v1/branches` | tenant permissions | business/branch controllers and services |
| Owner | Quản lý dịch vụ/nhân sự | `/api/v1/services`, `/api/v1/staff` | tenant permissions | service/staff controllers and services |
| Owner | Khuyến mãi/voucher | `/api/v1/promotions`, `/api/v1/vouchers` | tenant manage | promotion controllers/services |
| Owner | Báo cáo/audit tenant | `/api/v1/reports`, `/api/v1/admin/audit-logs` | tenant read | report/admin controllers |
| Staff | Xem và xử lý dịch vụ được phân công | booking item routes | assigned branch/item permissions | booking item service |
| Platform Admin | Duyệt business/branch | `/api/v1/admin/*` | platform permissions | `AdminController` and domain services |
| Platform Admin | Cấu hình nền tảng | `/api/v1/admin/settings` | `platform_setting:manage:platform` | admin/platform-setting services |
| Platform Admin | Moderation/report | admin/review/report routes | platform permissions | respective controllers/services |

Toàn bộ metadata của **273 route** được thu thập trong evidence cuối; OpenAPI generated file là catalog giao tiếp chi tiết.

## 5. Core entities

| Entity | Prisma model | Table | PK | Important FK | State |
| --- | --- | --- | --- | --- | --- |
| Account | `User` | `users` | UUID `id` | avatar media | Active |
| Scoped role | `UserRole` | `user_roles` | UUID `id` | user, role, grantor; business/branch scope | Active |
| Customer | `CustomerProfile` | `customer_profiles` | UUID `id` | user | Active |
| Owner profile | `BusinessOwnerProfile` | `business_owner_profiles` | UUID `id` | user | Active |
| Staff | `StaffProfile` | `staff_profiles` | UUID `id` | user, business, primary branch | Active |
| Tenant | `Business` | `businesses` | UUID `id` | owner profile | Active |
| Branch | `Branch` | `branches` | UUID `id` | business, province/district | Active |
| Service taxonomy | `CanonicalService` | `canonical_services` | UUID `id` | replacement canonical | Active |
| Business service | `BusinessService` | `business_services` | UUID `id` | business/category/canonical | Active |
| Branch offering | `BranchServiceOffering` | `services` | UUID `id` | branch/business service | Active |
| Staff capability | `StaffService` | `staff_services` | UUID `id` | staff/offering | Active |
| Booking aggregate | `Booking` | `bookings` | UUID `id` | customer, branch, canceller | Active |
| Booking item | `BookingService` | `booking_services` | UUID `id` | booking, service, staff | Active |
| Booking history | `BookingStatusHistory` | `booking_status_history` | UUID `id` | booking, actor | Active |
| Change request | `AppointmentChangeRequest` | `appointment_change_requests` | UUID `id` | booking, requester/reviewer | Active |
| Violation event | `BookingViolationEvent` | `booking_violation_events` | UUID `id` | booking, customer, business, request | Active/immutable |
| Booking restriction | `CustomerBookingPolicy` | `customer_booking_policies` | UUID `id` | customer, business, triggering event | Active |
| Payment/ledger | `Payment`, `FinancialLedgerEntry` | payment/ledger tables | UUID | booking/business/payment refs | Active manual finance |
| Review | `Review` | `reviews` | UUID `id` | booking/customer/branch | Active |
| Audit | `AuditLog` | `audit_logs` | UUID `id` | actor/entity references | Active |
| Health history | 12 retired models | `archive_health_20260919.*` | preserved | preserved historical FK | Archive only |

Active schema totals: **121 Prisma models / 92 enums**. Full entity inventory is in `DATABASE_SCHEMA_INVENTORY.md`.

## 6. Core implementation classes

| Class/file | Responsibility |
| --- | --- |
| `AuthService`, `JwtStrategy`, auth guards | Login, session/workspace, principal and account separation |
| `RolesGuard`, `ScopeGuard`, `policy.ts` | Role, permission and resource-bound tenant/branch/self enforcement |
| `BookingsService` | Create/quote/availability/status booking aggregate operations |
| `BookingsAccessService` | Customer/tenant/branch access and response scope |
| `BookingItemsService` | Per-service assignment and lifecycle |
| `ChangeRequestsService` | Late cancellation/reschedule request lifecycle |
| `customer-cancellation-policy.ts` | 4-hour direct-vs-request rule |
| `booking-violation-policy.ts` | Immutable late/no-show events and rolling score |
| `customer-booking-policy.ts` | 30-day restriction lifecycle and extension |
| `BranchesService`, `BusinessOnboardingService` | Branch/tenant lifecycle and public/preview visibility |
| `StaffService`, `StaffInvitationsService` | Staff profile, invitation, branch assignment and capabilities |
| `PricingEngineService`, voucher/promotion services | Quote, promotion/voucher reservation and limits |
| `PaymentsService`, finance services | Manual transactions, ledger/refund/invoice history |
| `ReviewsService` | Review eligibility, ownership, moderation and history |
| `SchedulerGateway` | Authorized scheduler WebSocket updates and resync |

## 7. Final business rules

### Booking and availability

- Server revalidates branch/service/staff capability, working time, collision, lead time and horizon in the transaction.
- `available-slots` uses the same minimum lead time and maximum booking horizon as create.
- Idempotency and serializable/locking controls prevent duplicate booking and double ownership of a staff slot.
- Booking stores service name/price/duration snapshots; later catalog edits do not rewrite history.

### Cancellation, late cancellation and no-show

- At least 4 hours before start: Customer direct cancellation, slot released, zero violation.
- Under 4 hours: direct cancel blocked; a valid request created before `startAt` records `LATE_CANCELLATION` immediately at `requestedAt` (+1).
- Approval changes booking to `CANCELLED` without a second point. Expiry keeps the valid +1 and cannot become no-show.
- `NO_SHOW` requires 15-minute grace, explicit confirmation and no prior valid cancel/report/request; Owner or Receptionist only; +2; no monetary fee.

### Violation/restriction

- Score is derived from valid immutable events in rolling 90 days per Customer + Business: late +1, no-show +2.
- 0–1 normal; 2 light warning; 3 strong warning plus acknowledgment; at least 4 restricts self-booking for 30 days.
- A new violation during restriction extends `endsAt` to 30 days from the new event.
- Expired restriction is not reactivated by old rolling score alone.
- Owner/Receptionist assisted booking remains allowed.

### Payment and review

- Current scope uses manual/counter financial records and traceable ledger/refund/invoice history; online card payment and cancellation fees are retired.
- Review requires an eligible completed booking and correct customer ownership; moderation actions are tenant/platform scoped and audited.

### Tenant, branch and account separation

- Business is the tenant boundary; branch actions require matching branch/business scope.
- Owner has tenant scope, Receptionist branch scope, Staff only assigned work/item scope, Platform Admin platform scope.
- Operational accounts cannot invoke Customer self routes even if stale flattened permissions remain.
- Public routes use explicit public metadata; unpublished resources require authorized owner preview.

## 8. Final verification baseline

- Main migrations/data integrity/Prisma/build/smoke: PASS.
- Backend + PostgreSQL: **103 suites, 943 tests, 0 failed, 0 skipped**.
- Frontend: **58 tests PASS**, production build PASS.
- Browser actor/RBAC/booking/responsive: **66/66 PASS**; concurrency/negative: **12/12 PASS**.
- Final schema evidence: 121 models, 92 enums, 273 routes, 113 runtime permission codes.
- Schema cleanup decisions: `DATABASE_SCHEMA_AUDIT_FINAL.md`.

Source/schema is considered frozen for the separate thesis-diagram task except for explicitly approved bug fixes or migrations.
