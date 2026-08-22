# Global Appointment Calendar — implementation report

Date: 2026-07-15

## Outcome

- `/salon/appointments` now opens a shared calendar workspace as the primary experience.
- Existing pending/change-request/unassigned queues remain available in the secondary **Action center** tab.
- `/admin/appointments` uses the same calendar engine and supports real business/branch filtering.
- Day, Week and Month views use real scheduler API data bounded to the visible date range.
- The existing design system, application shell, sidebar and topbar remain unchanged.

## Role and scope behavior

- `BUSINESS_OWNER`: defaults to Week and **All branches** when the tenant has multiple branches; each visible-range request is made only for an allowed branch.
- `BRANCH_MANAGER`: sees only assigned branches and all staff within that branch.
- `RECEPTIONIST`: defaults to Day and retains queue, confirm, reschedule/assign via scheduler, and check-in actions when permitted.
- `STAFF`: backend scheduler and queue queries are constrained to the current staff profile; the UI locks the staff filter to **Personal calendar** and omits broad list/stat tabs.
- Platform users with booking permission use the admin workspace and can filter by business, branch, staff, service, status and visible calendar period.
- Backend remains the source of truth for permission, branch scope, status transitions, move/resize validation and change-request approval.

## Calendar behavior

- Visible date range is calculated independently for Day, Week and Month, then sent to `GET /bookings/scheduler`.
- Multi-branch views issue bounded parallel requests only for the currently visible range and merge/deduplicate staff and bookings.
- A request sequence guard ignores stale responses.
- Filters include customer/booking-code search, staff, service and status.
- Event cards show time, customer, service, staff and textual status; color is supplemental.
- The detail drawer lazily loads the real booking detail endpoint and shows code, customer, service, branch, staff, start/end, price snapshot, permitted notes, status history and the next permitted direct action.
- Existing drag/move and resize interactions call backend APIs, optimistically update, and roll back with an error toast on failure. They are disabled in aggregated multi-branch mode.

## Backend hardening included

- Scheduler data for staff-only principals is limited to the current staff profile and customer contact fields are redacted in the scheduler payload.
- Queue and booking-list queries use exact allowed branch IDs; an empty scope now returns no rows instead of acting like an unrestricted filter.
- Pending change requests respect branch scope.
- Approve/reject change-request endpoints assert access to the request booking's branch.

## Verification evidence

- Frontend production build: pass (`3245` modules transformed).
- Backend production build: pass.
- Backend unit/regression tests: `26` suites passed, `129` tests passed; one separately gated integration suite skipped in the default run.
- PostgreSQL integration tests: `3/3` passed, including different-date overlap and concurrent payment/refund protections.
- Docker: API healthy; web running on port `8080`; PostgreSQL and Redis volumes preserved.
- Browser smoke tests used real seeded data for Platform Admin, Receptionist, Staff and Business Owner.
- Responsive checks passed at `375`, `768`, `1024` and `1440` pixels without document-level horizontal overflow; mobile defaults to Day.
- Drawer focus/escape behavior, accessible labels, textual statuses and visible focus styles were preserved/verified.
- Browser runtime console: no errors during the verified appointment flows.

## Main implementation files

- `beauty-booking-web-main/beauty-booking-web-main/src/pages/Admin/AdminAppointmentsView.jsx`
- `beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonAppointments.jsx`
- `beauty-booking-web-main/beauty-booking-web-main/src/components/appointments/AppointmentQueues.jsx`
- `beauty-booking-web-main/beauty-booking-web-main/src/components/admin/scheduler/SchedulerView.jsx`
- `beauty-booking-web-main/beauty-booking-web-main/src/components/admin/scheduler/BookingEventCard.jsx`
- `beauty-booking-web-main/beauty-booking-web-main/src/components/admin/scheduler/BookingDetailDrawer.jsx`
- `beauty-booking-api-main/src/bookings/bookings.controller.ts`
- `beauty-booking-api-main/src/bookings/bookings.service.ts`
- `beauty-booking-api-main/src/bookings/change-requests.service.ts`
- `beauty-booking-api-main/src/bookings/bookings.scheduler.spec.ts`
