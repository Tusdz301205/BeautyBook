# Mobile STAFF / BUSINESS_OWNER backend contract

Validated against backend source on 2026-10-05. HTTP prefix is `/api/v1` (`src/main.ts`); paths below are relative to that prefix. Existing working-tree changes, timing source, transaction lifecycle and desktop/Customer contracts were preserved.

## Personal work

`GET /bookings/my-work-items?dateFrom=2026-10-05&dateTo=2026-10-05&branchId=<uuid>&bookingId=<uuid>&page=1&limit=50`

All filters are optional. Dates are inclusive branch calendar dates (`YYYY-MM-DD`), not device-local instants. `bookingId` works without dates for notification navigation. Default page=1, limit=50; limit max=100. Response:

```ts
type StaffWorkItem = {
  id: string; // BookingService UUID
  bookingId: string; bookingCode: string;
  branchId: string; businessId: string;
  branch: { id: string; name: string; timezone: string };
  customer: { fullName: string };
  serviceId: string; serviceNameSnapshot: string; staffId: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'CANCELLED';
  bookingStatus: string;
  revision: number; durationMinutes: number;
  itemStartAt: string | null; itemEndAt: string | null;
  appointmentDate: string; appointmentStartTime: string; appointmentEndTime: string;
  actualStartedAt: string | null; actualCompletedAt: string | null;
  actualStoppedAt: string | null;
  actualTimingSource: 'SERVICE_ADJUSTMENT' | 'UNAVAILABLE';
  serverNow: string; canStart: boolean; canComplete: boolean;
};
type StaffWorkList = {
  data: StaffWorkItem[]; total: number; page: number; limit: number; serverNow: string;
};
```

`GET /bookings/my-work-items/:itemId` returns one `StaffWorkItem`. These are item-centric reads: completed items remain present regardless of another item's status. List orders by booking date, planned item start, UUID; mobile may prioritize active/ready items within its fetched agenda. `total` counts items, not bookings. Fetch all required pages before claiming a full-day count.

The database query joins the timing audit and safe customer/branch fields in bulk; it does not issue a booking-detail query for each item. Both list and detail require active nondeleted linked StaffProfile, exact assignment, active role grants, matching tenant and branch, and SALON session. Tenant Owner authority allows personal assigned work only with a linked active profile. Owner in A does not widen Staff in B. Deleted bookings, branches and businesses are excluded. Requested filters intersect scope; an unauthorized booking/branch list filter returns no matching entries.

There are no contact details, customer/profile/health notes, colleague items, financial amounts, payment/refund records, adjustment snapshots/reasons/actors, or staff emergency contact data in this projection. Booking notes are conservatively omitted rather than reclassified as clinical/work notes.

Dates serialize as ISO strings. `itemStartAt/itemEndAt` and actual timestamps are instants. `appointmentDate` and `appointmentStartTime/appointmentEndTime` retain the existing database date/time contract; the latter must not be treated as an independently scheduled 1970 instant. Use branch timezone and existing wall-clock conversion. Actual timing comes only from `bookingItemActualTiming`, with `UNAVAILABLE`/null when audit evidence is missing. One `serverNow` anchors the list and its items.

Errors: invalid dates/pagination=400; wrong workspace/expired or missing operational scope=403; missing/inactive linked profile=404 with `code: STAFF_PROFILE_REQUIRED`; unavailable/reassigned detail=404. Dates do not silently normalize invalid calendar days.

## Lifecycle mutations and legacy reads

`PATCH /bookings/:bookingId/items/:itemId` retains `{action:'START'|'COMPLETE', reason:string, expectedRevision:number}`. UUIDs are mandatory in the URL; legacy list `id` is a booking code and `bookingId` is its UUID. Reason is stable honest audit text, not an invented customer instruction.

The existing item lock, assigned active profile check and revision claim remain authoritative. START requires SCHEDULED item and CHECKED_IN/IN_PROGRESS booking. COMPLETE requires IN_PROGRESS item. Conflicts/reassignment are rejected; item completion never completes the whole booking or bypasses settlement rules.

For Staff authority at the resource, mutation response remains a booking envelope with safe `bookingServices` containing only owned items, updated revision and actual timing. Owner response is unchanged. Always refetch the personal detail/list after success; after timeout or 409, refetch before deciding whether retry is valid. The committed state can exist even if delivery/revalidation fails.

`GET /bookings`, `/bookings/:id`, `/bookings/salon-queue`, and Staff scheduler responses now use `staffBookingView` allowlists. Existing list `data/meta` envelopes, booking-code `id` and `bookingId` conventions remain. Their own service context is retained, prices/amounts/contact/profile notes and broad nested rows are omitted. Scheduler own staff cards also omit emergency contacts. Null email/phone slots in the legacy scheduler remain compatible. These are intentional security reductions for Staff; Owner/Receptionist/Customer payloads remain unchanged. Staff `customerQuery` contact search is ignored.

