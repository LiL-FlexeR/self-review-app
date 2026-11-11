---
name: self-review-auth
description: Implement or review Self Review App authentication, OTP, refresh/logout, CSRF, ownership, and tracker credential storage. Use with self-review-ui for browser session recovery and self-review-providers for connection identity changes.
---

# Authentication and ownership

## Read for the task

- [D04](../../../docs/decisions/D04-auth-and-credentials.md) owns authentication, credential handling, and revocation semantics.
- [Architecture](../../../docs/architecture/overview.md): read Data and API for server work, and Frontend data flow for browser recovery.
- [Product](../../../docs/product/overview.md) owns connection limits and review identity. Use [S01](../../../docs/stages/S01-foundation.md) for foundation acceptance and the relevant rows of [S05](../../../docs/stages/S05-reliability-and-tests.md) for failure checks.

## Work from the trust boundary

1. Identify the operation and its required state: pre-auth challenge, verified application session, or owned tracker connection. Keep application user IDs, AuthSession IDs, and provider user IDs distinct.
2. Trace request validation, Origin/CSRF checks, storage changes, and cookie issuance. Grant access only after OTP and the session transaction commit. Redis owns OTP/rate-limit state; Postgres owns sessions and refresh-token hashes.
3. Implement the state transition atomically at its storage boundary. OTP consumption must resist concurrent verification; refresh rotation, reuse revocation, and logout must serialize on the same AuthSession. Set new cookies only after commit.
4. For browser recovery, apply the shared auth coordinator from architecture with the UI skill. Preserve user/session identity and the original command body/idempotency key through any permitted replay. Refresh itself has no automatic retry.
5. For owned resources, follow the relation from the authenticated user to connection/project/run/snapshot/report before access, including SSE, exports, and idempotent replays. For tracker credentials, verify the external identity before encrypted storage or replacement.

Keep algorithm, cookie, expiry, OTP, and encryption settings aligned with D04 rather than inventing local defaults. Use maintained libraries for password hashing and JWT handling. Preserve the documented JWT revocation window; logout must not claim immediate invalidation of every issued access token.

Return safe authentication errors that distinguish definitive rejection from unavailable infrastructure. A database or Redis outage cannot grant access, resurrect a revoked chain, or falsely report committed logout. Keep credential values out of JSON, browser storage, traces, jobs, and model input.

Credential replacement must preserve the verified external identity and connection scope. Changing accounts/sites follows the explicit deletion/new-connection flow; do not silently delete data to free a provider slot.

## Verify the affected behavior

- Cover password-without-OTP denial, challenge expiry/replay, concurrent verification, and required rate/Origin/CSRF checks.
- For session changes, use real isolated Postgres to test competing refreshes, refresh versus logout, consumed-token reuse, and absolute expiry. Verify cookie issuance follows successful commit.
- For authorization changes, exercise a second user's IDs across the affected endpoints, including SSE/export where relevant.
- For browser coordination, use client unit tests plus the manual two-tab/account-switch scenario in [S06](../../../docs/stages/S06-submission.md). Infrastructure errors must keep an explicit retry path.
- For credential changes, check response/log redaction, same-identity restrictions, and database-enforced provider slots. Follow the stage checks in root AGENTS.md and report any checks that could not run.
