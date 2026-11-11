# D05 — review after sync, selected tasks, and versions

Date: 2026-11-10. The user requested optional self-review during sync, resync of selected tasks, and a Review button to create/replace the report. The subject was explicitly clarified: the owner of the task source token.

## Confirmation status

Accepted as an architecture and product decision on 2026-11-11. Optional automatic review, a shared manual Review action, the confirmed token-owner subject, selected-task resync, and creating/replacing the current report follow the user's explicit requests. The user confirmed that automatic review is disabled by default. Immutable revisions and atomic report-pointer replacement are implementation defaults that preserve source provenance and the previous valid result. Acceptance does not mean implementation: sync/review behavior remains work in S02–S05.

## Choice

| Option | Consequence |
| --- | --- |
| Only a separate Review button | Preserves user control but requires another action to complete the workflow |
| generateReview and a shared review process | Selected: one user action or deferred generation, without duplicating AI logic |
| One monolithic sync+review output that overwrites old data | Fewer visible steps, but makes separate import/report error handling and reproducible sources harder |

Confirmed default: `generateReview=false`, matching the initially unchecked UI option for both period sync and selected-task resync. This avoids starting the additional review-generation stage unless requested; sync still performs its own paid analysis. Enabling the checkbox by default was considered for a complete report after one action, but would also start review unless the user opted out. The choice does not change the Review button or duplicate the review process.

Sync and review are two stages of one user workflow, with separate persisted JobRun/usage. After a succeeded sync, a review child is created automatically only when generateReview=true; otherwise no automatic review is created. The worker does not wait for the child while holding a slot. One ReviewService serves the child and the manual button; all tasks are processed in batches according to [D06](D06-all-period-tasks-and-batches.md), without a task count limit. Neither a new general-purpose report-writing tool nor a second research agent is needed.

JobRun uses trigger=manual by default and trigger=automatic for the automatic review. Both review paths reference their saved source through sourceSyncRunId, with no separate parent relation. A partial unique index permits at most one automatic continuation per source across all states while allowing manual regeneration. Trigger is set by backend code rather than a client-supplied field; the database rejects unsupported trigger values and automatic sync jobs. This simplification was explicitly approved on 2026-11-11.

## Subject and scope

Connection confirms the token owner's sourceUserId through the API; sync fixes that ID. Review describes this user's eligible tasks across the entire selected snapshot, including membership in ClickUp assignees[]. Do not guess identity from email or treat assignment itself as proof of contribution. An arbitrary developerId is excluded from the API.

Selected resync is a manual refresh of known IDs, not automatic incremental loading. It creates a new revision containing the base task set for the same project/period, refreshes selected tasks, and copies the others with their previous freshness; original base rows remain immutable. A full period sync discovers new tasks. Unreadable/missing IDs are not deleted based on an ambiguous 404.

## Replacing the report

For the user, the Review button creates or replaces the current report for the selected snapshot. In the database, a new ReviewReport version is stored separately; currentReviewReportId switches atomically after validation. An error does not destroy the previous result, and resync does not change its sources. The old report is not labeled current for a new snapshot. A separate complex version-comparison UI is outside the MVP.

After a partial/failed sync, automatic generation is skipped with an explanation; the user can explicitly allow a review of partial data later, under the [state rules](../architecture/sync-workflow.md#states). A review error does not roll back a successful sync. No hidden resync or whole-agent retry is performed to generate the report.

## Authoritative specifications

The [product specification](../product/overview.md#projects-and-snapshots) defines meaning and scope; the [sync workflow](../architecture/sync-workflow.md) defines the queue, states, and versions; the [agent workflow](../architecture/agent-workflow.md) defines tools, validation, and budgets; the [architecture](../architecture/overview.md) defines the API and storage.

## Consequences

The full workflow can start with one action while retaining manual control. The cost is child-job continuation, token-owner identity, provenance for a snapshot with mixed freshness, and report versions. This expands scope and does not restore a validated five-hour estimate.
