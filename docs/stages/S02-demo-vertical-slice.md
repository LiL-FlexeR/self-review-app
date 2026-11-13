# S02 — end-to-end demo

## Goal and dependencies

Complete the full journey: login → demo project → background synchronization → saved tasks → self-review. Depends on S01. Status: [ROADMAP](../../ROADMAP.md).

Required UI context: read every source in [Frontend design inputs](README.md#frontend-design-inputs) and reuse the theme established in S01.

## Changes and boundaries

- Fixture connection for the current user, catalog, and project following [UX.md](../design/UX.md); no shared unprotected snapshots.
- POST sync/review, JobRun, BullMQ worker, database claim, idempotencyKey, and SSE following the [sync workflow](../architecture/sync-workflow.md).
- Complete paginated import of all tasks without a count cap, followed by sync-agent list/details/comments in batches, persisted AnalysisBatch and final SyncAnalysis, and safe trace/usage following the [agent workflow](../architecture/agent-workflow.md).
- Task page, fixture token owner's sourceUserId, auto-review through generateReview, and a manual Review button with one ReviewService; safely replace the current report through new versions. Selected resync refreshes selected tasks and creates a new snapshot containing the base task set with freshness metadata; completeness follows the sync state rules.
- OpenAIClient for demo; ScriptedModelClient for offline runs through the same dispatcher, database, and renderer. No hidden fallback.
- Include owner checks, deadlines, scope, budgets, and exact-source validation immediately; S05 does not introduce them from scratch.

Exclude real trackers, a complex editor, and additional architectural layers.

## Acceptance criteria

- Connections, catalog, project progress, snapshot tasks, and self-review follow [UX.md](../design/UX.md) and the common design verification rules. All core states use the S01 theme.
- Real OpenAI calls at least two useful tools. Synthetic cases demonstrate a comment read when evidence is missing and a description that supplies sufficient evidence; record actual choices and resulting evidence without asserting a single exact model transcript.
- Every AI request uses the [confirmed model configuration](../decisions/D03-bounded-agent.md#model-and-api). Multi-step stateless history preserves replayable output items and call IDs; encrypted reasoning stays out of logs/API/SSE. Verify usable structured output under the existing reasoning-inclusive output limit, and explicitly handle incomplete output without increasing budgets or switching models automatically.
- The example saves 6 project tasks with different assignees; Anna owns the fixture token, and her self-review uses 5 tasks. `generateReview=false` creates no review job; true creates exactly one automatic review after a succeeded sync, with trigger=automatic and sourceSyncRunId pointing to that sync. Redelivery cannot create another automatic review, even after the first is terminal; manual regeneration uses trigger=manual and remains available. Partial skips auto-review with a reason. The model does not choose which source tasks to save.
- A 137-task fixture across several pages saves all 137, analyzes every batch, and includes the last batch in review reduction; the 21st task is not rejected.
- JSON passes validation, source IDs are bound to the snapshot, and Markdown is generated from the same result. Started/canceled tasks do not become achievements.
- Closing SSE/the tab does not cancel work. Reopening and restarting the API shows saved tasks; the terminal state agrees with the database.
- A direct project URL loads owned metadata from the API. Idempotent replays compare the normalized project/payload fingerprint; changing project or body with the same key cannot return a different scope's run. Report insertion, current-pointer replacement, and terminal review state commit together; a failed transaction preserves the old report and publication state.
- Repeating POST with the same key does not run a second agent; partial and empty results are represented honestly. Manual Review replaces the pointer only after successful validation; a failure preserves the previous report. Selected resync makes external requests only for selected tasks; the others are copied with their original retrievedAt. Failed refreshes mark new copies stale without changing the base. Expected comment/excerpt limits alone do not block auto-review; a confirmed partial source produces a labeled partial review only after all review units validate.
- Offline follows the same authentication/queue/storage path without external keys and is explicitly labeled; usage is not fabricated.

## Automated and manual verification

HTTP integration: signup/password → OTP from the test mail transport/Mailpit → session → fixture project → sync job → terminal SSE/GET → snapshots → review → validated JSON/Markdown. The worker and Postgres/Redis are real; only the model/external tracker are scripted. Do not replace the entire service with a prepared report.

Follow the shared [verification and startup instructions](README.md#delivery-and-verification-rules), then perform the stage-specific checks below.

Run the full journey from the [example](../architecture/agent-workflow.md#example-run) offline, then repeat with APP_MODE=demo + OPENAI_API_KEY and the live model. Confirm access to the selected snapshot; if unavailable, record the blocker rather than presenting a scripted result as a live smoke test. Save a synthetic JSON/Markdown example and a safe trace.
