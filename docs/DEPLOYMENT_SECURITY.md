# Deployment security notes

## Compose secrets

The root `docker-compose.yml` accepts environment overrides for database
credentials/URL, access and refresh JWT secrets, application mode, Redis URL,
frontend URL and CORS origins. Without overrides it retains local-demo defaults.
The API's own `.env` is not the source for Compose interpolation: use environment
variables, the root `.env`, or `docker compose --env-file <path>`.

For deployment, generate separate strong access/refresh secrets, set
`NODE_ENV=production`, configure HTTPS and explicit frontend/CORS origins, and
replace every development credential. The local defaults are not a production
configuration. Do not commit real secrets or paste expanded Compose output.
`docker compose config --quiet` validates interpolation without printing values.

For URL-reserved characters in a database password, explicitly set `DATABASE_URL`
using percent-encoded credentials. `POSTGRES_PASSWORD` remains the raw password.
Changing these variables does **not** rotate credentials in an already initialized
PostgreSQL volume; coordinate database credential rotation and API configuration.
Never delete the volume as a substitute for credential rotation.

## Web response headers and HTTPS boundary

Nginx adds nosniff, anti-framing, referrer and permissions headers on success and
error responses. A minimal CSP enforces object/base/frame/form restrictions.
The fuller script/style/font/image/connect policy is **report-only** and needs
browser validation before enforcement; it is not an enforced script-XSS policy.
Google Fonts and inline React styles are represented explicitly. Report-only
violations appear in browser developer tools; no remote report collector is set.

The supplied server listens on local HTTP. HSTS is intentionally absent and must
be configured at the HTTPS edge only after HTTPS/domain coverage is verified.
Nginx overwrites `X-Forwarded-Proto` with its own scheme; Express trusts the
configured proxy boundary. If adding an upstream TLS terminator, explicitly
configure the trusted proxy chain and scheme forwarding rather than trusting
arbitrary client-supplied forwarding headers. Otherwise refresh cookies may not
reflect the actual HTTPS connection in non-production environments.

After deploying, verify response headers, login/refresh/logout cookies, fonts,
uploaded images and Socket.IO in a browser over the intended HTTPS origin.
These file changes alone do not validate the live TLS/proxy setup.
