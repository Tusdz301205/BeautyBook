# STAFF mobile implementation

Assigned ownership: `mobile/src/operations/staff/**`, `mobile/tests/staff-work.test.cjs`, and this document. Auth, providers, shared primitives, account, notifications, and backend remain with their respective owners.

## Shipped interface

`StaffTabs.tsx` exports the default four-tab shell: **Hôm nay / Lịch / Thông báo / Tài khoản**. Work and notification tabs own native navigation stacks so detail back behavior stays local.

Today prioritizes every in-progress service, the next scheduled assigned service, and remaining work. Each card is a BookingService, including customer name, service, planned time, duration, textual lifecycle and arrival state. Completed siblings remain separate. START is direct; COMPLETE asks for confirmation naming the customer and service. No check-in, reassignment, booking completion, finance, contact information, or customer-profile menus are exposed.

Agenda uses the branch date and a seven-day strip with previous/next week and Today controls. ISO service timestamps are formatted in the branch timezone. Appointment date/time remains explicitly labelled appointment context, never invented item timing. Missing timezone blocks automatic Today calculation. Lists use FlatList; detail uses ScrollView. Font scaling remains enabled; work targets are at least 48dp; native headings and accessible labels are present.

## Screen / API / state mapping

| Surface | Safe API | State and authority |
| --- | --- | --- |
| Today / agenda | `GET /bookings/my-work-items?branchId&dateFrom&dateTo&page&limit` | Linked active profile, root valid STAFF scope, exact business/branch and own assignment |
| Item detail | `GET /bookings/my-work-items/:itemId` | Drops cached item on 401/403/404 |
| START / COMPLETE | `PATCH /bookings/:bookingId/items/:itemId` | Item UUID, booking UUID, expectedRevision, stable truthful reason; server eligibility plus own assignment |
| After lifecycle request | Restricted item detail, then safe current list/detail reload | Always reads even after timeout/conflict; holds retry while read remains unsuccessful |
| Booking notification | `GET /bookings/my-work-items?branchId&bookingId&page&limit` | Own items only; empty or reassigned target explains unavailability |
| Notifications / account | Root shared operations components | Shared notification paging/read/UUID-target validation; root profile/account/mode/logout behavior |

Pagination reads pages of 50 sequentially, bounded at 100 pages. It verifies page metadata, complete unique-item count against total, and rejects incomplete/changing data rather than labelling the first page a full workday. No N+1 detail requests are used for list cards.

`useStaffWork` fences reads by contextKey, selected branch/date/target, context revision, staff identity, latest request sequence and API session generation. Old context data is immediately hidden. Root owns the only socket and bumps revision for invalidation/reconnect/foreground. Failed network refresh retains same-context cached data with explicit stale feedback and disables actions; authorization loss removes data. No queued offline writes or optimistic lifecycle success.

Timers use actualStartedAt and SERVICE_ADJUSTMENT only, together with serverNow anchored at response receipt. The display interval adds elapsed time to the server anchor. Completed/stopped services use persisted end timestamps; missing/UNAVAILABLE timing stays unknown. Neither reopening nor background time restarts the timer. Timers never mutate lifecycle or scheduling.

## Contract and authorization evidence

Backend owner implemented the minimal personal endpoint; frontend does not use broad scheduler/list/customer booking responses. Source read and coordinated contract:

- `beauty-booking-api-main/src/bookings/staff-work-items.service.ts`: `scope` restricts salon workspace and live resource scopes; `profileId` requires active linked profile; `list`/`detail` restrict own assigned items; explicit `WORK_ITEM_SELECT`/`view` omit contact, finance and profile notes. `bookingId` filtering supports safe notification routing.
- `beauty-booking-api-main/src/bookings/bookings.controller.ts`: static `my-work-items` routes delegate to the personal service.
- `beauty-booking-api-main/src/bookings/booking-items.service.ts`: item action checks own assignment after row lock, revision and START check-in/COMPLETE lifecycle guards. The backend remains the final authority.
- Root `OperationsContext.tsx` requires active linked profile and valid STAFF scope for work mode. Owner permission alone does not enable the staff shell.

Allowed UI actions are limited to START of eligible own SCHEDULED item after arrival and COMPLETE of eligible own IN_PROGRESS item. Staff cannot check-in, assign, reschedule, approve requests, adjust duration/price or access finance from this subtree. Personal endpoint also supports linked owner authority in backend, but the root mobile mode guard deliberately requires the specified STAFF scope.

The projection contains no authorized booking notes or colleague handoff information, so this UI does not invent those sections. Unsupported notification impact targets show the shared safe notification content; Staff never routes to Owner screens. Push is outside this implementation.

## Skills and design decisions

Read the entire `ee890929-cc68-47a3-bb3c-c01e26a002f1/Pasted text.txt`, `mobile/AGENTS.md`, and the required project skills before edits:

- `skills/SKILL.md`: work hierarchy, concrete recovery feedback, brand tokens and scoped edits.
- `skills/mobile-app-design/SKILL.md` plus accessibility/performance references: labelled native controls, 48dp targets, preserved font scaling, virtualized workday lists and cleaned display timers.
- `skills/ux-pattern-research/SKILL.md` and the relevant awesome-ux pattern index: evaluate the personal-work question against the actual BeautyBook lifecycle. No copied interface or unsupported claim of user research.

The project taste skill was inspected and explicitly excludes multi-step product UI; no extra web/landing-page design system was applied to this native work scope. Missing optional `skills/references` files did not block the required skills. Expo 57 versioned official docs were read before edits: https://docs.expo.dev/versions/v57.0.0/. Existing React Navigation, RN and tokens are retained without dependency changes.

## Validation

- `node --test tests/staff-work.test.cjs` (mobile): 15 passing behavioral tests covering own-item eligibility, multi-service ordering, timezone rollover, actual-time continuity/unknown timing, UUID/revision mutation payload, complete pagination/stale request, double-tap, timeout reconciliation lock, conflicts, reassignment/lost scope, real hook context/revision fencing, cached offline reads, context changes while COMPLETE confirmation is open, and restricted detail/list refetch after lifecycle timeout.
- `npm run typecheck` (mobile): passed after native-stack prop and nullable-timezone fixes.
- Scoped whitespace check: `git diff --check -- mobile/src/operations/staff mobile/tests/staff-work.test.cjs docs/mobile-staff-owner/STAFF.md`.
- Android native: **NOT_RUN**. iOS native: **NOT_RUN**. Web runtime: **NOT_RUN**. Android export: **NOT_RUN** by staff owner. No emulator/Metro/restart/push or live API mutation was performed under the narrower assigned task constraints. Root owns integration/export and native QA.

Run the scoped suite from `mobile` with `node --test tests/staff-work.test.cjs`. Real-role QA still needs separate QA accounts for Staff A/B, a linked multi-role owner, missing/inactive profiles, expired branch scopes, check-in, multi-service bookings, reassignment, timeout and foreground/reconnect. Use existing API configuration; record no credentials here. Passing mocked tests and TypeScript are not native acceptance or a production-readiness claim.
