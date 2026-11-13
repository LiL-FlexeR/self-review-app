# Roadmap

Current delivery status and verification snapshot, updated 2026-11-13. Requirements are owned by the [product](docs/product/overview.md), [architecture](docs/architecture/overview.md), and linked stage briefs. Documentation maintenance does not constitute a new application verification run.

| Stage | Complete outcome | Dependencies | Status |
| --- | --- | --- | --- |
| [S01 — foundation and authentication](docs/stages/S01-foundation.md) | Compose, database schema, OTP authentication, contracts, and UI shell | — | done |
| [S02 — demo vertical slice](docs/stages/S02-demo-vertical-slice.md) | Sync → persisted tasks/SSE → automatic/manual review → selective refresh and versions | S01 | done |
| [S03 — Linear](docs/stages/S03-linear-integration.md) | Real source using a personal API key | S02 | done |
| [S04 — ClickUp and Jira](docs/stages/S04-task-source-adapters.md) | The same contract for the other two sources | S03 | done |
| [S05 — reliability](docs/stages/S05-reliability-and-tests.md) | Ownership, limits, retries, jobs/SSE, unit and integration tests | S02–S04 | done |
| [S06 — submission](docs/stages/S06-submission.md) | Clean startup, examples, README, and public Git repository | S05 | done |

Statuses: planned, in_progress, done, blocked. This table is the sole source of stage statuses; completion requires the stage's acceptance checks.

## Current verification

These are the latest recorded application checks, not checks newly executed during documentation maintenance. Boundaries and outstanding verification are listed below.

