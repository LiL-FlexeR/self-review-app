# S04 — ClickUp and Jira Cloud

## Goal and dependencies

Extend the same complete workflow with the two remaining sources. Depends on S03. Status: [ROADMAP](../../ROADMAP.md).

Required UI context: use every source in [Frontend design inputs](README.md#frontend-design-inputs) for ClickUp/Jira forms, catalog labels, and provider states, reusing the established theme.

## Changes and boundaries

- ClickUp: personal token, accessible workspaces/spaces/folders/lists, correct breadcrumbs, and List as the sync unit.
- Jira Cloud: email + scoped API token + cloudId, fixed API gateway; current enhanced JQL search with continuation.
- Common provider contract for discovery/list/details/comments; normalize all assignees, timestamps, and rich text without implying identical archive capabilities.
- Contract tests using fixtures/transport stubs for both adapters, plus separate live smoke tests.

Exclude OAuth, Jira Data Center, the unscoped token/site-URL option, arbitrary HTTP endpoints, or merging projects across sources. Authoritative rules: [D02](../decisions/D02-task-sources-and-selection.md), [product specification](../product/overview.md#selection-rules).

## Acceptance criteria

- The catalog combines the user's resources from three connections with explicit provider labels and pagination; one failure does not hide the others.
- ClickUp explicitly includes closed tasks/subtasks/Tasks in Multiple Lists, deduplicates IDs, and stores multiple assignees. A task included in the selected List is retained even if its home List differs. The review subject is the authenticated user ID of the token owner; filtering uses membership in the snapshot's assignees.
- Jira scoped tokens are routed through cloudId; plain-text sources are correctly extracted from ADF. Browser links use the verified origin-discovery rules in D02; an unavailable/unsupported host produces a warning and internal citation without a guessed external URL. Credential rotation cannot change cloudId in place for the same accountId.
- Code checks the exact UTC filter rather than blindly trusting the search API's timezone. Pagination runs to completion without a count cap; incomplete search is not treated as complete sync. Several API pages reach Postgres and all analysis/review batches.
- Both sources complete sync → saved tasks → automatic/manual self-review for the token owner and selected resync, without bypassing ownership or budgets. Authenticated-user methods are verified; Jira accountId is not guessed from email.
- Invalid credentials, 429, pagination, and archive limitations produce honest outcomes. The shared validator checks all claims.

## Verification

Follow the shared [verification and startup instructions](README.md#delivery-and-verification-rules), then perform the stage-specific checks below.

For each provider, use a small test project/list: add a connection, view the catalog, synchronize, wait for SSE, open saved tasks, verify the API-confirmed token owner shown as the review subject, and generate a report for that owner without an assignee selector. Include at least one test with multiple ClickUp assignees. Record which real smoke tests were completed; do not label transport stubs as real connections. No access means an explicit blocker for the specific adapter.
