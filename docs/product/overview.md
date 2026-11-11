# Product

## Goal and users

Help developers assemble a traceable self-review from tracker tasks. Data collection is a persisted stage: users synchronize a project and can obtain a self-review immediately or generate it later. The report subject is the tracker user who owns the connection token, not an arbitrarily selected developer. An evaluator follows the same workflow using a synthetic source.

## Terms

| Term | Meaning |
| --- | --- |
| Application user | The authenticated User who owns connections, runs, and reports |
| Source user / review subject | The tracker identity confirmed by the token; Connection.sourceUserId is captured as JobRun.subjectSourceUserId. It is not the application user's ID or email |
| Source project | One connected Linear Project, ClickUp List, or Jira Project, represented by SourceProject |
| Run | One persisted JobRun execution, with type sync or review |
| Sync snapshot | The task/comment records saved for one sync run; there is no separate Snapshot model. Completed source data is immutable |
| Sync analysis | Validated findings about the imported snapshot; it is not the self-review and is not primary evidence |
| Review / report version | A review run produces a new ReviewReport record for one source sync snapshot. The snapshot points to its latest valid report |
| Processing unit | A bounded import operation, analysis batch, or reduction node; its size does not limit the total task set |

Identifier mappings and storage fields are defined in [architecture](../architecture/overview.md#data); technical completeness and terminal states are defined in [sync workflow](../architecture/sync-workflow.md#states).

## Main workflow

1. Sign up/log in with email + password, then an emailed OTP; full access is granted only after OTP verification.
2. Add personal API credentials for Linear, ClickUp, or Jira Cloud.
3. Browse accessible projects across the user's connections; the catalog is paginated.
4. Select a project and calendar period; optionally enable "Create self-review after synchronization" and start sync.
5. A background worker performs agent research and saves source data and validated analysis. SSE delivers persisted progress and the outcome.
6. Open the project page and tasks from a specific saved sync.
7. Use Review to create/update the token owner's report for the selected snapshot, or open the automatically generated report; verify sources and export Markdown/JSON.
8. If needed, select tasks in the list and refresh only those tasks; generate review immediately afterward or later.

## Scope

Postgres, Redis, Docker Compose, email/password + OTP, SMTP/Mailpit, personal connections to three sources, a catalog, background sync, SSE, snapshot browsing, manual refresh of selected tasks, and self-review automatically after sync or through a separate button. Each user has at most one live connection of each provider type; Jira has one cloud site per connection. Tokens can be replaced. The demo source belongs to the current user and requires no tracker account.

Non-scope: Google/OAuth, billing, teams/roles, Git integration, webhooks, schedules, automatic incremental sync using change cursors, automatic deletion of missing tasks, report editing, PDF, password reset, email changes, recovery codes, production hosting, and browser e2e. Delivery budget is tracked in the [roadmap](../../ROADMAP.md#budget).

## Selection rules

This is the authoritative source of selection rules; the model cannot change them.

| Aspect | Rule |
| --- | --- |
| Owner | The connection, project, sync, and report belong to the current verified user |
| Sync unit | One Linear Project, ClickUp List, or Jira Project; a specific connection + external ID |
| Project | Verify accessibility through the connection credentials and association with that connection; external names are not IDs |
| Period | createdAt >= startInclusive and createdAt < endExclusive |
| UI dates | Both calendar dates are inclusive; UTC; endExclusive is the start of the following day |
| Statuses | All statuses, including incomplete and canceled tasks; adapters must not leave the default closed=false |
| Developer during sync | No filter: synchronize all accessible assignees, including unassigned tasks |
| Self-review subject | The token owner's sourceUserId, confirmed by the API and captured in sync, must be in the TaskSnapshot assignee IDs. All ClickUp assignees count; no arbitrary developerId is accepted in the request |
| Authorship | Being a creator, commenter, or mentioned person does not substitute for assignment or prove contribution |
| Subtasks | Apply the same rules independently; the parent does not expand the period |
| Archive/access | Accessible regular tasks and archived tasks where the adapter supports reading them; expose source limitations and do not promise identical archive coverage |
| Links/attachments | Do not traverse them; a link alone does not include a task from another project |
| Volume | All accessible tasks in the selected project/period, with no count cap; processing units and technical budgets are defined in the [agent workflow](../architecture/agent-workflow.md#limits-and-costs) |

Calendar dates must exist and start <= end. A future period is allowed and may be empty. Tasks created before the period are excluded even if work happened during it. Tasks completed after the period remain included based on creation, but their outcomes are not attributed to the period without evidence.

The application reads current snapshots, not historical states. Project, assignee, status, and description may have changed; comments may have been added after the period. Store retrievedAt and source timestamps. Pagination across multiple API calls does not produce a transactional snapshot of the entire external tracker; detected changes generate warnings.

"All tasks" on the page means the complete accessible project set for the selected createdAt period. There is no upper count limit: pagination runs to completion and processing uses batches. This does not represent all of a developer's work or the project for all time. Technical errors, missing permissions, and unfinished analysis appear through coverage/partial, not silent selection of the first tasks. Import coverage and AI coverage are separate; a complete report requires processing every target batch, not putting all source text into one prompt.

## Projects and snapshots

The catalog shows the source, connection, workspace/site, and resource path. A ClickUp List is labeled a "list" and includes its Space/Folder breadcrumb. Identical names from different sources remain separate projects; no cross-tracker merge is performed.

Sync data and terminal state are immutable after completion; its current-review pointer may switch to a new valid version. A repeated sync creates a new snapshot without overwriting an old report's sources. By default, the page shows the latest successful sync; partial/failed runs are visible separately and do not silently replace it. Partially saved tasks remain accessible with an incomplete-coverage banner.

The tracker authenticated-user API identifies the token owner during connection verification. Connection stores sourceUserId and sourceUserName, and sync captures subjectSourceUserId. Matching the application account email is not used. Token replacement is supported for the same external user; changing accounts follows [D04](../decisions/D04-auth-and-credentials.md#tracker-connections), including the one-live-connection-per-provider limit and explicit deletion consequences. A service token describes the corresponding service account, which is visible in the UI.

Manual resync accepts selected task IDs from one base snapshot. It creates a new snapshot containing the full base task set for the same project/period: selected tasks are reread, while others are copied into new records with their original retrievedAt. The task set does not expand; full period sync discovers new tasks. If a selected task is inaccessible, a copy of its previous data is retained in the new snapshot and marked stale/unverified; the result is partial. The original base records are not modified. Preserving the task set does not imply that every task was successfully refreshed or refreshed at the same time.

Self-review uses exactly one resulting snapshot and its assignees. After resync, it describes all qualifying tasks of the token owner in that snapshot, not just the tasks selected for refresh. If no tasks qualify, code returns an empty report with an explanation rather than generating achievements.

`generateReview` defaults to false. When true, code automatically invokes the same review process as the Review button after a succeeded sync. Partial/failed sync does not launch automatic review: the reason is visible, and the user can separately confirm review of a partial snapshot through allowPartial=true. Failed snapshots cannot be used. Source tasks remain saved regardless of review success.

Review creates the first report or replaces the current report for the selected snapshot only after validating and saving a new version. Previous versions and their sources remain unchanged; failed generation does not erase the current report. A new sync does not carry the old report forward as current: it may be shown as "based on the previous snapshot," with a new current report appearing after generation. The subject, period, and source snapshot are always visible.

## Result interpretation

| Claim category | Meaning |
| --- | --- |
| task_description | Described or planned work without proof of completion |
| reported_result | A source explicitly reports an outcome; there is no independent verification |
| reported_measurement | A source contains a numerical observation, preserving its environment and qualifications |

Completed is a tracker state, not rollout. Started/canceled tasks do not become completed achievements. Assignment does not prove individual contribution. Use neutral wording such as "the ticket states" or "the comment reports." Do not invent impact, percentages, users, savings, or causality; derived metrics are not calculated in the MVP.

Every substantive claim has a sourceId and an exact quotation. Clearly identify later information, unknown outcome timing, missing data, and contradictions. A correct quotation does not establish source truth or semantic correctness; a person reviews the draft.

## Success criterion

A user completes authentication, connection setup, and sync, returns after closing the tab, sees saved tasks and limitations, creates a traceable self-review, and exports the same result. This is a target acceptance criterion, not implementation evidence. [Assignment coverage](../README.md#assignment-coverage) records the supplied brief and the additional scope agreed in chat.
