# STAFF mobile: check-in-only timetable

## Approved scope and workflow

This change owns `mobile/src/**`, `mobile/tests/**` and this document only. Root owns backend and web. Existing navigation, dependencies and design tokens are retained. Read `mobile/AGENTS.md` and the exact [Expo 57 docs](https://docs.expo.dev/versions/v57.0.0/) before editing.

The desk records arrival. Staff reads the personal timetable and item details; Staff does **no START or COMPLETE**. `staffApi` exposes only personal list and detail reads. The lifecycle mutation API, `useWorkActions` hook, confirmation dialogs and lifecycle buttons were removed, including for older responses with `canStart` or `canComplete` set to true. A linked Owner entering personal-work mode also gets only this read-only assigned-item view.

All work rows sort chronologically by planned item start, scheduled booking start or explicitly labelled appointment context, with item ID as a stable tie breaker. No action eligibility or lifecycle rank promotes an overdue service. Today and agenda retain every returned assigned item, including historical and legacy actual-audit rows.

Terminal service states (CANCELLED, SKIPPED and historical COMPLETED) take priority over the parent arrival state in item badges. Their cards retain separate arrival/history text and accessible labels; active and terminal siblings remain visible together.

Labels:

- SCHEDULED: **Đã lên lịch**.
- CHECKED_IN: **Khách đã đến**.
- Elapsed CHECKED_IN history: **Đã đến · Lịch đã qua**.

A past scheduled booking end is a projection into history. Persisted booking status stays CHECKED_IN, service status is not synthesized and actual times remain null/unknown unless separately recorded. No schedule time is copied into actual fields. Legacy actual audit and permission-based exceptional correction/history remain visible.

## Contract and mobile consumers

Booking and personal-work responses may include `attendanceWorkflow: CHECK_IN_ONLY`, `scheduledStartAt`, `scheduledEndAt`, `scheduleElapsed` and `scheduleBucket: UPCOMING | HISTORY | CANCELLED`. These fields are optional for rolling deployment. `checkedInHistory` accepts server HISTORY/elapsed metadata only for CHECKED_IN, excluding a CANCELLED projection. Missing metadata conservatively keeps check-in upcoming.

Customer booking mapping retains all metadata, raw status and server `canReview`. `bookingsApi.mine` uses one `GET /bookings/my-appointments?tab=all` and applies its envelope `serverNow` to every row. Independent tab reads are removed so an unchanged CHECKED_IN cannot disappear across the planned-end boundary. The all-tab snapshot includes upcoming bookings even when a customer history/detail surface is mounted, allowing the shared end timer to discover newly eligible history/reviews. The existing `completed` wire/navigation group now represents **Lịch sử**; an elapsed CHECKED_IN joins that group without receiving a COMPLETED label. The activity history, monthly calendar and rebooking paths consume the mapped group. Home's next-appointment selection already requires an upcoming future appointment and therefore excludes these history projections. No new Home layout or copy is needed.

Customer review visibility and submission require server `canReview === true`, an unreviewed authorized booking, and COMPLETED or CHECKED_IN in the projected history group. Missing/false permission, cancellation and legacy IN_PROGRESS expose no review action, even if old data places them in a history-like context. The sheet closes visually when eligibility disappears. Historical timing uses the existing SERVICE_ADJUSTMENT / ACTUAL_TIME_CORRECTION audit display.

A read-only refresh is scheduled at the earliest future CHECKED_IN **booking scheduled end**, based on `serverNow`; no device wall clock or individual service end determines history. Customer refresh uses the existing invalidation queue and its background/session fences. Staff refresh uses the existing personal read hook, its context fences and a monotonic response-receipt anchor. Missing valid server clock/end disables this automatic refresh. Offline or failed reads remain stale until a successful reload/foreground refresh; the client never invents completion or review permission.

Owner unfinished lists continue calling Root's scoped `/bookings?status=unfinished&sortOrder=appointment` query. Root excludes elapsed check-in rows and owns totals/pagination; mobile does not locally rewrite those counts. The mounted unfinished list schedules its earliest future CHECKED_IN end from current row `serverNow` and the successful read's monotonic `receivedAt`. It refetches the same scoped GET at that boundary; context key, revision, branch, request stamp, live scope and unmount guards reject obsolete callbacks. Loading, failed/stale reads and missing timing facts arm no timer. Owner projections retain schedule fields and audit/correction permission while omitting customer review authority. CHECKED_IN suppresses warnings demanding service start/completion. Essential check-in, arrival, no-show, cancellation and exceptional permission controls are unchanged.

## Authorization and API boundaries

| Surface | API | Mobile authority |
| --- | --- | --- |
| Today / agenda | GET /bookings/my-work-items?branchId&dateFrom&dateTo&page&limit | Active linked profile, valid STAFF work scope, exact business/branch, own assignment |
| Item detail | GET /bookings/my-work-items/:itemId | Own item only; drops cached data on 401/403/404 |
| Booking notification | GET /bookings/my-work-items?branchId&bookingId&page&limit | Personal items only; no Owner navigation from Staff |
| Lifecycle | None | No staff mutation API, hook or button |
| Owner unfinished | Root booking list with status=unfinished | Owner-scoped server query, server pagination |

Pagination remains sequential, bounded at 100 pages of 50 and verifies metadata plus the complete unique count. `useStaffWork` still fences context key, branch/date/target, revision, profile identity, request sequence and API session generation. Context changes immediately hide prior data. Authorization loss removes cached work; offline failure retains only same-context stale data. Root retains socket ownership and reconnect/foreground invalidation.

Actual elapsed audit uses persisted actual points and the response server clock with a monotonic receipt anchor. Stale values freeze at receipt; completed/stopped rows use recorded end points. These display clocks perform no lifecycle or schedule mutation.

## Changed paths

- `mobile/src/utils/bookingSchedule.ts` (new), `bookingOperationalTime.ts`.
- `mobile/src/operations/staff/StaffWorkScreen.tsx`, `WorkCard.tsx`, `staffApi.ts`, `types.ts`, `useStaffWork.ts`, `workModel.ts`; removed `useWorkActions.ts`.
- `mobile/src/types/api.ts`, `ownerOperations.ts`; `mobile/src/api/ownerOperations.ts`, `mobile/src/api/bookings.ts`.
- `mobile/src/context/BookingsContext.tsx`, `mobile/src/mappers/booking.ts`, `mobile/src/data/appointments.ts`.
- `mobile/src/components/AppointmentCalendar.tsx`, `mobile/src/screens/AppointmentDetailScreen.tsx`, `mobile/src/operations/owner/OwnerUI.tsx`, `UnfinishedBookings.tsx`, `hooks.ts`.
- `mobile/tests/check-in-workflow.test.cjs` (new), `staff-work.test.cjs`, `booking-sync.test.cjs`, `booking-operational-time.test.cjs`, `owner-operations.test.cjs`.
- `docs/mobile-staff-owner/STAFF.md`.

## Validation and limitations

Commands run from `mobile`:

- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `node --test --test-isolation=none tests/*.test.cjs`: 225 passing tests. Node's default child-process test isolation is unavailable in this sandbox (spawn EPERM); in-process isolation runs the complete suite without escalation.
- Scoped `git diff --check`: passed.

Tests cover read-only API/cards with legacy eligibility flags, chronological timetable, server metadata/history grouping, review visibility and submit authority, null actuals and historical corrections, one-read all-tab no-disappearance boundary, customer and mounted Owner scheduled-end refresh without a lifecycle event, revision/branch/scope/unmount timer fencing, mixed active/skipped/cancelled siblings, logout timer cleanup, complete pagination, stale reads, reassignment and existing owner/customer/session/notification fences. Obsolete START/COMPLETE expectations were intentionally replaced; authorization and scope regressions were retained.

Android native: **NOT_RUN**. iOS native: **NOT_RUN**. Emulator, Metro, native export and live API writes: **NOT_RUN**, following `mobile/AGENTS.md` and this task's narrower constraints. Backend projection integration and native acceptance need Root's QA with the new backend contract; mocked tests and TypeScript do not verify native rendering or live timing.
