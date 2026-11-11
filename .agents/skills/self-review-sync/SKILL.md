---
name: self-review-sync
description: Implement or review Self Review App jobs, BullMQ recovery, persisted SSE, immutable snapshots, selective task refresh, and report publication. Use with self-review-ui for client reconnects and self-review-agent for paid execution accounting.
---

# Synchronization and persisted state

## Read for the task

- [Sync workflow](../../../docs/architecture/sync-workflow.md) owns execution, idempotency, retries, completeness, and SSE.
- [Architecture](../../../docs/architecture/overview.md) owns database constraints and public contracts.
- [Product](../../../docs/product/overview.md), [D05](../../../docs/decisions/D05-sync-review-and-refresh.md), and [D06](../../../docs/decisions/D06-all-period-tasks-and-batches.md) define snapshot/review meaning. Use [S02](../../../docs/stages/S02-demo-vertical-slice.md) and affected [S05](../../../docs/stages/S05-reliability-and-tests.md) checks.

## Trace the command to its durable result

1. Map the HTTP command, ownership checks, normalized payload fingerprint, JobRun, queue submission, worker claim, bounded work, and final transaction. Postgres determines the outcome; SSE only exposes persisted state.
2. Enforce idempotency and the project activity slot in the database. An exact replay returns the owned existing run; reusing a key for different scope/payload conflicts. Queue delivery must pass an atomic claim before doing external or paid work.
3. Handle the database/queue gap explicitly. Reconcile queued work under the same run ID; enqueue errors must not overwrite claimed or terminal work. Keep paid attempts/results across redelivery and restart, using the agent skill where applicable.
4. Preserve complete import independently of AI summary size. Record discovery, import, and analysis coverage separately; retain useful imported data on analysis failure. Use the documented unit deadlines and heartbeat rather than a whole-run volume cutoff.
5. Commit results and terminal state before notifying clients. Automatic review is a separate child run sharing the manual review service. Its creation must preserve the activity-slot transition and avoid waiting for a child while holding the worker slot.

For selected refresh, map public internal TaskSnapshot IDs to scoped external IDs. Fetch only selected tasks and create a new revision; copied tasks/comments retain provenance and original retrieval/read metadata. Rebuild source references for the new revision. Never mutate the base or present retained stale data as a successful new read.

Publish a validated report, its snapshot's current-report pointer, and the terminal review state in one transaction. A failed review preserves the previous report. Reviewing a historical snapshot changes only that snapshot's pointer.

For SSE, authenticate and check ownership before streaming, emit current database state on connect, deduplicate by run/version, and clean up on disconnect or JWT expiry. Coordinate client authentication/reconnect through the UI skill; reconnecting or refreshing data must never submit a new job.

## Verify failure boundaries

- Use real isolated Postgres/Redis and a worker for duplicate commands/delivery, payload conflicts, activity-slot races, enqueue gaps, and worker interruptions.
- Check selected refresh provenance, stale copies, immutable old reports, and rollback of report publication.
- Exercise stream loss around commit, API restart, JWT expiry, terminal reconnect, and another user's run. Confirm SSE and GET show the same saved outcome.
- Use multipage fixtures, including the 137-task case from S02/S05, to verify the final batch and distinguish missing coverage from expected excerpt/comment limits.
- Verify interruptions do not automatically restart paid execution. Follow root AGENTS.md checks and report the actual persisted outcome and any unverified recovery paths.
