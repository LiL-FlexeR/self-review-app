# Roadmap

Current delivery status and verification snapshot, updated 2026-11-12. Requirements are owned by the [product](docs/product/overview.md), [architecture](docs/architecture/overview.md), and linked stage briefs.

| Stage | Complete outcome | Dependencies | Status |
| --- | --- | --- | --- |
| [S01 — foundation and authentication](docs/stages/S01-foundation.md) | Compose, database schema, OTP authentication, contracts, and UI shell | — | done |
| [S02 — demo vertical slice](docs/stages/S02-demo-vertical-slice.md) | Sync → persisted tasks/SSE → automatic/manual review → selective refresh and versions | S01 | done |
| [S03 — Linear](docs/stages/S03-linear-integration.md) | Real source using a personal API key | S02 | done |
| [S04 — ClickUp and Jira](docs/stages/S04-task-source-adapters.md) | The same contract for the other two sources | S03 | planned |
| [S05 — reliability](docs/stages/S05-reliability-and-tests.md) | Ownership, limits, retries, jobs/SSE, unit and integration tests | S02–S04 | planned |
| [S06 — submission](docs/stages/S06-submission.md) | Clean startup, examples, README, and public Git repository | S05 | planned |

Statuses: planned, in_progress, done, blocked. This table is the sole source of stage statuses. Completion requires the stage's acceptance checks; tests and guardrails are added throughout implementation.

## Current verification

Latest executed checks are recorded below. Synthetic boundaries, skipped checks, and incomplete acceptance remain explicit.

| Area | Latest recorded result | Outstanding verification |
| --- | --- | --- |
| S01 foundation/authentication | Accepted by the user on 2026-11-11. Installation, auth/storage tests, build, Compose, local Mailpit OTP and desktop/two-tab flows passed. Current mobile Sidebar/Sheet keyboard and focus restoration were also checked | Logout/account switching was not repeated during the latest S02/S03 acceptance pass |
| S02/S03 automated checks — 2026-11-12 | Current source passed `npm run check`, all 85 unit tests, all 55 HTTP/storage/worker integration tests and `npm run build`. Isolated test Postgres/Redis were healthy and test migrations were applied before integration. The run includes all five new source-ID schema/SDK cases, bounded reducer evidence, exact quotations, publication rollback, 137-task coverage, idempotency, recovery and provider/ownership boundaries. The current Docker image also passed the complete workspace/native-dependency build | External boundaries in automated tests are synthetic; separate real-model/demo and live Linear observations are recorded below |
| S02 demo with real OpenAI — 2026-11-12 | The fixture journey saved 6 project tasks and 5 token-owner subject tasks with mixed assignees/states. Sync and automatic review succeeded. Actual model choices included list, details and comments; the missing-description task prompted a comment read returning no comments, while sufficient descriptions supplied other evidence. Automatic and manual regeneration produced distinct validated reports on the same snapshot. The previous report remained visible during regeneration; the current-pointer cache refresh was fixed and verified through terminal reconnect. Usage was recorded from real OpenAI, without scripted fallback or hidden reasoning in the owner trace | The live-model run supplements the existing scripted examples; it does not turn those examples into live-model artifacts |
| S03 Linear — 2026-11-12 | A live full-period sync and automatic review succeeded with 7 saved/subject tasks across completed, canceled and backlog states. JSON/Markdown agreed; all 12 evidence pairs matched saved source excerpts and the selected snapshot. A live selected refresh preserved the 52-task base as 1 fresh + 51 copied tasks with original retrieval times; the original snapshot/report remained accessible. The accessible catalog reached its final page (2 projects). An invalid synthetic key returned non-retryable PROVIDER_CREDENTIALS_INVALID at the real Linear boundary without replacing the stored key. The current integration run also passed the 21-task/two-page import with mixed/unassigned assignees, owner-only automatic/manual reviews without new tracker reads, same-identity replacement, rejected identity/scope changes, confirmed deletion/activity locking, stale copies and ownership/SSE/trace denial. Transport tests passed archive flags, GraphQL errors and limits | Account-dependent live cases remain explicit below; synthetic transport/HTTP checks do not establish those exact live account conditions |
| API/worker logging and evidence validation — 2026-11-12 | Safe request/tool/unit/batch events and persisted owner traces exposed SOURCE_NOT_EXPOSED in a live automatic review. Leaf request schemas now restrict source IDs to the exposed sources; runtime snapshot/subject/quote validation remains in place. Subsequent live Linear and demo sync/automatic-review runs succeeded with the pinned model, unchanged budgets and attempt limits. Earlier indexed reduction also completed six leaves and three reducers, correcting one QUOTE_NOT_FOUND within the permitted attempt limit. Current schema/SDK regression tests passed | Successful runs do not guarantee arbitrary future model output; source/semantic failures still fail closed |
| Local Compose/HTTP — 2026-11-12 | Current image was rebuilt and deployed; migration exited successfully and API/worker are healthy on localhost:3001. After the real-model demo check, APP_MODE=live was restored with localhost:5173 Origin preserved. Saved tasks/reports remained available after API restart | SMTP during this pass used the existing authenticated session; no new live mail delivery was tested |
| Manual browser — 2026-11-12 | Desktop and 390px mobile layouts were inspected: page overflow stayed contained in the task table, navigation and task Sheet opened/closed with keyboard focus restored. Replacement secret input was empty/masked and removed on cancel; deletion confirmation and cancel were checked. Separate sync/automatic-review outcomes, source links, partial-review acknowledgement, inaccessible-project state and JSON/Markdown downloads were checked. A second tab recovered persisted progress after the initiating tab closed | Credential submission/replacement and confirmed deletion were intentionally not executed against the saved real connection. Cross-account denial remains established by the existing integration baseline, rather than a second live browser account |

