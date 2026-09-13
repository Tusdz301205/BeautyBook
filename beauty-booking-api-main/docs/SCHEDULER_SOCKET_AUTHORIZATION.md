# Scheduler WebSocket authorization (BB-BE-010)

An open connection is no longer authorized for its entire lifetime. Handshake
and subsequent checks verify the JWT signature/expiry and call JwtStrategy to
reload account state, session revocation, the token blacklist and scoped roles.

- Recheck every 15 seconds, at most 20 concurrent checks per batch.
- A successful check grants at most 30 seconds from the start of that check,
  capped by JWT and scoped-role expiry. Each booking delivery checks this lease;
  an overdue timer does not extend it.
- An auth lookup has a 5-second timeout. Failure disconnects the client without
  exposing the underlying database error, token or user details.
- Pending rechecks suppress booking event delivery. Successful renewal requests
  an HTTP resync when an event was skipped. Changed scopes replace the old rooms
  and tell the frontend to clear old scheduler data before fetching again.
- Revocation is bounded, not instant: a valid cached authorization can remain
  usable until the next check, with an absolute 30-second lease cap. Role and
  token expiry can end it earlier. A future revocation event bus may reduce this
  window further.
- The frontend also clears protected state after an auth rejection, invalidates
  old in-flight reads and re-establishes its socket when the access token changes.
  It does not continuously reconnect a rejected session.

Booking events contain only booking id, branch id, status and update timestamp.
Delivery iterates local authorized connections, once per matching socket. This
matches the current single-process/local Socket.IO adapter deployment. It is not
a cross-instance event bus; adding distributed broadcasting requires preserving
the per-receiver authorization/lease check on every destination instance.

No schema change or session mutation is introduced. Unit tests exercise expiry,
scope replacement, timeouts, late responses and timer cleanup. A local Engine.IO
transport test exercises a signed JWT handshake, event delivery and disconnection
after a stubbed revocation. Real PostgreSQL ownership/staff revocation and browser
visual checks remain separate staging verification steps.