| Area | Latest recorded result |
| --- | --- |
| Automated and local runtime — 2026-11-13 | `npm run check`, **186 unit tests** in 29 files, **83 integration tests** in 5 files, and production build passed on Node 24.16.0/npm 11.13.0. Integration used real isolated Postgres/Redis and all three migrations. Four setup tests cover independent secrets, byte-preserving legacy migration, idempotence and duplicate-file rejection. Dev/test migrations, Docker build with native dependency checks, and healthy API/worker startup passed after Docker/env relocation. Existing keys, four storage volumes and saved entity counts were preserved; workspace env files were gitignored and absent from the image. |
| Offline UI — 2026-11-13 | The latest full isolated journey passed password/OTP, loaded-catalog search, sync/automatic review, citations/exports, selected refresh with copied timestamps, and empty/partial/failure states. All 137 tasks across 7 pages and 19 processing/trace units were reachable. Tab close/reopen and API restart recovered persisted work without new jobs/model attempts. Two-tab renewal, logout/account isolation, retry after a Postgres outage, and controlled refresh rejection passed. Keyboard/focus and actual 1440/768/390px layouts passed; report widths were 760/465/343px without page overflow, with additional 720×500px reflow. A later connections-page reload verified the existing session and localhost:5173 → :3001 proxy after Docker/env relocation. |
| Real-model demo — 2026-11-12–13 | Synthetic 6-task/5-subject-task journeys completed sync and automatic/manual review with real OpenAI and known usage. A run exercised adaptive comment reads; the captured S06 example chose no comments and its nine evidence pairs matched the saved snapshot. Regeneration retained the prior report. Controlled refusal/expiry cases preserved tasks, skipped automatic review when required and retained the prior report. [Published examples](docs/examples/README.md) distinguish scripted offline output from the real-model capture. |
| Live Linear — 2026-11-12 | Full-period sync/automatic review saved 7 subject tasks across completed, canceled and backlog states; all 12 evidence pairs and JSON/Markdown agreed. Selected refresh preserved a separate 52-task base as 1 fresh + 51 copied tasks with original timestamps and accessible old report. Catalog discovery reached its end (2 projects); an invalid synthetic key was rejected at the real API without replacing saved credentials. |
| Live ClickUp — 2026-11-13 | Sync/automatic review and manual regeneration succeeded for 47 owner tasks (41 closed, 6 open), covering five leaves and two reducers. Selected refresh produced 1 fresh + 46 copied tasks with preserved metadata/timestamps and accessible base report. All 12 evidence pairs belonged to the new snapshot; JSON/Markdown and usage agreed. |
| Live Jira Cloud — 2026-11-13 | User-approved synthetic setup enabled an 11-task import (1 owner-assigned, 10 unassigned), automatic/manual nonempty reports and selected refresh (1 fresh + 10 copied). Old reports/timestamps were preserved, ADF became plain text, safe links used the verified origin, and all five evidence pairs and exports matched the new snapshot. Earlier all-unassigned imports correctly produced empty-subject reports. |
| Live provider boundaries — 2026-11-13 | ClickUp/Jira authenticated identities and Jira origin matched stored metadata. Read-only task pagination reached the available lists' explicit end; comment endpoints returned successful empty reads. Invalid synthetic tokens were rejected at both real APIs without changing saved credentials. Manual forms/details/export checks passed; real-connection replacement/deletion was canceled rather than submitted. |
| Clean startup, submission and hosted CI — 2026-11-13 | A separate clean clone installed from the lockfile, passed check/unit/integration/build and started Compose on new volumes after migrations. Signup/OTP, saved offline reports, close/reopen, API restart and exports passed. The public delivery commit `cb26bfe` passed [hosted CI](https://github.com/LiL-FlexeR/self-review-app/actions/runs/43427956694). Delivery-time scans found no known configured secrets in historical Git blobs, image layers/history or publishable files; checked test secrets were absent from runtime logs/exports. This CI result predates Docker/env relocation; the updated workflow has not been rerun in the recorded verification. |

Automated coverage includes real-storage auth concurrency, ownership, idempotency/activity slots, enqueue gaps, Redis-loss durability, interrupted/late workers, SSE/API recovery, immutable refresh provenance, atomic report publication/rollback, evidence/tool boundaries, comment completeness, multilevel reduction and attempt/usage accounting. The 21-task mixed-assignee and 137-task fixtures cover complete pagination and the final batch. Provider/model/mail boundaries are synthetic in integration; SDK transport tests establish request/replay/error handling, not live-model quality.

## Verification limitations

- The full isolated offline UI journey was not repeated after resource-hook extraction or Docker/env relocation; the later browser check covered the existing authenticated connections page and dev proxy. No new live provider/OpenAI acceptance is claimed after those changes. External SMTP delivery remains unverified.
- Native 200% zoom, OS reduced motion, audible screen-reader output, saved password-manager autofill and a physical mobile keyboard remain unverified, accepted as delivery limitations on 2026-11-13. No formal WCAG conformance is claimed. A failed S06 viewport override was not counted as a mobile check; the actual measured narrow-layout checks above remain the evidence.
- Shortened access/session deadlines, model refusal and outages were controlled test conditions, not production settings or observed live-model refusal. Synthetic tracker content and successful quotation/injection checks do not prove real delivery, business impact, general semantic safety or arbitrary future model correctness.
- Live Linear archive and other/unassigned-assignee cases were unavailable. Live ClickUp had one member, with no identifiable TIML/archived examples. Those flags, membership and all-assignee behavior passed transport/HTTP tests; they are not claimed as exact live account checks.
- Available live catalogs/task lists fit their API pages; ClickUp hierarchy continuation reached its end. Multi-page discovery/import, interrupted continuation, 429 and unavailable-origin cases passed synthetic boundary tests, rather than forced live variants. Models requested no live tracker comments; separate real comment reads returned empty results.
- Actual credential replacement/confirmed deletion passed HTTP tests with synthetic transports and real persistence. Saved real connections were retained; manual checks covered masking/clearing, confirmation, cancel and focus. Live credential rotation/deletion remains unverified.
- The approved synthetic Jira test issue remains in the example project. Complete dated execution/report history and individual local project deletion are not implemented. A non-failing frontend chunk warning of approximately 706 kB remains.

## Budget

- The user removed the implementation time limit on 2026-11-12; no replacement cap was set.
- Recorded effort: approximately **1245 active minutes**, covering implementation, verification, documentation and submission, updated 2026-11-13.
- AI-request spending has no configured monetary ceiling; independent technical limits and actual usage accounting are defined in [agent limits and costs](docs/architecture/agent-workflow.md#limits-and-costs).
