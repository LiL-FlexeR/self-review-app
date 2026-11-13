# Synchronization, queue, and SSE

The authoritative specification for background jobs, persistence, and state delivery. Selection is defined in the [product](../product/overview.md#selection-rules); the agent and budgets are defined in [agent workflow](agent-workflow.md).

## Commands and execution

1. The API checks the access JWT issued after OTP, CSRF, connection/project ownership, dates, and idempotencyKey. Authentication failures return before business effects.
2. Create JobRun type=sync, state=queued in Postgres. Allow one unfinished sync or review per user/project, enforced by the partial unique index in the [data model](overview.md#data), rather than only a disabled button. Resolve an exact idempotent replay before treating that existing run as a conflict.
3. Add a BullMQ job with jobId=runId and only runId in its payload. The worker reads credentials from Postgres and decrypts them locally. The API returns 202.
4. The worker atomically changes queued → running; redelivery of an already running/terminal run does not start another agent. The MVP uses one worker with concurrency=1 for sync/review, without parallel researchers.
5. Code traverses all source pages and saves the manifest and every task's details in Postgres. The agent then investigates the complete set in small batches, reads necessary comments, and returns validated results. AnalysisBatch stores coverage/results for each batch and reduction node; final SyncAnalysis is stored separately.
6. Final counts, analysis/resultRef, usage, and terminal state are written to Postgres. If generateReview was requested and sync=succeeded, create a child queued review in the same database transaction. Only after commit does the UI receive state and the child reviewRunId; enqueue review after commit using the same DB/queue-gap recovery mechanism.

Persistence is handled by code, not arbitrary model decisions or an unrestricted SQL tool. Save all discovered tasks in the selected period, even when the model does not consider them achievements. Optional comments may be read for only some tasks; the UI does not promise the full discussion archive.

## Completeness and selection size

There is no upper task-count limit. Code finishes pagination using the source's explicit completion signal, deduplicates IDs, and applies the createdAt filter. Metadata/detail processing and AI do not require loading the entire project into memory or one prompt. Errors record actual coverage; unknown remaining data is not concealed.

Import/analysis/reduce unit sizes and budgets are defined only in [agent workflow](agent-workflow.md#limits-and-costs). They do not become a limit on tasks, pages, model requests, or total run duration. The UI shows import and analysis progress independently. Technical unit failures/limits preserve data and warnings; remaining tasks are not discarded as if excluded by a business rule.

## Full sync and selected tasks

One sync endpoint accepts a discriminated selection: mode=period with startDate/endDate, or mode=tasks with baseSyncRunId/taskIds. The latter inherits the base period, project, and subjectSourceUserId; arbitrary dates and external IDs cannot be supplied alongside it. Both forms default to generateReview=false.

For mode=tasks, the base must belong to the user and project and be succeeded or partial; failed/running bases are not allowed. `taskIds` are internal TaskSnapshot UUIDs, nonempty, unique, and present in that base snapshot; the worker maps them to external IDs. The worker creates a new revision: copied tasks and comments are new records under the new sync, retaining source timestamps/retrievedAt; each copied TaskSnapshot receives copiedFromSnapshotId. The base records are never reparented or modified. Selected details are fetched from the API. Only selected tasks may trigger external requests; unchanged data is read from Postgres.

Old comments on a successfully refreshed selected task are not presented as new: its new version starts with comments not read and uses only comments actually retrieved during this run. Unchanged tasks retain comments and read metadata with their original retrieval timestamps. If a selected task becomes inaccessible or leaves scope, a copy of its previous data, including old comment metadata, is retained in the new snapshot and marked stale/unverified with a reason, without automatic deletion or inclusion of new out-of-scope data. The original task in the base snapshot is unchanged. The result is partial, and automatic review is skipped.

Recompute coverage/warnings from refreshed and inherited data rather than blindly copying the old state. Intentionally copied valid data does not itself make a result partial. The agent reanalyzes the entire resulting set in batches with per-batch budgets, observes freshness, and does not claim that everything was refreshed simultaneously. Do not copy the old SyncAnalysis as if it had been recomputed. Rebuild source references for the new snapshot, including copied comments, rather than reusing old report source IDs. Terminal snapshot data is immutable; the original base and its reports do not change.

## Automatic review

This continues the user's operation but uses a separate JobRun type=review and the same ReviewService as the manual button. Input is a saved sourceSyncRunId, not free text from the previous model response. The backend sets trigger=automatic; user-started sync/review commands use trigger=manual, the database default. Trigger is server-owned and is not accepted as a public command field. The source sync is the sole relation needed for both manual and automatic review. A partial unique index on sourceSyncRunId for type=review/trigger=automatic prevents duplicate automatic review during redelivery/reconciliation, including after a terminal result. Look up the existing automatic run by that same source/type/trigger tuple; manual reviews remain repeatable under the usual idempotency and activity-slot rules.

The worker finishes sync, enqueues the child review, and releases its slot. It does not wait for the child while holding the only concurrency slot. Sync success and review success are distinct: a review error, timeout, or enqueue failure does not change succeeded sync or delete tasks. Partial/failed sync results in autoReview=skipped with a reason; a confirmed partial snapshot can be reviewed manually.

Create the child run and terminal sync state atomically: update the parent to terminal before inserting the queued child within that transaction, freeing the partial-index activity slot without a visible gap. There is no gap for a competing user sync/review on this project. Recover an enqueue gap using the existing queued child; this does not require rerunning sync or paying for the model again. Review has its own attempt journal, aggregate usage, and per-unit deadlines; total workflow duration/cost may include both jobs, and a unit limit is not presented as an overall job or workflow cap.

## States

| state | Meaning |
| --- | --- |
| queued | Accepted and waiting for a worker |
| running | An executor is active; stage listing/reading/analyzing/reducing/saving |
| succeeded | Sync: complete required import and analysis. Review: a valid report after every target unit, based on a succeeded source sync. A genuinely empty selection is valid |
| partial | Sync: usable data exists but required import, requested reads, or analysis is incomplete. Review: a valid complete review of an explicitly accepted partial source sync, with inherited warnings |
| failed | Sync: no usable scoped snapshot. Review: no valid complete report, including a failed leaf/reduce unit. No new current report is published |

Store discovered/read/saved/failed counts, batchesTotal/completed/failed, discoveryComplete/importComplete/analysisComplete flags, and warnings separately. Until pagination finishes, total is unknown rather than equal to the number discovered so far. Do not display a fabricated AI percentage during analyzing. Missing business metrics do not mean failed. If the model fails to produce valid analysis but task import is usable, sync=partial, analysis is absent, and its error is visible. Errors before usable data yield failed; task count alone does not cause rejection. Interrupted import after saving data yields partial with discoveryComplete/importComplete=false; complete import with incomplete analysis has importComplete=true and analysisComplete=false. Review without a valid ReportDraft fails; raw text is not published.

Expected limits and failures are distinct. Not requesting optional comments, reaching the documented comment cap, shortening model excerpts, omitting findings from a compact summary, or intentionally copying valid base data does not by itself make sync partial. Record known omissions through warnings/limitations and truncation metadata. A failed requested comment read, unread required task details, truncated stored source fields, stale selected-task copies, interrupted pagination, or unfinished analysis does make an otherwise usable sync partial. Missing business metrics are a content limitation, not a technical failure. An absent or invalid model response is never converted into a successful empty result.

For review runs, discoveryComplete/importComplete are inherited from the source sync; analysisComplete describes the review's own units. A confirmed partial source remains visible as partial even when all review units succeed. A review unit failure produces failed, not a newly published partial draft. Empty-source/empty-subject templates are validated and saved without a model call, under the same source-state rules.

Snapshots are labeled with runId and do not replace the previous successful snapshot. TaskSnapshot/CommentSnapshot can be persisted after each bounded operation; status finalization and analysis references are atomic. Do not hold a single long database transaction around network calls.

## Idempotency and retries

TaskSnapshot unique(syncRunId,externalId), CommentSnapshot unique(taskSnapshotId,externalId), AnalysisBatch unique(runId,phase,level,ordinal), SyncAnalysis unique(syncRunId), ReviewReport unique(reviewRunId). Persist through upsert/transactions; terminal state is immutable. A late executor cannot update an already terminal run; writes check current execution/run state.

For a command, store requestFingerprint over its type, route projectId, and canonical validated payload with defaults applied, excluding idempotencyKey itself. It includes selection/base/task IDs or the review source and allowPartial, as applicable. With unique(ownerId,type,idempotencyKey), an exact fingerprint replay returns the original run; another project or normalized payload returns 409. Reordered equivalent task-ID sets have the same canonical representation. Ownership checks still apply before returning a replay. Automatic reviews use sourceSyncRunId uniqueness for type=review/trigger=automatic rather than a client-controlled key; no automatic worker redelivery creates a second automatic review for that source.

Job-level attempts=1. Retry temporary HTTP/model failures only under the bounded workflow policy; never automatically retry the entire paid agent. Configure BullMQ stalls to fail without re-execution (maxStalledCount=0); possible technical redelivery is still protected by the database claim. Exactly-once external model execution is not promised.

Reserve ModelAttempt with batchId in Postgres before sending the request; budgets are per unit and total usage is per run. If a response is lost, usage is unknown and the attempt remains recorded. SSE reconnect, worker restart, and DB-write retries neither reset model/tool budgets nor automatically invoke the model again. A new user "Retry"/Review action creates a new run with new cost; SSE reconnection and replay of the same idempotencyKey regenerate nothing.

If queue.add fails definitively before acceptance, the API may mark only a still-queued run failed/ENQUEUE_FAILED and return a safe error. A timeout/disconnect can leave submission uncertain: keep a still-queued run with ENQUEUE_PENDING, return its accepted runId/state, and let reconciliation resolve it. If the worker has already claimed or completed the run, preserve that state and return the existing run; the enqueue-error path must never overwrite running/terminal execution. If the process dies between DB commit and enqueue, reconciliation on startup and every 30 s checks queued runs older than 30 s and adds missing jobs under the same runId. Job IDs and database uniqueness prevent duplicates; this is minimal recovery, not a distributed transactional outbox.

Running jobs update heartbeat regularly; each unit's deadline is fixed at its start and is not extended by heartbeat. Reconciliation does not interrupt a large job because of total execution time: a stuck unit/lost heartbeat yields RUN_INTERRUPTED/UNIT_TIMEOUT and partial if data is already saved. Recovery serializes with source/model writes on the run row, finalizes unfinished batches/attempts, and recomputes aggregate usage with lost responses still unknown. A late executor cannot overwrite that terminal outcome or its attempt/trace records. Agent execution is not restarted automatically after worker death. Queued jobs may wait behind a large previous job; there is no fixed ten-minute queue timeout, and waiting is visible. Returning or logging in again shows the persisted reason. Redis uses a volume, AOF, and noeviction; Redis loss must not erase tasks/reports already saved in Postgres. Verify this in a separate integration test.

## SSE

GET /api/jobs/:runId/events opens only for the owner with a valid access JWT cookie issued after OTP. Perform authentication/ownership checks before the first write so errors are not returned after streaming has begun. Never put tokens in query strings. An open stream closes no later than its access JWT expiry; updating cookies does not update the identity or expiry of an existing connection. The client verifies/renews access before reopening the stream under [frontend data flow](overview.md#frontend-data-flow). Browser logout closes its local streams. There is no server-side per-stream refresh-chain revocation lookup in the MVP: copied JWTs can retain access until expiry under [D04](../decisions/D04-auth-and-credentials.md#refresh-logout-and-csrf). The worker continues accepted work through logout or token expiry.

The client owns one reconnect path: close the failed EventSource, recover authentication if needed, and fetch GET /api/jobs/:runId before opening a new stream. A terminal run is rendered without reopening SSE; 403/404 stops reconnect and shows the safe error. For transient network/5xx failures, allow up to three automatic reconnect attempts with 1/2/4-second delays, then show a manual Reconnect action; a successful connection resets this counter. This bounds a disconnect recovery cycle, not job duration. Do not combine an independent EventSource retry loop with the fetch/recovery loop or retry a job-start command.

On connection, always send the current Postgres state. For the MVP, the API reads JobRun once per second, emits a new state when version changes, and sends a heartbeat every 15 s. Dispose the RxJS subscription/timer on disconnect. Redis Pub/Sub and a separate event store are unnecessary for state notifications.

Payload: {runId,type,state,stage,version,counts,discoveryComplete,importComplete,analysisComplete,resultRef,errorCode?,warningsCount,autoReview?,reviewRunId?}. No raw tasks, OTP, or secrets. SSE id = runId/version. Reconnection sends current state again; the client deduplicates version, while GET /api/jobs/:id remains a verification path. Full replay of every intermediate event and exactly-once delivery are not provided.

For a succeeded or partial review, `resultRef` identifies the report produced by that exact review execution, including after later regenerations. Its `sourceSyncRunId` is provenance rather than a report ID. A review without a published report has a null result reference. Sync results retain their current report pointer when available, otherwise their snapshot/run ID; `currentReviewReportId` explicitly exposes the selected snapshot's report pointer.

After a terminal sync event, the client refreshes the project page. If autoReview was requested and reviewRunId exists, subscribe to the child's SSE and show "Tasks saved; preparing review" rather than declaring the whole operation finished. Otherwise, close the stream and show the outcome/skipped reason. A terminal review event closes its stream. If the terminal event was missed, a new SSE/GET still shows the result. Closing the tab or losing the network does not cancel the job. Database persistence, not receipt of a notification, determines whether data is saved.

The frontend query/cache and authentication lifecycle is defined in [frontend data flow](overview.md#frontend-data-flow); SSE refreshes saved data through that layer rather than repeating job-start commands.

## Self-review from saved data

POST reviews accepts the public syncRunId and persists it as sourceSyncRunId; code takes subjectSourceUserId from the snapshot, where it was saved from the verified token-owner identity. The API accepts no arbitrary developerId. Check ownership and snapshot state, then select tasks by membership of the token owner in assignee IDs. Partial requires allowPartial=true and inherits warnings. The period comes from sync; there is no additional arbitrary date range.

The worker sequentially processes batches of all saved tasks/comments for the token owner, then reduces validated intermediate results in small groups into the final ReportDraft. Each request has bounded context; the overall selection is not truncated. Complete coverage requires every leaf/reduce batch, not just the first. SyncAnalysis may guide grouping but cannot be cited as primary evidence. No tracker requests are repeated; missing comments remain a limitation. In one transaction, check that the producing review is still running, save valid ReportDraft/Markdown/source references and usage, update the source sync's currentReviewReportId, and finalize the review state/version under the [state rules](#states). Only after commit send SSE; readers cannot observe a new current report paired with an unfinished or failed publishing run. Each run that publishes a valid report creates a new ReviewReport version; failure neither switches the pointer nor deletes the old report. Reviewing a historical sync updates only that snapshot's pointer, not a newer snapshot's current report.

Reopening/exporting uses ReviewReport, not the model. Updating external information requires a new sync. Historical reports keep referencing their immutable snapshots.

## Errors and observability

SSE and GET show the same state, stage, safe error code, and request/run ID. Partial data and a saved previous success are not hidden behind a generic spinner. Tool/model traces are safely persisted in JobRun; agent workflow owns their field rules.

Verify enqueue gaps, job redelivery, repeated POSTs, worker death, SSE loss before/after commit, Redis outages, and another user's runId. Official foundations: [Nest SSE](https://docs.nestjs.com/http/server-sent-events), [BullMQ idempotence](https://docs.bullmq.io/patterns/idempotent-jobs), [retries](https://docs.bullmq.io/guide/retrying-failing-jobs), [Redis persistence/noeviction](https://docs.bullmq.io/guide/going-to-production). Verify concrete versions/options through S01/S05 tests rather than treating documentation as evidence of configuration.

## Request examples

Full sync and automatic review for the token owner:

```json
{
  "selection": {
    "mode": "period",
    "startDate": "2026-10-01",
    "endDate": "2026-10-31"
  },
  "generateReview": true,
  "idempotencyKey": "11111111-1111-4111-8111-111111111111"
}
```

Selected tasks from one base snapshot, leaving review for later:

```json
{
  "selection": {
    "mode": "tasks",
    "baseSyncRunId": "22222222-2222-4222-8222-222222222222",
    "taskIds": ["33333333-3333-4333-8333-333333333333"]
  },
  "generateReview": false,
  "idempotencyKey": "44444444-4444-4444-8444-444444444444"
}
```

Review calls POST /api/projects/:id/reviews with syncRunId and a new idempotencyKey. `developerId` and subjectSourceUserId are not accepted from the client; the selected sync determines the current version, and the validated saved report records the actual subject.
