# Roadmap

Revision 2026-11-11: email + password + OTP, API-token connections to three sources, Postgres, Redis, Docker, background synchronization and SSE, project tasks, manual selective resync, all tasks in the period without a count cap, and snapshot-based self-review for the token owner (automatic or button-triggered). Implementation starts on a separate request. This table is the sole source of current stage statuses.

| Stage | Complete outcome | Dependencies | Status |
| --- | --- | --- | --- |
| [S01 — foundation and authentication](docs/stages/S01-foundation.md) | Compose, database schema, OTP authentication, contracts, and UI shell | — | planned |
| [S02 — demo vertical slice](docs/stages/S02-demo-vertical-slice.md) | Login → sync agent → DB/SSE → all pages/batches → automatic/manual review → selective resync and versions | S01 | planned |
| [S03 — Linear](docs/stages/S03-linear-integration.md) | Real source using a personal API key | S02 | planned |
| [S04 — ClickUp and Jira](docs/stages/S04-task-source-adapters.md) | The same contract for the other two sources | S03 | planned |
| [S05 — reliability](docs/stages/S05-reliability-and-tests.md) | Ownership, limits, retries, jobs/SSE, unit and integration tests | S02–S04 | planned |
| [S06 — submission](docs/stages/S06-submission.md) | Clean startup, examples, README, and public Git repository | S05 | planned |

Statuses: planned, in_progress, done, blocked. Done requires meeting the acceptance criteria and recording actual verification results. Tests are added throughout implementation; S05 is not the first point at which guardrails appear.

## Budget

On 2026-11-11, the user explicitly retained the full scope, including Linear, ClickUp, and Jira Cloud. A reduced demo + Linear submission was considered and not selected. S01–S06 remain the delivery plan; S02 is an early end-to-end milestone, with all three real adapters required for the complete target.

The user also stated that the monetary budget for AI requests is not capped. The authoritative spending policy and the independent technical limits are in [agent limits and costs](docs/architecture/agent-workflow.md#limits-and-costs). This statement concerns API spending, not development effort.

The original timebox communicated in chat remains two calendar days and no more than five hours of active work; no replacement effort budget was specified. The supplied assignment PDF does not state this limit, but its chat origin does not cancel it. The full scope has no validated five-hour estimate. The previous 280 + 20 minute breakdown applied to a single source without authentication, a database, or a queue, and no longer applies. Retaining the full scope is not evidence that it fits this timebox or authorization to silently exceed it.

Record actual time per stage during implementation. If the active-work limit is reached, explicitly list working modes, unverified integrations, and unmet requirements. No reduced subset is automatically treated as the completed full project. Do not replace the real model with a scripted response without a label, or describe demo as verification of a real tracker. Application implementation still requires the user's separate request.

Scope and non-scope are defined in the [product specification](docs/product/overview.md#scope). The roadmap tracks delivery order, statuses, and budget rather than defining additional product requirements.