Offline coverage includes the 6-task/5-subject-task example and all 137 tasks/14 leaves; evidence/tool boundaries, attempt accounting, idempotency/concurrency, enqueue recovery, automatic/manual review, publication rollback, selected refresh/provenance, ownership, and SSE disconnect/API restart. [Executed examples](docs/examples/README.md) use synthetic data and scripted output. SDK transport tests verify configured requests and replay/usage/error handling, without establishing live-model access or output quality.

## Verification limitations

S02/S03 acceptance combines the current automated boundary checks with the recorded real-model fixture and live Linear journeys. The following account-dependent live variants were not exercised and are not represented as successful live checks:

- An identifiable archived Linear item and tasks with other/unassigned assignees were not confirmed in the live project. Archive flags and all-assignee import passed transport/HTTP checks; the mixed-assignee fixture saved all 21 tasks and reviewed only the 10 belonging to the token owner.
- The live catalog fit one page. Multi-page catalog handling passed transport and HTTP integration checks.
- Actual credential replacement and confirmed deletion were tested through HTTP with synthetic Linear responses and real persistence. The saved real connection was retained; manual checks covered masked/cleared fields, keyboard/focus, confirmation and cancel.
- A non-failing frontend chunk warning of approximately 564 kB remains.

S04–S06 require separate implementation authorization. The full target still includes all three real adapters; passing S02/S03 does not verify the unimplemented ClickUp/Jira integrations or complete the S05/S06 reliability/submission work.

## Budget

- The user explicitly removed the implementation time limit on 2026-11-12 while authorizing API/worker logging. The original 300-minute limit no longer constrains active work; no replacement cap was set.
- Recorded effort: approximately **535 active minutes**, including S03, runtime trace/logging, diagnosis, automated verification and manual demo/Linear acceptance, updated 2026-11-12.
- AI-request spending has no configured monetary ceiling; independent technical limits and actual usage accounting remain defined in [agent limits and costs](docs/architecture/agent-workflow.md#limits-and-costs).

Update the effort total and latest verification rows in place. Report working modes, unverified integrations, and unmet requirements; a reduced subset does not count as the completed full project.
