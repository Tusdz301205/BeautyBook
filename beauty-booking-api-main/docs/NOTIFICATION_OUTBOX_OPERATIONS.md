# Notification outbox: retries and exhausted delivery

`FAILED` with `attempts >= 10` is the terminal dead-letter state. This uses the
existing schema and does not require a new enum or a migration. The payload and
last error remain available for an authorized operator to investigate.

The worker logs `NOTIFICATION_OUTBOX_DEAD_LETTER` when the final attempt fails.
Every five minutes it reports a `NOTIFICATION_OUTBOX_DEAD_LETTER_BACKLOG` count
and up to ten row IDs, including exhausted rows left by older deployments.
These log messages exclude recipients, message content and raw database errors.
No external alert transport is configured; the deployment must connect its log
collector/alerting to these markers if active operator alerts are required.

Read-only inspection (run only against the intended database):

```sql
SELECT id, status, attempts, available_at, updated_at, notification_id
FROM notification_outbox
WHERE status = 'FAILED' AND attempts >= 10
ORDER BY updated_at, id;
```

Investigate the retained `last_error` with restricted access; it may contain
sensitive database context. Fix the underlying issue before considering replay.
Do not blindly reset all attempts or delete these rows: a delivery decision must
account for any existing `notification_id` and the original deduplication key.
No bulk replay or destructive cleanup is performed by the worker.

Stale `PROCESSING` claims are recovered after five minutes. Attempt numbers act
as fencing tokens so an older worker cannot overwrite a newer claim. A healthy
tenth attempt can succeed; only a failed/exhausted attempt becomes terminal.
