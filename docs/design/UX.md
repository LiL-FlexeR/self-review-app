# Interface plan

The authoritative specification for application screens, transitions, and UI states. This is a target plan, not an implemented interface. Product rules are owned by the [product specification](../product/overview.md); API/data and client authentication behavior by the [architecture](../architecture/overview.md); job states by the [sync workflow](../architecture/sync-workflow.md).

The [visual reference](DESIGN.md) supplies the appearance of these screens. Read it together with the token/CSS assets under the shared [frontend design inputs](../stages/README.md#frontend-design-inputs), which define their roles and precedence. Reference examples are translated into the application's own screens and copy.

## Transitions and application shell

Login/registration → OTP → Connections → Project catalog → Project/synchronization → Snapshot tasks → Self-review. React Router in Declarative mode supplies navigation and a protected layout; direct entry and reload follow [frontend routing](../architecture/overview.md#frontend-routing).

Use the reference's sidebar and main-content composition for Connections, Projects, and the current project context. Show the signed-in application account and logout action; label the tracker token owner separately where relevant. On narrow screens, provide accessible collapsible navigation and a single main column. Wide task tables can scroll horizontally within their region. The visual reference's reading width applies to prose/report content; adapt dense data views where needed and record the adaptation.

Compose screens from the selected shadcn/ui components and shared theme rather than separate per-screen visual systems. TanStack Query supplies saved server-data states; forms, selection, and dialogs use local React state. Loading and account isolation follow [frontend data flow](../architecture/overview.md#frontend-data-flow).

## Login and OTP

Provide email/password forms for login and registration. After the first step succeeds, show the code-entry screen with a masked email, expiration information, and a rate-limited Resend button. Full access follows successful OTP verification. Show clear validation, wrong-code, expiry, attempt-limit, and delivery-error messages without displaying secrets. Authentication rules and lifetimes remain in [D04](../decisions/D04-auth-and-credentials.md).

When Mailpit is the configured destination, show an Open email in Mailpit link to localhost:8025. With external SMTP, direct the user to their email inbox. This hint follows mail configuration rather than APP_MODE. The user reads and enters the code; no automatic filling or code in the API response is implied. After OTP, return to the last authorized internal page. Offline uses the same login flow with a clearly labeled model mode.

Successful access-token renewal keeps the user on the current screen. A definitive refresh rejection returns to password + OTP while saved runs/reports remain in the database. Infrastructure errors show a retryable state. Logout and account changes clear cached views and close local streams across tabs; detailed recovery/coordination is owned by the architecture.

## Connections

Show Linear, ClickUp, and Jira Cloud cards with the live-connection slots defined by the [product scope](../product/overview.md#scope). Forms contain a connection name and secret token input; Jira additionally requires the Atlassian account email and cloudId. Explain that cloudId identifies the Jira site, link to the official lookup instructions, and label the token as scoped. The Atlassian email can differ from the application login email. Link to official provider token-creation instructions and clear secret fields after submission.

Verify and save has validation, loading, success, and safe error states. A saved connection shows provider, name, confirmed token owner, status, and verification date. Offer credential replacement and deletion under [D04](../decisions/D04-auth-and-credentials.md#tracker-connections); explain occupied slots, identity/site restrictions, and the account-switch procedure. Deletion requires a confirmation explaining which local snapshots/reports will be lost, and is unavailable during an active job with a visible reason. Credentials are never redisplayed.

In demo/offline modes, offer Add demo source with synthetic data owned by the signed-in account. Clearly label the source and whether the model is scripted or live.

## Project catalog

List accessible resources with a source badge, connection, workspace/site, resource name, and breadcrumb. ClickUp resources are labeled Lists. Matching names from separate connections remain separate entries. Each connection supports pagination or Load more through its complete catalog.

Distinguish loading, empty results, expired credentials, and partial discovery failures. A failed connection leaves successful catalog results visible. Selecting a resource opens its local project page, which shows the confirmed tracker token owner as the future review subject.

## Project page and synchronization

The header shows source/connection, token owner, the selected period, the latest successful snapshot, and run history. Provide date inputs with an explicit UTC label, Synchronize, and the initially unchecked Create self-review after synchronization option. Explain the selection using the [product rules](../product/overview.md#selection-rules): all statuses, task creation dates, and current source data rather than a historical work log.

After submission, show queued/running state, the import/analysis/reduction stage, discovered/read/saved counts, processed/total batches where known, and warnings. During discovery the final total can be unknown; do not fabricate a complete count or AI-progress percentage. Runs and trace entries are paginated.

On stream loss, show Reconnecting; work continues and recover persisted state through GET/reconnect under the [SSE policy](../architecture/sync-workflow.md#sse). A missing/inaccessible run ends reconnect with its safe error; exhausted transient recovery offers Reconnect while the background job continues. Accepted work continues after closing the tab or logging out. On terminal sync, update the task list and show the saved outcome. When automatic review was requested, continue with Tasks saved; preparing self-review and show its separate outcome. A review failure leaves the saved sync available. Skipped auto-review has a visible reason.

Distinguish succeeded, partial, and failed using the [state rules](../architecture/sync-workflow.md#states). Show missing required coverage separately from expected excerpt/comment limits. Partial runs remain selectable with a banner; failed/partial runs do not silently replace the previous successful snapshot. Retry is an explicit new run that can make new paid requests; duplicate clicks on the same command remain protected by server idempotency.

## Snapshot tasks and selected refresh

Show the chosen snapshot, period, retrieval timestamps, and import/analysis coverage. The table contains ticket identifier/title, snapshot status, assignees, createdAt, detail availability, and an external source link. Pagination covers the saved tasks for that snapshot; use a precise label such as Tasks in this snapshot.

Task details show the description, comments actually read, source dates, freshness/truncation notices, and AI findings with quotation/source links. Distinguish comments not read, a successful empty read, capped/truncated results, and a failed read using the stored availability metadata. Data remains accessible after returning to the application.

Allow task selection and Refresh selected. The dialog shows selection count, the base snapshot/period, and the same initially unchecked automatic-review option. Refresh creates a new snapshot containing refreshed selected tasks and copies of the others. Show fresh/copied/stale and actual retrieval times. A failed refresh can leave a stale copy in the new snapshot without changing the base. Review covers the qualifying subject's tasks across the resulting snapshot; a full period sync discovers additional tasks. Detailed semantics remain in the [sync workflow](../architecture/sync-workflow.md#full-sync-and-selected-tasks).

## Self-review

Show the confirmed token-owner subject, period, and source snapshot. The Review button creates a report or regenerates the current one through the shared review process. The previous valid report stays available while generation runs and remains current if generation fails. Repeated active-run actions are disabled in the UI and checked by the server.

Review of partial data requires explicit acknowledgment of incomplete coverage; failed snapshots are unavailable for review. A report from a partial source retains its partial label and inherited warnings. A new snapshot can show the previous report with Based on the previous snapshot; a historical snapshot shows its own report. [D05](../decisions/D05-sync-review-and-refresh.md) owns versioning behavior.

Present work areas, the categories Task description, Reported result, and Measurement from a source, limitations, sources, a short explanation, and an expandable safe trace. Use cautious source-based wording under the [interpretation rules](../product/overview.md#result-interpretation). A citation opens the saved source/exact quotation and can also provide its verified external link. Surface later information, unknown timing, missing evidence, and qualifications about individual contribution or rollout.

Download Markdown/JSON from the saved report. Opening and exporting saved results do not call the model. Display actual usage separately from estimated cost; unknown/scripted usage remains visibly unknown. New generation is an explicit action. Empty evidence or no qualifying tasks produces an explanatory empty state, rather than an invented achievement.

## Shared states and accessibility

Loading, empty, validation, forbidden/not found, infrastructure error, partial coverage, and expired authentication are distinct. During renewal, keep the current page in a pending state rather than flashing the login form. Only definitive authentication failure returns to login; infrastructure failure preserves a retry path. Show safe messages and a request/run identifier where useful, without raw provider errors or keys.

Provide explicit labels, keyboard operation, visible focus, dialog focus management, readable text contrast, and aria-live for relevant status/error changes. Pair status color with text or icons. Validate small/muted reference typography before using it for essential information; adapt styling to preserve readability and record the reason. Confirm responsive navigation, usable forms, and accessible table overflow. Review composed shadcn/ui controls after applying the theme.

Render model/tracker content as escaped text with verified registry links. Keep focus predictable after explicit actions; announce background completion without an intrusive modal. The manual verification journey is in [S06](../stages/S06-submission.md); technical authentication/cache/SSE behavior stays in the architecture and sync workflow.
