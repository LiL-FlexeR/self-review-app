---
name: self-review-providers
description: Implement or review Self Review App Linear, ClickUp, Jira Cloud, or fixture adapters, including identity verification, catalog discovery, pagination, task normalization, and provider errors. Use with self-review-auth for credential handling and self-review-sync for snapshot persistence.
---

# Task-source adapters

## Read for the task

- [D02](../../../docs/decisions/D02-task-sources-and-selection.md) owns provider-specific choices and links to official API documentation.
- [Product selection](../../../docs/product/overview.md#selection-rules) owns project, UTC period, status, assignee, and volume semantics.
- [D04](../../../docs/decisions/D04-auth-and-credentials.md#tracker-connections) owns credentials and identity replacement; [architecture](../../../docs/architecture/overview.md) owns normalized storage/contracts.
- Use [S03](../../../docs/stages/S03-linear-integration.md) for Linear, [S04](../../../docs/stages/S04-task-source-adapters.md) for ClickUp/Jira, and affected [S05](../../../docs/stages/S05-reliability-and-tests.md) checks.

## Preserve source semantics behind the shared contract

1. Inspect the discovery/list/details/comments contract and fixture adapter before adding provider behavior. Keep transport/authentication server-side and normalize into the existing contract instead of leaking provider payloads into public schemas.
2. Check current official provider documentation for the exact endpoint/schema, authentication, pagination, archive capability, and error semantics being changed. Reconcile a discovered incompatibility in D02; do not broaden product scope to work around it silently.
3. Confirm the credentials' authenticated external user and store that identity separately from the application user or entered email. Enforce the connection/project scope before source reads. Use the auth skill for token encryption, replacement, and deletion.
4. Traverse discovery and task pages to their explicit end, deduplicating scoped IDs and detecting repeated cursors/no progress. Apply a broad native candidate filter followed by the exact UTC createdAt filter in code. Import every eligible status/assignee without a task-count cap.
5. Normalize rich text, multiple assignees, source timestamps, safe links, and comment availability without executing source HTML or following attachments/embedded links. Preserve capability warnings and distinguish an empty read from a failed/incomplete read.

## Apply the relevant provider rules

- **Linear:** Project is the unit. Verify viewer identity, use fixed GraphQL queries/variables, include accessible archived data per D02, and handle GraphQL errors even when HTTP status is 200.
- **ClickUp:** List is the unit; retain its workspace/space/folder breadcrumb. Include closed tasks, subtasks, and Tasks in Multiple Lists. Membership in the selected List is sufficient even if a task has a different home List; preserve all assignees.
- **Jira Cloud:** Use email + scoped token + cloudId through the fixed Atlassian gateway. Use enhanced JQL search/continuation and normalize ADF. Build browser links only from the validated origin-discovery procedure in D02; an unavailable safe origin leaves an internal citation and warning rather than a guessed URL.
- **Fixtures:** Keep synthetic data on the same adapter/workflow path and include pagination/error cases. Never fall back to fixtures after a failed live credential check.

Provider retries follow the agent workflow's bounded transport policy. Scope, schema, and credential failures must remain explicit; neither the model nor user-entered URLs choose API destinations. Use the sync skill when changes affect saved coverage or selected-refresh scope.

## Verify contract and live behavior separately

- Use synthetic transport fixtures for exact UTC boundaries, all statuses, null fields, multiple assignees, duplicate IDs, pagination beyond the first page, 429/timeout, and provider-specific error bodies.
- Check that selected refresh reads only selected external IDs and that the catalog retains successful connections when another source fails.
- Exercise identity/scope mismatch and rejected credential replacement without logging real tokens or private tickets.
- Perform the relevant stage's read-only live smoke test only with available authorized test credentials. Record which provider/account path was exercised; transport stubs do not establish live verification. Follow root AGENTS.md checks.
