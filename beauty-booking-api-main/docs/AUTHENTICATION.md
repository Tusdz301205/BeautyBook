# Authentication transport and CSRF boundary

This describes the current API implementation; it is not a claim of complete CSRF protection.

## Access-token authorization (BB-AUTH-003)

Protected HTTP routes use `Authorization: Bearer <accessToken>`. `src/auth/jwt.strategy.ts` extracts JWTs only from that header; it does not authenticate protected routes from the refresh cookie. The strategy validates expiry, revocation, the persistent session, the active user and current workspace assignments. Global guards in `src/app.module.ts` retain JWT, roles, scope and policy enforcement; routes explicitly marked `@Public()` bypass the JWT requirement. Logout is protected and revokes the current session before clearing the refresh cookie.

The access token is returned in the login/register/refresh JSON response. The refresh token is omitted from those response bodies and set as `bb_refresh` by `src/auth/auth.controller.ts`. This is a mixed Bearer-plus-refresh-cookie design, not cookie-only authentication. Browser storage policy for access tokens is a separate frontend concern; moving the access token into an automatically attached cookie would require re-evaluating CSRF defenses for every state-changing route.

## Refresh-cookie transport (BB-AUTH-004)

The refresh cookie is `HttpOnly`, `SameSite=Lax`, host-only (no `Domain` attribute), scoped to `/api/v1/auth`, with a 30-day browser lifetime. `Secure` is enabled in production **or** whenever Express reports `request.secure`. Local HTTP development remains supported. Login, registration, refresh and logout use the same transport policy; logout omits lifetime options when clearing the cookie.

Express derives the HTTPS signal using its configured proxy trust. `src/main.ts` sets `trust proxy` from `TRUST_PROXY_HOPS` (default 1, validated from 0 through 5). The cookie code does not read `X-Forwarded-Proto` directly. Deployments must set the hop count for their actual topology and prevent clients from bypassing the trusted proxy; the proxy must control forwarded protocol headers. This change does not modify that existing deployment trust boundary.

`POST /api/v1/auth/refresh` is public to the access-token guard but requires a valid refresh token, supplied by the explicit body field or the cookie. `AuthService.refresh` checks the refresh JWT and persistent session, and rotates tokens for session-backed refreshes. Malformed cookie encoding is rejected as an authentication error.

## Remaining CSRF considerations

Browsers do not automatically construct the Bearer header for an attacker's cross-origin form, so cookie possession alone does not authorize protected business mutations. However, cookie-backed refresh and authentication/session establishment still require their own threat analysis. `SameSite=Lax` reduces some cross-site cookie requests but is not a same-origin policy and does not cover every same-site attacker scenario. The credentialed CORS allowlist in `src/main.ts` controls browser response access; it is not a general request-forgery defense.

No dedicated CSRF-token, Origin/Referer-validation, or Fetch-Metadata enforcement is introduced by this cookie fix. Review those controls against supported frontend origins, proxy topology and non-browser clients before claiming full CSRF compliance. This document does not authorize weakening existing JWT, RBAC, workspace, scope or policy checks.
