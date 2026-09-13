# Recurring creation recovery (BB-BE-003)

Creation remains a saga, not an all-occurrences transaction. Each successful
booking transaction checks and locks its CREATING plan, increments committed
progress and refreshes updatedAt. Failure rolls back that progress with the booking.

A worker runs on startup and every minute, scanning at most 100 non-deleted
CREATING plans without progress for ten minutes. For each, a serializable
transaction conditionally marks FAILED, counts actual committed bookings, records
a customer-readable explanation and enqueues a deduplicated notification.
Already created bookings retain their own status; recovery does not create more
bookings, cancel bookings, collect money or resend booking requests.

The customer appointment page displays failure details, created/requested counts
and links to individual bookings. A FAILED or CREATING plan cannot be resumed via
the pause/resume endpoint. A late creation process cannot activate or compensate
a plan after recovery takes ownership. In-process failures still compensate, but
now use database-linked bookings, including a booking whose post-commit response
failed before its id reached the saga.

## Deployment and operations

- No new schema migration is needed. Deploy API and frontend together; do not
  run old and new API versions concurrently during rollout because the old code
  does not use the plan-row fence. Drain old requests before starting the worker.
- Before deployment, inspect existing CREATING plans, their updatedAt and linked
  bookings. Old stale plans are also candidates on startup. Review unexpected
  historical cases with the operator before rollout; no data repair was run as
  part of this source change.
- Logs: RECURRING_PLAN_RECOVERED, RECURRING_PLAN_RECOVERY_FAILED and
  RECURRING_PLAN_RECOVERY_SCAN_FAILED. Delivery retries use NotificationOutbox.
- If a process crashes during in-process compensation, the plan remains FAILED
  with a pending/manual-check explanation. Recovery does not blindly retry
  cancellation after a delay, when a booking may already have been acted on.
- Tests cover query conditions, late activation, claim loss, progress fencing,
  post-commit response failure, outbox failure and timer lifecycle with mocks.
  A real PostgreSQL two-process race/kill test is still required in staging;
  mock transaction tests do not prove database isolation.
