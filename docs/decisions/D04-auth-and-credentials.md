# D04 — email/password + OTP and credential storage

Date: 2026-11-10. Approved by the user: email + password, followed by an emailed code; Google and tracker OAuth are excluded. This is the authoritative specification for authentication, sessions, token storage, and authentication limits.

## Confirmation status

Accepted 2026-11-11: email/password + OTP, JWT access and rotating opaque refresh cookies, Postgres refresh hashes, manual tracker credentials, and one live connection per provider/user (one cloudId for Jira). Redis handles OTP/rate limits and the queue. Other security parameters below are implementation defaults. [ROADMAP](../../ROADMAP.md) owns implementation and verification status.

## Options and choice

Google OIDC, passwordless email OTP, and email/password + OTP were considered. The last option was selected by the user's explicit decision. It adds a password and email delivery but does not require Google application setup. The emailed code is an additional check of mailbox access; do not present it as a guarantee of an independent second factor.

Locally, Nodemailer sends messages over SMTP to Mailpit. The user actually opens the email and copies the code; the code is neither returned by the JSON API nor written to stdout. External SMTP can be configured through environment variables, but do not claim real business email delivery without verifying it.

## Registration and login

- Signup accepts a normalized email and password, creates a pre-auth challenge, and sends an OTP. The User in Postgres is created only after a successful OTP; until then, Redis stores a pending passwordHash rather than the raw password. Email uniqueness is checked transactionally; another pending signup does not overwrite an existing account.
- Login checks passwordHash, then creates a pending challenge. A correct password alone grants neither an access token nor a refresh token. An incorrect email/password returns a generic message; checking a nonexistent account uses a dummy hash.
- Verify checks the browser-bound pre-auth cookie, challengeId, code, TTL, and attempts. One-time consumption is atomic. Only then does a Postgres transaction create the User for signup, an AuthSession, and the initial RefreshToken. Issue the token cookies after commit; a failure issues no tokens. The pre-auth credential never becomes an access or refresh token.
- Resend changes the code, invalidates the previous one, and remains subject to the shared limits. A challenge from another browser cannot be verified, and the email cannot change after sending without a new challenge.

If SMTP rejects the message, the challenge is invalidated and the API returns a safe delivery error without granting a full session. SMTP acceptance is not presented as confirmation that the recipient received the email; the UI allows resending within the limits.

