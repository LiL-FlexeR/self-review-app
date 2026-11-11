# S01 — infrastructure, schema, and login [Done]

## Goal and dependencies

Create the foundation and working email/password + OTP authentication before granting access to user data. No dependencies. Status and budget: [ROADMAP](../../ROADMAP.md).

Required UI context: read every source in [Frontend design inputs](README.md#frontend-design-inputs) before implementing the shell, authentication screens, or theme.

## Changes and boundaries

- Three workspace packages at the root: backend, frontend, contracts. backend contains API/worker entrypoints, Prisma, and fixtures; contracts contains only public HTTP/SSE schemas. Node/ESM/strict TS, selected package/image versions, and a shared lockfile follow [D01](../decisions/D01-stack-and-local-runtime.md).
- Compose: Postgres, Redis AOF/noeviction, Mailpit, API/worker image, and migration startup. Health checks, volumes, and loopback, without public database/Redis ports.
- Prisma schema/migrations, including AuthSession/RefreshToken, the review source-sync relation, provider-slot/activity-slot uniqueness, AnalysisBatch, and per-unit attempts/coverage, follow the [architecture](../architecture/overview.md#data); shared Zod contracts, .env.example, and scripts. Keep the selected Prisma major from D01 unless a separate compatibility review changes it.
- Authentication follows [D04](../decisions/D04-auth-and-credentials.md): signup/login, pre-auth challenge, email, verify/resend, JWT access, Postgres-backed refresh rotation, CSRF bootstrap, and logout. Pin a maintained JWT library and validate the independent signing secret at startup. Add the coordinated frontend renewal flow from [frontend data flow](../architecture/overview.md#frontend-data-flow), including same-origin lock availability in the supported local browser.
- Login/registration/OTP UI and a protected application shell using the confirmed React Router, TanStack Query, and shadcn/ui choices. Set up Tailwind, theme CSS, aliases, and components.json inside frontend according to [frontend UI](../architecture/overview.md#frontend-ui); record the pinned CLI/preset and component source origins. Nodemailer → Mailpit without an external account.

Do not implement trackers, the full sync queue, or self-review. Do not add Google/OAuth, password reset, or public deployment.

## Deliverables and acceptance criteria

- A clean Compose build applies migrations before the API/worker starts; the web app is available at localhost:3000 and Mailpit at :8025.
- The shell and login/OTP screens follow UX.md, with the shared reference theme mapped to shadcn/ui and Tailwind under [Frontend design inputs](README.md#frontend-design-inputs). Validate token values and font availability; record reference adaptations and manual UI checks.
- Direct entry and reload of available client routes load the SPA. The fallback preserves API error responses and missing-asset status codes according to [frontend routing](../architecture/overview.md#frontend-routing).
- Compose and Vite development each complete password/OTP and a CSRF-protected operation using the appropriate browser-facing APP_ORIGIN. The proxy cannot bypass or accidentally break Origin validation.
- The user registers, reads the email, enters the OTP, and receives access/refresh cookies after the database transaction commits; the password alone grants neither token. Token values are absent from JSON responses.
- Incorrect/expired/replayed codes and concurrent verification do not create duplicate AuthSessions; rate limits work, and the code is not returned by the API or written to stdout.
- JWT signature, algorithm, issuer, audience, expiry, and OTP claims are checked. Missing/expired access can recover once; refresh/logout work without an unexpired access cookie and retain Origin/CSRF protection.
- Integration tests with real Postgres verify conditional consumption, concurrent refresh, refresh-versus-logout, replay revocation, and the absolute session deadline. Infrastructure failures do not become false logout or successful revocation; used refresh hashes remain available for replay detection until cleanup is safe.
- Passwords and tokens are not logged; both authentication cookies are HttpOnly. Redis failure blocks dependent OTP/limit operations without bypassing them; JWT verification has no Redis-session dependency. Logout clears local state and prevents future refresh while the documented access-token revocation window remains explicit.
- The test database/Redis are isolated. Authentication unit/integration tests, check, and build pass; installation confirms versions, rather than documentation alone.

## Commands and manual verification

After the initial installation and lockfile creation:

```bash
npm ci
npm run infra:up
npm run db:migrate:test
npm run check
npm run test:unit
npm run test:integration
npm run build
docker compose up --build
```

Run signup → Mailpit email → OTP → protected page → access renewal → logout → login/password/OTP again. Check the old code and direct access before verify. Confirm two same-origin tabs do not race automatic refresh and do not retain the previous account's cached data. Record the tested browser/version and actual results without secret values; verify expiry automatically with a controlled test clock rather than changing the agreed default lifetimes.

## Implementation evidence

Completed on 2026-11-11 at the user's explicit request after the user confirmed that the application works and port 3000 is working. The assistant's tool-limited narrow-screen Sidebar/Sheet check remains recorded as unverified. Actual verification outcomes, current status, and measured work time are recorded in the [ROADMAP](../../ROADMAP.md#s01-implementation-and-verification--2026-11-11); theme adaptations are recorded in [D01](../decisions/D01-stack-and-local-runtime.md#s01-installation-record--2026-11-11).
