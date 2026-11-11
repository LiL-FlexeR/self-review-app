# S05 — reliability and required verification

## Goal and dependencies

Verify the complete workflow and safe failure behavior. Depends on S02–S04. Status: [ROADMAP](../../ROADMAP.md). Core rules are implemented earlier; this stage expands and verifies them.

Required UI context: read every source in [Frontend design inputs](README.md#frontend-design-inputs) before frontend fixes or interaction/visual verification, especially partial/error and authentication-recovery states.

## Boundaries and changes

Close gaps in authentication/ownership, queue lifecycle, SSE reconnect, budgets, retries, and exact-source validation. Unit tests use Vitest; integration tests use Supertest, real isolated Postgres/Redis and a worker, and controlled provider/model/mail adapters. Do not replace orchestration with a prepared response. Exclude browser automation, a large evaluation framework, or an LLM judge.

## Verification matrix

| Area | Required outcome |
| --- | --- |
| Password + OTP | A password does not grant access before OTP; expiry, replay, concurrent verification, resend, rate limits, logout, and CSRF are tested |
| Access + refresh | JWT claims/signature/expiry and safe cookie attributes are checked; missing/expired access recovers once, refresh hashes rotate transactionally, reused tokens revoke the chain, logout races cannot resurrect it, absolute expiry does not slide, and infrastructure errors do not falsely end authentication |
| Frontend authentication | Auth recovery is coordinated across requests/tabs; queued requests verify the same user/session before replay, job-start replays keep the same body/idempotencyKey, refresh itself is not automatically retried, and account changes clear caches/streams. Unit tests cover client coordination; S06 verifies the real browser behavior |
| Ownership | User B cannot read/change user A's connection/project/task/run/report, including SSE and export |
| Credentials | The token is encrypted in the database and not exposed by GET/trace/jobs/LLM; an invalid token or Redis failure does not bypass authentication. Another external identity cannot replace it or silently occupy a second provider slot |
| Selection | createdAt UTC boundaries, all statuses/assignees, token-owner subset; 21 and 137 tasks traverse every page without a cap/duplicates, with archive capability warnings |
| Sources | Another snapshot, invented sourceId/quote, metadata-only measurements, and reducer evidence absent from its validated children are rejected; review evidence belongs to sourceSyncRunId |
| Injection | An untrusted instruction does not expand scope or invoke an arbitrary URL/tool; a real demo is also checked manually |
| Costs | Budgets bound each unit; attempts include retry/repair; total usage sums all batches/levels without double-counting aggregates, attempt numbers remain unique across the run, unknown does not become zero, and whole-agent retry is not enabled |
| Job lifecycle | Duplicate POST/job delivery does not start a second agent; project/payload fingerprint mismatches return conflict; the database activity slot permits exactly one automatic child without blocking it behind its parent. Enqueue gaps, uncertain submissions, and worker interruptions receive a persisted outcome without overwriting claimed/terminal work |
| SSE | JWT/ownership checks before streaming, current database state on reconnect, terminal event after commit, cleanup and closure by the connection's JWT expiry; client renewal/reconnect does not restart work. Reconnect follows the bounded policy, 403/404 stops retries, and terminal state avoids reopening. Logout closes local streams without claiming immediate server revocation of copied JWTs |
| Data | Selected resync refreshes only selected external IDs and preserves provenance for copied records; stale flags apply to new copies, and old snapshots/reports remain unchanged. Report/pointer/terminal-state publication is one transaction; rollback exposes no new current version. A historical review does not change the new snapshot's pointer |
| Provider failure | HTTP/GraphQL errors, timeout/429/5xx receive bounded retries; 401/403/schema errors are not retried |
| AI output | Every batch/level passes validation; source IDs/quotes retain provenance; the last batch is not skipped. Refusal/incomplete/invalid outputs are not published or turned into empty successes |
| Completeness | Persisted comment-read metadata distinguishes not read, a successful empty read, capped results, and failure, including after copying. Optional unread comments, expected comment caps, and model excerpts produce limitations without false partial status; required read/analysis failures produce partial sync. A confirmed partial source yields a labeled valid partial review, while any review-unit failure preserves the old current report |
| Identifier contracts | HTTP taskIds use internal snapshot UUIDs; tool issueIds use scoped provider external IDs, including cases where identifier differs. Public review syncRunId maps to persisted sourceSyncRunId; an input sourceSyncRunId is rejected. SSE version is not a report version |

Key authoritative references: [D04](../decisions/D04-auth-and-credentials.md), [sync workflow](../architecture/sync-workflow.md), [agent workflow](../architecture/agent-workflow.md).

## Minimum end-to-end integration

Through HTTP: signup/password → email OTP → verify/session → fixture connection/project → POST sync/202 → worker list/details/comments → snapshots/analysis commit → terminal SSE and GET → task list → token owner's review → valid ReportDraft/Markdown. Check source quotations, at least two useful tools, call IDs, and the absence of out-of-scope requests. Negative HTTP case: another owner or an invalid source. A separate 137-task fixture confirms a complete manifest, multiple analysis/review batches, reduction, and sources from the last batch; model context remains bounded. Test a middle-batch error: import is saved, analysisComplete=false, and no new current review is published. A job making normal progress beyond the previous overall deadline is not interrupted; a stalled unit terminates explicitly.

Tests do not require tracker accounts/OpenAI. Assess live output using example invariants and human review rather than a golden string. Recovery/isolation require real database/Redis instances; fake timers are suitable for TTL/retry unit tests but do not replace concurrency integration tests.

## Acceptance criteria and commands

Every matrix row has automated boundary verification or an explicitly identified manual semantic check. Saved results agree with the API/SSE, the trace is safe, and commands do not use user data.

```bash
npm run infra:up
npm run db:migrate:test
npm run check
npm run test:unit
npm run test:integration
npm run build
```

Manual scenario: demo with injection, close/reopen the page during a job, invalid token, expired OTP/session, and partial analysis. Check the UI and stdout for leaks. Record completed checks and actual limitations without claiming formal semantic safety of the model.
