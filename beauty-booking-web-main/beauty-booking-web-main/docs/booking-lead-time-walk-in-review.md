# Booking lateness and counter slots — WEB-only handoff

Scope: `beauty-booking-web-main/beauty-booking-web-main`, 06/10/2026. Read the complete supplied attachment and root AGENTS.md; no nested web AGENTS.md found. No prompts.chat lookup. Existing deletions, unread-notification edits, layouts and other workstreams preserved. Backend/mobile and the root report remain with their owners.

## Verified source evidence

- Before this change, `src/pages/Salon/SalonAppointments.jsx` used `bookingsApi.availableSlots` for walk-ins; its asynchronous responses had no request fence and filter edits could retain a selected instant.
- `src/components/admin/scheduler/SchedulerView.jsx` already used scoped scheduler reads, request sequencing and `bindSchedulerSocketEvents`; the existing socket binding refreshes on connect/reconnect, resync and booking events.
- `src/components/admin/scheduler/SchedulerListView.jsx` uses GET `/bookings` with branch scope, date filters and `limit: 20`. Its previous detail dialog used a generic status menu; it now reuses the existing permission-aware `BookingDetailDrawer` and its existing server-enforced actions.
- Read-only backend inspection: `beauty-booking-api-main/src/bookings/bookings.service.ts`, `findAll`, returns row `serverNow` but its legacy service projection lacks planned instants/status. `getSchedulerData` and `findOne` supply the canonical timing contract through `withBookingTiming`; `booking-actual-timing.ts` derives actual execution from audit facts.
- Read-only backend inspection: `bookings.controller.ts`, `getCounterSlots`, authorizes operational principals and branch scope before applying a counter exception. It consumes `source`, defaulting to `STAFF_CREATED`. The web walk-in caller explicitly sends `WALK_IN`, so `allowWalkIn` applies. `getAvailableSlots` now returns `slots` and `serverNow`, including empty outcomes. Web changes do not depend on a slot-response clock or client role override.

These are code observations, not production/API acceptance evidence. The 19:00 → 21:00 policy investigation and backend authorization/concurrency acceptance belong to Root/backend.

## Implemented behavior

| Condition, using each service's planned instants | Inline operational label |
| --- | --- |
| Before start, missing server clock, missing/invalid/non-zoned start or end | No inferred warning |
| SCHEDULED without actualStartedAt, now >= start and now <= end | Đã đến giờ — chưa bắt đầu |
| SCHEDULED without actualStartedAt, now > end | Quá giờ dự kiến — cần kiểm tra |
| IN_PROGRESS with valid planned interval, now > end | Đang phục vụ quá giờ dự kiến |
| SCHEDULED with actual start evidence | No assertion that it has not started |
| Terminal parent or service: COMPLETED/CANCELLED/NO_SHOW/SKIPPED/REJECTED/EXPIRED | Suppressed, including stale SCHEDULED children |

- One-second React display ticks use `performance.now()` elapsed from the received `serverNow` anchor. Device wall time and scheduled DATE/TIME projections never become timing truth. Calendar markers also use anchored server time, converted into branch wall coordinates; unknown clocks and mixed branch timezones hide the marker.
- Calendar cards, day drawer, month summary, desktop/mobile web list rows and service detail share the same derivation. Short cards expose a warning marker plus exact text in their accessible label/title. Business status remains separate; no lifecycle mutation occurs from elapsed time.
- Service statuses are Vietnamese, planned/actual times are distinct, and missing check-in is described as “Chưa có ghi nhận check-in”, without asserting customer absence.
- Calendar adds “Chỉ lịch chưa kết thúc” and an accessible date picker, including previous dates. It reuses the existing scoped day/week/month read window; no unbounded history scan or invented lookback policy. The existing paginated list retains its date filters.
- Where the legacy list omits timing facts, only visible page rows receive authorized detail enrichment, with at most four concurrent requests and at most 20 rows. Terminal/complete projections skip enrichment; scope invalidation stops pending work and delivery. Failed detail reads leave warnings unknown.
- Foreground, focus and online events refresh existing scoped reads; sockets retain existing reconnect/resync handling. Detail reads are sequenced so stale refreshes cannot overwrite newer results/mutation responses.
- Walk-in slots use GET `/bookings/counter-slots` with normal slot arguments plus `source: 'WALK_IN'`; customer `/bookings/available-slots` stays unchanged. Selection clears immediately on filter edits; outdated success/error responses are fenced. Branch timezone determines displayed slot time and manual exception input; nonexistent/ambiguous DST input is rejected. Creation remains validated by the server, including time, scope and availability.
- Existing no-show grace/confirmation logic remains an existing affordance; its detail clock/start inputs now come from server facts. No new threshold, job, notification delivery, schema or automatic completion/no-show was introduced by the web owner. The later human-approved correction workflow is described below.

## Changed files owned by this scope

All paths below are relative to the nested web project:

```text
package.json (append new regression tests; preserve preexisting unread test)
src/api/apiClient.js (counterSlots method only; preserve unread mutation edits)
src/components/admin/scheduler/BookingDetailDrawer.jsx
src/components/admin/scheduler/ActualTimeCorrection.jsx (new)
src/components/admin/scheduler/ActualTimeCorrection.test.js (new)
src/components/admin/scheduler/ActualTimeCorrectionHistory.jsx (new)
src/components/admin/scheduler/ActualTimeCorrectionHistory.test.js (new)
src/components/admin/scheduler/BookingEventCard.jsx
src/components/admin/scheduler/DayBookingsDrawer.jsx
src/components/admin/scheduler/OperationalTiming.jsx (new)
src/components/admin/scheduler/SchedulerDayView.jsx
src/components/admin/scheduler/SchedulerListView.jsx
src/components/admin/scheduler/SchedulerMonthView.jsx
src/components/admin/scheduler/SchedulerView.jsx
src/components/admin/scheduler/SchedulerWeekView.jsx
src/hooks/useOperationalRefresh.js (new)
src/hooks/useOperationalRefresh.test.js (new)
src/pages/Salon/SalonAppointments.jsx
src/pages/Salon/SalonAppointments.test.js (new)
src/utils/bookingCalendar.adapter.js
src/utils/actualTimeCorrection.js (new)
src/utils/actualTimeCorrection.test.js (new)
src/utils/branchSlotTime.js (new)
src/utils/operationalListRows.js (new)
src/utils/operationalListRows.test.js (new)
src/utils/operationalTiming.js (new)
src/utils/operationalTiming.test.js (new)
docs/booking-lead-time-walk-in-review.md (new, this WEB-only report)
```

## Validation and limits

- `npm test`: 108/108 passing after the correction workflow additions. New cases cover exact start/end boundaries, 22:52, running overrun, terminal parents/stale children, actual start evidence, mixed services/check-in neutrality, fake monotonic clock with wrong client Date, midnight/explicit offsets, timezone/DST, bounded list enrichment/scope invalidation, foreground cleanup, counter URL/source and stale slot success/failure. Existing unread, socket, scope, actual/wall time and other unit regressions also pass.
- `node scripts/build-vite.mjs`: successful production compilation. Used the existing direct Vite build script; skipped SEO/media synchronization jobs to avoid unrelated generated-source changes.
- `git diff --check` on assigned sources: clean.
- Automated results validate logic, mocked reads and compilation. No actual API/DB writes, process/device restarts, external notification delivery, runtime UI probes or screenshots were performed by this web owner. Root owns runtime validation.
- Missing/malformed timing facts suppress inference. Legacy list enrichment costs up to 20 additional authorized detail reads per page refresh; this is bounded and avoids changing the backend contract.
- Prior-day work is accessible through an explicit selected date/filter, not an automatically loaded all-history backlog. Reminder thresholds and background delivery remain unresolved policy/backend scope. Correction storage, grants and endpoint authorization belong to the backend owner; runtime correction acceptance remains with Root. No claim of all attachment acceptance.


## Later human-approved actual-time correction workflow

- The web drawer shows “Bổ sung / hiệu chỉnh thời gian thực tế” and internal history only when the canonical operational detail item's `canCorrectActualTime === true`. The normalizer defaults this capability to false. No web role hardcode, global dotted-permission fallback, duplicated catalog or grant-management UI was added. Backend decides default Owner access, explicit scoped grants, self-correction exclusion and eligible states.
- `ActualTimeCorrection.jsx` starts with empty start/end/reason and an unchecked confirmation on every opening. It never copies planned or existing actual times into the form. Known inputs convert with the existing branch timezone helper, require start < end, reject future instants against anchored server time, and require a reason plus confirmation. Unknown explicitly clears the inputs and sends null/null, with no invented actual timestamps or client status override.
- Confirmation describes the server's completed item result, unchanged planned times, unchanged parent booking status and unchanged finance. The UI does not optimistically complete an item/parent. It re-reads detail after acknowledgement; a 409 requests a refresh, clears confirmation and never automatically resends. An acknowledged write followed by failed refresh is reported distinctly.
- Final source-backed endpoint mapping: `bookings.controller.ts#correctActualTime` uses PATCH `/bookings/:id/items/:itemId/actual-time`; `actualTimeCorrectionHistory` uses GET on the same path. `actual-time-corrections.service.ts#interval` derives KNOWN/UNKNOWN from the timestamp pair; the web sends `{expectedRevision, actualStartedAt, actualCompletedAt, reason}` only. History returns `{bookingId, itemId, data, serverNow}` with raw `actorId`, `correctedAt`, `reason`, version and old/new times/status. An earlier in-progress POST/GET `/actual-time-corrections` declaration was superseded before integration.
- The protected history view loads on explicit request, displays the supplied actor identifier (no invented name), correction timestamp in branch timezone, reason and corrected actual times. Item/scope changes, revision refresh and unmount fence old history responses. Actor/reason never come from or enter the public timing projection.
- `ACTUAL_TIME_CORRECTION` and `actualTimingStatus` KNOWN/UNKNOWN survive normalization; UNKNOWN nulls display “Chưa xác định”. The existing three operational warnings were not changed by this workflow.
- New regression sources: `src/utils/actualTimeCorrection.test.js` (6 cases), `src/components/admin/scheduler/ActualTimeCorrection.test.js` (2 rendered-form harness cases), and `src/components/admin/scheduler/ActualTimeCorrectionHistory.test.js` (2 rendered-history harness cases). All are included in `npm test`. Fake/mocked submissions exercise only in-memory test callbacks; no real correction writes were performed.
- Limits: actor names are not supplied by the verified history projection; the UI displays the actor identifier. No runtime correction/grant/history probes or UI screenshots were performed here. The web report does not claim backend migration/authorization/concurrency acceptance or all attachment acceptance.
