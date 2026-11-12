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

The following results were recorded before this documentation update; application checks were not rerun for it.

| Area | Latest recorded result | Outstanding verification |
| --- | --- | --- |
| S01 foundation/authentication | Accepted by the user on 2026-11-11. Installation, auth/storage tests, build, Compose, local Mailpit OTP and desktop/two-tab flows passed | Replacement Sidebar/Sheet narrow-screen interaction was not verified; earlier responsive checks do not cover it |
| S02 automated checks — 2026-11-12 | `npm run check`, 34 unit tests, 40 HTTP/storage/worker integration tests on isolated real Postgres/Redis/BullMQ, and `npm run build` passed; committed test migrations applied | External model/provider/mail boundaries are synthetic in integration tests |
| Local Compose/HTTP — 2026-11-12 | API/worker/storage/Mailpit healthy on localhost:3001; local SMTP→OTP→fixture sync→automatic review→saved result flow passed. Latest rebuilt image passed waiting startup and container SMTP failure/liveness probes; Vite proxy readiness returned 200 on localhost:5173 | HTTP checks do not verify browser appearance or interaction; external SMTP delivery remains unverified |

Offline coverage includes the 6-task/5-subject-task example and all 137 tasks/14 leaves; evidence/tool boundaries, attempt accounting, idempotency/concurrency, enqueue recovery, automatic/manual review, publication rollback, selected refresh/provenance, ownership, and SSE disconnect/API restart. [Executed examples](docs/examples/README.md) use synthetic data and scripted output. SDK transport tests verify configured requests and replay/usage/error handling, without establishing live-model access or output quality.

## Remaining S02 acceptance

- Live OpenAI smoke for the pinned model and existing limits: not run because no key was supplied; the user explicitly left this check pending.
- Manual UI checks: keyboard/focus, mobile Sheet, actual narrow-screen overflow/navigation, and two-tab auth/SSE interactions. No browser surface was available for S02 verification.
- A non-failing frontend chunk warning of approximately 555 kB remains.

S03–S06 require separate implementation authorization. The full target still includes all three real adapters; offline/demo results do not establish live tracker verification.

## Budget

- Original timebox: two calendar days and at most **300 active minutes**. The full scope has no validated estimate within it; retaining scope does not authorize silently exceeding the limit.
- Recorded effort: approximately **298 of 300 minutes**, leaving approximately **2 minutes**, updated 2026-11-12 at 13:42 UTC.
- AI-request spending has no configured monetary ceiling; independent technical limits and actual usage accounting remain defined in [agent limits and costs](docs/architecture/agent-workflow.md#limits-and-costs).

Update the effort total and latest verification rows in place. At the active-work limit, report working modes, unverified integrations, and unmet requirements; a reduced subset does not count as the completed full project.