`GET /staff/me` returns `{id,branchId,fullName,position,status,isBookable,branch:{id,name,businessId,timezone}}`, requires active nondeleted linked profile and live role scope at its actual branch, and checks selected session business/branch. A missing/inactive profile has `STAFF_PROFILE_REQUIRED`; Owner does not need a StaffProfile for Owner mode. Generic own `GET /staff/:id` falls back to this minimal profile for Staff authority; management callers retain the existing payload.

`GET /branches/accessible` adds `timezone`, preserving other selected fields. Mixed role branch resolution remains tied to each business/branch grant and selected business. Mobile uses this list rather than the broad management branch detail. Broad `/branches/accessible/:id` and the legacy personal commission endpoint are existing authorized contracts and are not used in V1; no new mobile financial permission was introduced.

## Owner operations

Reuse `/reports/owner-dashboard?branchId=<uuid>&from=YYYY-MM-DD&to=YYYY-MM-DD`, `/branches/accessible`, `/bookings/change-requests/pending`, request approve/reject, and `/operational-impacts` list/detail/item resolution/complete. Report accepts no businessId query: session scopes select the business. Owner permission is restricted before tenant resolution; an explicit branch must be authorized as Owner. Pending requests now also intersect the selected session business explicitly. They are live PENDING requests, not all requests or all booking alerts.

The existing dashboard includes financial fields; mobile must use only verified operational metrics. Bookings/completedBookings count bookings, not services; branch `activeStaff` counts ACTIVE profiles, not people currently working. Report date grouping uses each branch timezone. A cross-timezone total is a sum of branch-calendar-day totals. API failure must not be mapped to zero.

Send `X-Mobile-Owner-V1: true` on cancellation request approval and booking rejection/cancellation:

- `PATCH /bookings/change-requests/:reqId/approve` with optional reviewNote.
- `PUT /bookings/:id` with action=`reject`, reason.
- `PATCH /bookings/:id/status` with rejection/cancellation status, note.

The guard runs inside the existing serializable mutation transaction. Any linked payment (including refund linkage), payment intent/transaction, financial ledger, voucher, package, promotion, loyalty, price adjustment, invoice, or recurring-plan interaction blocks with 409 `{code:'MOBILE_FINANCE_REVIEW_REQUIRED',message}` and no financial details. Pending records are also conservatively blocked. Ordinary bookings with no such records use the existing lifecycle. Header omission retains desktop compatibility. This is a V1 workflow constraint, not an authorization grant; scope checks always run. Reschedule/staff-change approvals and request rejection retain existing validations because they do not cancel/reject the booking.

Operational impacts: APPROVED_EXCEPTION records item/case progress through the existing service. Complete is allowed only after every case item is resolved. Reassign/reschedule/transfer/cancel-refund workflows remain desktop unless separately implemented and reviewed. Never resolve a case by updating only the booking.

## Notifications and realtime

Notification list, unread count and mark-read are scoped by authenticated userId, not current branch/business. Persisted historical notifications may remain visible after assignment changes; a target never grants read authority. Known Staff impact producer sends a SYSTEM notification with BOOKING UUID, label-only body and metadata `{impactCaseId,impactItemId,resolution}`. Customer-only producer includes the reason in its customer message; Staff variant does not. Generic `notifySalonMembers` targets active Owner and affected-branch Receptionist, excluding Staff. There is no verified producer for every ordinary Staff lifecycle/assignment event; do not invent notification history or claim push delivery.

Staff notification navigation resolves `/bookings/my-work-items?bookingId=<uuid>` and handles no longer assigned/accessible target. Never execute arbitrary `actionUrl`. Existing realtime emits authorized scheduler invalidations/resync and requires refetch; no branch-wide detailed broadcast was added for Staff. This review checked source producers, not historical database notification contents.

## Validation and execution boundaries

Passed: backend `npm run typecheck`; 14 targeted Jest suites / 139 tests covering safe work projection, own item filters and timing, mixed/expired roles, missing profiles, business labels after credential verification, finance guard, branch scope, existing controller/access/scheduler/lifecycle, request/impact transactions and auth workspace behavior. A first run found an unfrozen timestamp comparison and an outdated lifecycle mock; fixtures were corrected without reducing assertions. Build completion is reported separately to root.

No API restart, migrations, database reset, seed/fixture writes, push, runtime mutation, or native checks were performed by this backend assignment. Root coordinates guarded runtime/native integration. Unit tests use Prisma mocks; these do not prove the deployed database schema or end-to-end HTTP state. No runtime fixture script was added. Only assigned backend source/tests and these two documents were edited.

Root 06/10 verification: build/typecheck PASS; 12 correct unit suites123tests + corrected access/lifecycle suites21tests =14unique suites144tests PASS. Initial root command had two nonexistent test-file paths (runner ENOENT, no failed assertions); corrected paths passed. OpenAPI regenerated222paths with personal work query params and X-Mobile-Owner-V1 header on3operations. Live API evidence15PASS in TESTS.md.

GET /business/mobile-context: SALON Owner only; selected business checked with Owner-only authority, or active self-owner scope reads own onboarding profile. Returns only id/name/status/bookingRestricted. Customer/Staff live403 and Owner minimal200 verified. Context3unitPASS brings latestunique root selection15suites147tests; fresh typecheck/buildPASS. Source does not require a StaffProfile for Owner.
