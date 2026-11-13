# S03 — real Linear integration

## Goal and dependencies

Connect the first real source through a personal API key in the UI and complete the same journey. Depends on S02. Status: [ROADMAP](../../ROADMAP.md).

Required UI context: use every source in [Frontend design inputs](README.md#frontend-design-inputs) when implementing or verifying the Linear connection, catalog, and provider-error states.

## Changes and boundaries

- LinearProvider with fixed GraphQL requests, variables, and Zod response validation; confirm the query against the current schema.
- Connection form, token and owner viewer.id verification, encrypted credentials, and safe metadata following [D04](../decisions/D04-auth-and-credentials.md).
- Paginated catalog of all accessible projects, with code-enforced connection/project scope replacing the old global ID allowlist.
- createdAt/all-status selection without a developer filter, accessible archived data, nullable fields, complete pagination without a task limit, continuation, and GraphQL errors with HTTP 200 following [D02](../decisions/D02-task-sources-and-selection.md).
- Normalize descriptions/comments/assignees/URLs into common immutable snapshots.

Exclude OAuth, mutations, webhooks, a custom SDK/codegen framework, and copying private tickets into fixtures.

## Acceptance criteria

- Only the authenticated owner creates, views, replaces, and deletes a connection; GET/SSE/trace do not return the token.
- Users can browse accessible projects through the end of pagination. The current user cannot retrieve another user's Connection/JobRun by ID.
- Sync on a test project reads tasks with different assignees and statuses, saves snapshots/analysis, and reports the outcome correctly.
- Review describes the token owner's viewer.id saved in sync, without selecting/substituting a developerId. Automatic and manual modes use the snapshot without new Linear requests; selected resync rereads only selected external IDs.
- Expired/invalid keys, an empty selection, and a response/field/unit budget failure are distinguishable; no error silently enables offline mode. Task count alone is never a rejection reason.
- Fixtures and offline continue to work without a Linear key; transport stubs verify filters and GraphQL error handling.

## Commands and manual smoke test

Follow the shared [verification and startup instructions](README.md#delivery-and-verification-rules), then perform the stage-specific checks below.

APP_MODE=live: complete password+OTP, add a test Read key, select a project and a creation period containing 2–3 tasks with different statuses/assignees, wait for SSE, and check the database-backed page and self-review. Separately test an invalid key and another user's ID. Do not commit secrets/corporate content; record an anonymized real smoke-test result. Without an accessible account, the integration remains unverified; demo does not replace it.
