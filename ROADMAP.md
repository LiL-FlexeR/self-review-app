# Roadmap

Current delivery status and verification snapshot, updated 2026-11-12. Requirements are owned by the [product](docs/product/overview.md), [architecture](docs/architecture/overview.md), and linked stage briefs.

| Stage | Complete outcome | Dependencies | Status |
| --- | --- | --- | --- |
| [S01 — foundation and authentication](docs/stages/S01-foundation.md) | Compose, database schema, OTP authentication, contracts, and UI shell | — | done |
| [S02 — demo vertical slice](docs/stages/S02-demo-vertical-slice.md) | Sync → persisted tasks/SSE → automatic/manual review → selective refresh and versions | S01 | in_progress |
| [S03 — Linear](docs/stages/S03-linear-integration.md) | Real source using a personal API key | S02 | planned |
| [S04 — ClickUp and Jira](docs/stages/S04-task-source-adapters.md) | The same contract for the other two sources | S03 | planned |
| [S05 — reliability](docs/stages/S05-reliability-and-tests.md) | Ownership, limits, retries, jobs/SSE, unit and integration tests | S02–S04 | planned |
| [S06 — submission](docs/stages/S06-submission.md) | Clean startup, examples, README, and public Git repository | S05 | planned |

Statuses: planned, in_progress, done, blocked. This table is the sole source of stage statuses. Completion requires the stage's acceptance checks; tests and guardrails are added throughout implementation.

## Current verification

Latest executed checks are recorded below. Synthetic boundaries, skipped checks, and incomplete acceptance remain explicit.

| Area | Latest recorded result | Outstanding verification |
| --- | --- | --- |
| S01 foundation/authentication | Accepted by the user on 2026-11-11. Installation, auth/storage tests, build, Compose, local Mailpit OTP and desktop/two-tab flows passed | Replacement Sidebar/Sheet narrow-screen interaction was not verified; earlier responsive checks do not cover it |
| S02 automated checks — 2026-11-12 | After the evidence-correction and logging changes, `npm run check`, 49 unit tests, and 41 HTTP/storage/worker integration tests passed on isolated real Postgres/Redis/BullMQ. Existing test migrations had no pending changes. Full workspace/Docker build and waiting API/worker startup passed for this code; executed example artifacts were retained | External model/provider/mail boundaries in automated tests are synthetic; the live-model journey and manual UI acceptance remain separate |
| Local Compose/HTTP — 2026-11-12 | API/worker/storage/Mailpit healthy on localhost:3001; earlier local SMTP→OTP→fixture sync→automatic review→saved result flow, SMTP failure/liveness probes, and Vite proxy readiness passed. After logging changes, the rebuilt API/worker were applied and Compose waiting startup reported both healthy | The complete workflow and failure probes were not repeated on the logging build. HTTP checks do not verify browser appearance or interaction; external SMTP delivery remains unverified |
| API/worker logging — 2026-11-12 | Winston JSON output, async request/run/batch context, structured errors and schema constraints, bounded claim/evidence/source diagnostics, and credential redaction are implemented. Unit coverage verifies serialization, concurrent context isolation, detailed rejection reasons, bounds, and redaction; HTTP integration confirms matching generated request IDs in logs, headers, and public errors. Updated API and worker passed waiting startup | Additional standalone runtime smoke commands were blocked by permission rejection; successful live-model and manual UI acceptance remain unconfirmed |
| Evidence correction — 2026-11-12 | Sources exclude empty/whitespace excerpts, including byte-bound results. Evidence failures retain a typed reason/reference for the existing single correction; schema failures include bounded field paths/constraints. Regression cases for empty/bounded sources and concrete correction passed, as did the full integration suite. Strict quotes, public failure codes, attempt/output limits, and task persistence are retained. The Docker image built successfully and updated API/worker passed waiting startup | The user's repeated live sync + review still needs acceptance confirmation |

Offline coverage includes the 6-task/5-subject-task example and all 137 tasks/14 leaves; evidence/tool boundaries, attempt accounting, idempotency/concurrency, enqueue recovery, automatic/manual review, publication rollback, selected refresh/provenance, ownership, and SSE disconnect/API restart. [Executed examples](docs/examples/README.md) use synthetic data and scripted output. SDK transport tests verify configured requests and replay/usage/error handling, without establishing live-model access or output quality.

## Remaining S02 acceptance

- Successful live OpenAI journey for the pinned model and existing limits remains pending. The user's supplied traces show live responses and list/details tool calls, followed by repeated validation failures; complete sync/review, useful comment choices, and accepted outputs still need verification. Server configuration has APP_MODE=demo and an API key present.
- Manual UI checks: keyboard/focus, mobile Sheet, actual narrow-screen overflow/navigation, and two-tab auth/SSE interactions. No browser surface was available for S02 verification.
- A non-failing frontend chunk warning of approximately 555 kB remains.

S03–S06 require separate implementation authorization. The full target still includes all three real adapters; offline/demo results do not establish live tracker verification.

## Budget

- The user explicitly removed the implementation time limit on 2026-11-12 while authorizing API/worker logging. The original 300-minute limit no longer constrains active work; no replacement cap was set.
- Recorded effort: approximately **352 active minutes**, including logging, the empty-source/correction change, and the complete automated test rerun, updated 2026-11-12.
- AI-request spending has no configured monetary ceiling; independent technical limits and actual usage accounting remain defined in [agent limits and costs](docs/architecture/agent-workflow.md#limits-and-costs).

Update the effort total and latest verification rows in place. Report working modes, unverified integrations, and unmet requirements; a reduced subset does not count as the completed full project.