Passwords are 12–128 characters; do not truncate or log them. Hash with Argon2id through the stable argon2 package using library-recommended parameters; the library generates the salt. Verify the native dependency during the Docker build. Password reset, email changes, and recovery codes are outside the MVP, summarized as account recovery in the README and listed in the [product scope](../product/overview.md#scope).

## Limits and sessions

The selected scheme uses a signed JWT for API/SSE access and an independently generated opaque refresh token. A maintained JWT library signs and verifies tokens; do not implement JWT cryptography manually. Fix the accepted algorithm to HS256 and use JWT_SECRET, separately from AUTH_SECRET and TOKEN_ENCRYPTION_KEY. Validate signature, algorithm, expiry, issuer self-review-app, audience self-review-api, and required claims sub, sid, and amr=[pwd,otp]. sid identifies the AuthSession created after OTP. Token claims contain no passwords, tracker credentials, or mutable authorization decisions; resource ownership is always checked in application code.

An opaque Redis session without refresh was considered for a smaller implementation. An opaque access token with refresh was also considered, but would require looking up access-token state. JWT plus Postgres-backed refresh follows the user's chosen renewal flow. JWT validation does not consult Redis or an AuthSession revocation record on each protected request; this deliberately accepts the revocation window described below.

| Mechanism | Rule |
| --- | --- |
| OTP | 6 random digits, cryptographic RNG; 10-minute TTL, up to 5 attempts per challenge |
| Sending | At most once per 60 s, up to 5 sends per email and 20 per IP in 15 minutes |
| Password | Up to 10 failed attempts per email/IP in 15 minutes; limit password-hashing concurrency |
| OTP storage | HMAC of challengeId + code with AUTH_SECRET and unambiguous encoding/purpose separation from CSRF; neither plaintext nor a weak hash without a server secret |
| Pre-auth cookie | Random secret, HttpOnly, SameSite=Lax, challenge TTL; bound to the challenge and removed after verify |
| Access token | JWT lifetime up to 15 minutes, also bounded by the AuthSession's absolute expiry; no access-token value is stored in Postgres or Redis |
| Refresh token | Cryptographically random 256-bit value; only its SHA-256 hash is stored, with unique lookup and lifecycle metadata in Postgres |
| Authentication lifetime | AuthSession expires absolutely 7 days after OTP; every successor refresh token inherits that deadline |
| Cookies | Access: Path=/api; refresh: Path=/api/auth; both host-only, HttpOnly, SameSite=Lax, Secure over HTTPS; local HTTP permits Secure=false only for the configured loopback browser origin, including Docker/Vite behind that origin. Expiry matches server deadlines; clearing uses the same paths |
| Logout | Revoke the current AuthSession/refresh chain in Postgres and clear both cookies; idempotent, without creating new tokens |

Update OTP attempts and consumption atomically through Redis Lua/transactions. A short SHA hash of an OTP is not protection against offline brute force. Redis failure blocks OTP/rate-limit-dependent operations with 503 rather than bypassing checks; it does not turn JWT validation into a Redis lookup. Postgres failure during refresh/logout returns 503 rather than treating the credential as expired or reporting an uncommitted revocation as successful.

## Refresh, logout, and CSRF

POST /api/auth/refresh accepts the refresh cookie even when access is missing or expired. Hash the value and check its token row and AuthSession: both must be unexpired, the session unrevoked, and the token unconsumed. In one transaction, lock the AuthSession and consume the token conditionally, then insert exactly one successor hash and link its predecessor. Logout and replay revocation use the same session lock. Only after commit set the new access/refresh cookies; neither token value is returned in JSON.

Retain consumed hashes and successor links until the AuthSession's absolute expiry so replay can be distinguished from an unknown token. Reusing a consumed token revokes that refresh chain and returns 401, rather than creating a second branch. Expired, unknown, or revoked refresh tokens also return 401; clear authentication cookies and require password + OTP. A lost successful refresh response can therefore require a fresh login; there is no automatic retry or grace window for a spent refresh token. Expired session rows and their token history can be deleted together after the retention deadline. Entity fields and constraints are owned by the [data model](../architecture/overview.md#data).

Unsafe requests require an exact Origin allowlist. Authenticated writes, refresh, and logout also require an X-CSRF-Token value bound to the authenticated sid. Issue a nonce plus an HMAC over purpose, sid, and nonce using AUTH_SECRET and unambiguous encoding; verify with constant-time comparison. Return it through auth/me or GET /api/auth/csrf and keep it only in frontend memory. The CSRF bootstrap can resolve an active AuthSession through an unconsumed refresh cookie when access has expired; it neither consumes the refresh token nor grants API access. On refresh/logout, validate CSRF against the session found through the refresh cookie, without requiring a valid access JWT. Strict same-origin/CORS rules protect these credentialed responses. Pre-auth signup/login/verify/resend use Origin checks and the browser-bound challenge where applicable.

Logout may identify the session through a valid access JWT or refresh cookie, so access expiry does not prevent revocation. Already signed-out logout only clears cookies. Browser logout closes local streams and clears cached data. The MVP has no JWT denylist or per-request session-revocation lookup: a copied access token and an independently opened SSE stream may remain usable until that JWT expires, even after logout or refresh-chain revocation. Refresh cannot extend a revoked session. Protected requests still enforce ownership; SSE expiry and client recovery follow the [sync workflow](../architecture/sync-workflow.md#sse).

Tokens are not exposed in JavaScript, URLs, logs, or response bodies. Refresh coordination, protected-request replay, and cross-tab account isolation are defined in [frontend data flow](../architecture/overview.md#frontend-data-flow).

## Tracker connections

The confirmed connection limit is one live connection per provider per application user. Multiple connections of one type were considered for different external accounts or Jira sites; they remain outside the MVP to keep setup and account switching smaller. The fixture connection is separate from live provider slots. The [product specification](../product/overview.md#scope) owns the scope rule; database uniqueness and UI handling enforce it.

The secret is entered in a password input and sent to the backend; clear the field after submission. After checking access and obtaining the authenticated sourceUserId, store the token as authenticated ciphertext, for example AES-256-GCM with a unique nonce, key version, and connection/owner ID as associated data. Store TOKEN_ENCRYPTION_KEY outside the database and keep it separate from AUTH_SECRET.

GET connections returns ID, provider, displayName, status, and dates, without the token or a reversibly masked value. Secrets must not appear in logs, traces, model context, SSE, job payloads, public fixtures, Docker image layers, or Git. Unlike a password, the token is not hashed: the server must recover it for the external API.

Token checks and project retrieval use only fixed provider endpoints. The Jira MVP accepts a scoped token + email + cloudId, without an arbitrary URL. The application performs only read operations, even when a personal token permits writes. The accessible project is always further restricted by the selected connection/project/run.

Isolation: current user → owned connection → accessible project → owned snapshot/run/report. A matching external email alone cannot associate a token with an account, and another user's connectionId cannot be substituted. There is no global list of every system user. Replacing credentials increments credentialVersion and is permitted only for the same confirmed sourceUserId and connection scope; Linear stores the verified organization.id as sourceScopeId and requires it to match on replacement; for Jira, cloudId cannot change in place even for the same accountId. A different external account or site cannot replace the identity/scope of an existing connection or reassign its snapshots. The one-live-connection-per-provider slot is enforced in the database: while occupied, another connection for that provider is rejected. To switch accounts or Jira sites in the MVP, the user must explicitly delete the existing connection with its documented local-data consequences, then verify a new connection. Never delete or reassign data automatically to free the slot. An already-queued job checks the connection's current state before reading; a new token does not change the snapshot's subjectSourceUserId.

Deleting a connection removes only the local token copy and related data according to the [data model](../architecture/overview.md#data); it does not revoke the personal token in the external tracker. Revisit access and key management for a public SaaS product.

## Sources and consequences

Checked on 2026-11-10: [Nest auth](https://docs.nestjs.com/security/authentication), [node-argon2](https://github.com/ranisalt/node-argon2), [Nodemailer SMTP](https://nodemailer.com/smtp), [Mailpit Docker](https://mailpit.axllent.org/docs/install/docker/). Choosing a small custom two-stage flow does not remove the need to test rate limits, OTP replay, concurrent verification, session fixation, and ownership. This adds substantial scope compared with the previous MVP without login.

Authentication capabilities rechecked on 2026-11-11: [Nest authentication](https://docs.nestjs.com/security/authentication) documents JWT access/refresh-token flows and database-backed token state; [cookie handling](https://docs.nestjs.com/techniques/cookies) documents HttpOnly, Secure, SameSite, and cookie expiry. Apply the rotation/replay-detection principle in [RFC 9700](https://datatracker.ietf.org/doc/html/rfc9700#section-4.14.2) to this application's refresh chain; this does not introduce OAuth. The [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) explains session binding, HMAC tokens, and explicit header submission. Package capabilities do not replace application-specific OTP, persistence, CSRF, or ownership checks; S01 pins the JWT library and verifies the complete flow.
