# Roadmap

Revision 2026-11-11: email + password + OTP, API-token connections to three sources, Postgres, Redis, Docker, background synchronization and SSE, project tasks, manual selective resync, all tasks in the period without a count cap, and snapshot-based self-review for the token owner (automatic or button-triggered). S01 and S02 implementation were authorized on 2026-11-11. This table is the sole source of current stage statuses.

| Stage | Complete outcome | Dependencies | Status |
| --- | --- | --- | --- |
| [S01 — foundation and authentication](docs/stages/S01-foundation.md) | Compose, database schema, OTP authentication, contracts, and UI shell | — | done |
| [S02 — demo vertical slice](docs/stages/S02-demo-vertical-slice.md) | Login → sync agent → DB/SSE → all pages/batches → automatic/manual review → selective resync and versions | S01 | in_progress |
| [S03 — Linear](docs/stages/S03-linear-integration.md) | Real source using a personal API key | S02 | planned |
| [S04 — ClickUp and Jira](docs/stages/S04-task-source-adapters.md) | The same contract for the other two sources | S03 | planned |
| [S05 — reliability](docs/stages/S05-reliability-and-tests.md) | Ownership, limits, retries, jobs/SSE, unit and integration tests | S02–S04 | planned |
| [S06 — submission](docs/stages/S06-submission.md) | Clean startup, examples, README, and public Git repository | S05 | planned |

Statuses: planned, in_progress, done, blocked. Done requires meeting the acceptance criteria and recording actual verification results. Tests are added throughout implementation; S05 is not the first point at which guardrails appear.

## Budget

On 2026-11-11, the user explicitly retained the full scope, including Linear, ClickUp, and Jira Cloud. A reduced demo + Linear submission was considered and not selected. S01–S06 remain the delivery plan; S02 is an early end-to-end milestone, with all three real adapters required for the complete target.

The user also stated that the monetary budget for AI requests is not capped. The authoritative spending policy and the independent technical limits are in [agent limits and costs](docs/architecture/agent-workflow.md#limits-and-costs). This statement concerns API spending, not development effort.

The original timebox communicated in chat remains two calendar days and no more than five hours of active work; no replacement effort budget was specified. The supplied assignment PDF does not state this limit, but its chat origin does not cancel it. The full scope has no validated five-hour estimate. The previous 280 + 20 minute breakdown applied to a single source without authentication, a database, or a queue, and no longer applies. Retaining the full scope is not evidence that it fits this timebox or authorization to silently exceed it.

Record actual time per stage during implementation. If the active-work limit is reached, explicitly list working modes, unverified integrations, and unmet requirements. No reduced subset is automatically treated as the completed full project. Do not replace the real model with a scripted response without a label, or describe demo as verification of a real tracker. Implementation is authorized through S02 by the current request; later stages remain outside this task.

Scope and non-scope are defined in the [product specification](docs/product/overview.md#scope). The roadmap tracks delivery order, statuses, and budget rather than defining additional product requirements.

## S01 implementation and verification — 2026-11-11

Foundation/authentication implementation is present: three workspaces and exact lockfile, Compose and isolated development/test storage, complete foundational Prisma schema/SQL constraints, password + email OTP, JWT/rotating refresh/CSRF/logout, coordinated browser recovery, reference theme and protected shell. No tracker adapter, job execution, SSE, or self-review was added.

Verified: clean installation, check (including lint, Prisma, public/client/test types and theme validation), 23 unit tests, 18 integration tests on real isolated Postgres 18.6/Redis 8.4.8, build, audit (zero known vulnerabilities), and Compose migration/API/worker health. Chromium 157 manual checks passed for Compose on localhost:3001 and Vite on localhost:5173, including actual SMTP/Mailpit, two tabs/account switch, keyboard, direct reload, and 375px navigation.

S01 is **done** as of 2026-11-11 at the user's explicit request. The user accepted the working interface and confirmed that port 3000 works, closing the earlier host-port issue. Earlier assistant checks used localhost:3001 because port 3000 was occupied at that time; this history is retained in the verification notes below. External SMTP is not live-verified; tracker/OpenAI checks are outside S01.

The assistant's narrow-screen Sidebar/Sheet interaction check remains unverified because the viewport override did not change the observed viewport. This is retained as a verification limitation rather than recorded as passed; the user explicitly requested closing S01. Earlier responsive results do not verify the replacement navigation.

Actual foundation work: approximately **70 active minutes** counted conservatively against the 300-minute total. The timestamped implementation/verification window was 15:41–16:46 UTC (65 minutes), including dependency/build waits; initial specification reading preceded the first timestamp and is included in the rounded estimate. At that checkpoint approximately 230 minutes remained; subsequent work is recorded below. Later stages have not started.

## Code-style integration — 2026-11-11

The user authorized the previously discussed documentation, formatter/linter integration, and source reorganization. Added [common](docs/codestyle/common.md), [frontend](docs/codestyle/frontend.md), [backend](docs/codestyle/backend.md), and [contracts](docs/codestyle/contracts.md) guides with AGENTS/navigation links; pinned Prettier and React/Prettier ESLint tooling; included formatting and zero-warning lint in `check`; applied the agreed React component/page/template layout and Nest module/category layout. Public routes, HTTP schemas, and authentication semantics are retained.

Passed: `npm run check`, 23 unit tests, isolated test migrations, 18 real-Postgres/Redis integration tests, `npm run build`, documentation link/anchor validation, and `git diff --check`. Manual in-app browser checks passed for registration/login, real local Mailpit delivery, wrong/resend/replaced OTP codes, keyboard submission/skip focus, protected routes/reload, and two-tab sign-in/sign-out. Responsive re-verification at 375px could not be established because the viewport capability left the actual browser at 1677px; this is recorded as unverified. No stage status changed and no later-stage implementation started.

Additional work: approximately **30 minutes**, conservatively counted from the observed 16:50–17:20 UTC window including installation, verification, and approval waits. Cumulative effort is approximately **100 of 300 minutes**, leaving approximately **200 minutes** in the original active-work budget. This is not an estimate that the remaining full scope fits that budget.

### Backend modules-directory follow-up — 2026-11-11

Moved AppModule, WorkerModule, and the auth feature into `backend/src/modules/`, updated relative ESM imports and the owning filesystem documentation. The user narrowed verification to backend startup, so no further tests were started; check/build and an already-dispatched unit run had completed before that clarification. The freshly built API started on localhost:3002 and both health/readiness endpoints returned HTTP 200, including actual local Postgres/Redis readiness. No stage status changed.

This follow-up adds approximately **4 minutes** of work, conservatively including verification and documentation. Cumulative effort is approximately **104 of 300 minutes**, leaving approximately **196 minutes** in the original budget.

### Errors, exception filters, and shared follow-up — 2026-11-11

Added the requested separate backend directories: `errors/` for application error classes, `exceptions/` for Nest exception filters, and `shared/` for reusable infrastructure. Split Failure and SafeErrorsFilter; moved common configuration, the database factory, and mail transport into shared; updated imports and owning documentation. No tests or migrations were run, following the user's retained startup-only instruction. The backend build passed, the current API started on localhost:3002, and health/readiness returned HTTP 200 with actual local Postgres/Redis connectivity. No stage status changed.

Approximately **4 additional minutes** were conservatively counted for this follow-up. Cumulative effort is approximately **108 of 300 minutes**, leaving approximately **192 minutes** in the original budget.

### Backend dependency-injection migration — 2026-11-11

Replaced AppModule/AuthModule dynamic registration and bootstrap-built service instances with static Nest modules and injectable services. Added custom ConfigService with the existing Zod environment validation, a static ConfigModule/InfrastructureModule, and DI-managed database, Redis, mail, and clock providers. Auth initialization, global exception filtering, worker readiness, and resource cleanup use Nest module/provider lifecycle. Existing integration setup now overrides providers in a test-only helper instead of passing dependencies to production initialization. Updated architecture and backend coding rules.

Passed: backend build, backend source/test typechecking, backend ESLint, root formatting check, compiled API startup with health/readiness HTTP 200, and worker startup/readiness. Both temporary processes stopped through Nest shutdown hooks; the worker readiness marker was removed. Tests and migrations were not executed, following the user's retained instruction. No stage status changed.

Approximately **11 additional minutes** were conservatively counted from 17:45 UTC for implementation, verification, and documentation. Cumulative effort is approximately **119 of 300 minutes**, leaving approximately **181 minutes** in the original budget.

### Descriptive names and type prefixes — 2026-11-11

Replaced single-character bindings throughout maintained backend/frontend/contracts source, existing tests, scripts, and configuration. Added `T`/`I`/`E` declaration prefixes and descriptive generic names, updated public inferred contract aliases and all consumers, and enforced the policy through ESLint and the owning style guides. Runtime payloads and validation are retained.

Passed: `npm run check`, the full workspace build, final zero-warning lint/formatting and frontend build, static declaration inventory, documentation links/anchors, and `git diff --check`. The freshly compiled API started on localhost:3002; health/readiness both returned HTTP 200 with actual Postgres/Redis connectivity. The temporary API was stopped. No tests or migrations were executed, following the user's retained instruction. No stage status changed.

Approximately **11 additional minutes** were conservatively counted from 20:28 UTC for implementation, verification, and documentation. Cumulative effort is approximately **130 of 300 minutes**, leaving approximately **170 minutes** in the original budget.

### Shared configuration and infrastructure modules — 2026-11-11

Moved ConfigModule beside ConfigService into `backend/src/shared/config/config.module.ts` and InfrastructureModule into `backend/src/shared/infrastructure/infrastructure.module.ts`. Updated AuthModule/WorkerModule imports, README, architecture, and the backend filesystem guide: root/feature modules live under `modules/`, while reusable technical modules live under `shared/` with their owning responsibilities.

Passed: backend build, backend source/test typechecking, backend ESLint with zero warnings, changed-source formatting, documentation links/anchors, and `git diff --check`. The freshly compiled API started on localhost:3002; health and readiness returned HTTP 200 with local Postgres/Redis connectivity, then the temporary API was stopped. No tests or migrations were executed. No stage status changed.

Approximately **3 additional minutes** were conservatively counted from 20:43 UTC. Cumulative effort is approximately **133 of 300 minutes**, leaving approximately **167 minutes** in the original budget.

### Auth cryptography and password services — 2026-11-11

Extracted CryptoService and PasswordHashService into `backend/src/modules/auth/services/` and registered both as AuthModule providers. CryptoService injects ConfigService/ClockService and owns JWT/CSRF plus auth crypto helpers. PasswordHashService owns Argon2id, dummy-hash lifecycle, and the existing four-operation process-local concurrency limit. AuthService/ChallengesService delegate to the new services; the old crypto helper file was removed. Existing JWT/CSRF unit cases were moved/adapted, and integration fixture references were updated without executing tests. Updated the owning backend style and architecture documents.

Passed: backend build, backend source/test typechecking, zero-warning backend ESLint, and `npm run check` including committed formatting, all workspace types, lint, Prisma schema validation and theme checks. The freshly compiled API started on localhost:3002; health/readiness returned HTTP 200 with actual local Postgres/Redis connectivity. The temporary API was then stopped through its shutdown hooks. Tests and migrations were not executed, retaining the previously requested verification scope. No stage status changed.

Approximately **10 additional minutes** were conservatively counted from 20:51 UTC for implementation, checks, startup and documentation. Cumulative effort is approximately **143 of 300 minutes**, leaving approximately **157 minutes** in the original active-work budget.

### Module-local test directories — 2026-11-11

Moved the auth CryptoService unit cases into `backend/src/modules/auth/tests/crypto.service.test.ts` and the configuration unit cases into `backend/src/shared/config/tests/config.schema.test.ts`, keeping local tests inside their owning feature/technical module. Updated relative imports and the common/backend style guides. Production services remain in their service directories; cross-module HTTP/persistence integration tests remain in `backend/test/`. Existing Vitest discovery and TypeScript include/exclude patterns cover the new paths without configuration changes.

Passed: `npm run check` including formatting, all workspace/test types, zero-warning lint, Prisma validation and theme checks; documentation links/anchors and `git diff --check`. Tests and migrations were not executed. Production application behavior was not changed, so no additional startup run was needed. No stage status changed.

Approximately **3 additional minutes** were conservatively counted from 21:01 UTC. Cumulative effort is approximately **146 of 300 minutes**, leaving approximately **154 minutes** in the original budget.

### Standard Nest HTTP exceptions — 2026-11-11

Replaced Failure with standard Nest exceptions across authentication, OTP, password hashing, and input validation. Expected failures carry the existing explicit public `{code,message,retryable}` payload. SafeErrorsFilter validates HttpException responses against the strict contracts error schema, preserves recognized public fields/status, adds requestId and retains generic redacted fallbacks for unstructured HTTP and unknown infrastructure errors. Logout now catches only UnauthorizedException while resolving expired/missing access; infrastructure errors continue propagating. Existing direct exception assertions were adapted to Nest response payloads. Updated README, architecture and backend style; removed failure.error.ts.

Passed: backend build, backend source/test typechecking, `npm run check` (format, all workspace types, zero-warning lint, Prisma validation, theme checks), documentation links/anchors and `git diff --check`. Fresh API startup on localhost:3002 succeeded; health/readiness returned HTTP 200. HTTP smoke confirmed ACCESS_MISSING/401, INPUT_INVALID/400, ORIGIN_INVALID/403, generic unknown-route HTTP_ERROR/404, and redacted malformed-JSON HTTP_ERROR/400. These checks created no accounts or sessions. The temporary API was stopped. Test suites and migrations were not executed, retaining the user's verification scope. No stage status changed.

Approximately **7 additional minutes** were conservatively counted from 21:30 UTC. Cumulative effort is approximately **153 of 300 minutes**, leaving approximately **147 minutes** in the original budget.

### Shared HTTP error codes and messages — 2026-11-11

Added browser-safe `HTTP_ERROR_CODE` and `HTTP_ERROR_MESSAGE` catalogs to the public contracts package, plus inferred `THttpErrorCode`/`TApiError` types. Backend exception payloads, the redacting filter, early Origin responses, and frontend access recovery use the shared constants. Named contextual message variants preserve existing supported response copy. OTP Lua outcomes map explicitly to known codes; unexpected outcomes become redacted infrastructure failures. The response schema still accepts unknown string codes/messages for client compatibility, and existing boundary tests retain literal wire expectations. Updated architecture and code-style ownership rules.

Passed: `npm run check`, `npm run build`, documentation links/anchors, and `git diff --check`. The newly compiled API started on localhost:3002 with real local Postgres/Redis readiness. Non-mutating HTTP smoke verified exact codes/messages for ACCESS_MISSING/401, REFRESH_INVALID/401, INPUT_INVALID/400, ORIGIN_INVALID/403, OTP_INVALID/401, unknown-route HTTP_ERROR/404 and malformed-JSON HTTP_ERROR/400, including public-schema validation and redaction. The temporary API was stopped. Test suites, migrations, and browser interactions were not rerun, following the retained verification scope. No stage status changed.

Approximately **7 additional minutes** were conservatively counted from 21:44 UTC. Cumulative effort is approximately **160 of 300 minutes**, leaving approximately **140 minutes** in the original budget.

### Readable backend import aliases — 2026-11-11

Added private extensionless `@app/...` imports resolving to `backend/src/`; converted 66 cross-directory imports in 21 maintained source/test files. Sibling imports retain `./name.js`, and integration-only helpers retain relative paths. Added ESLint restrictions and owning code-style rules. TypeScript/tsx and both Vitest configurations resolve the same alias; backend build runs newly pinned `tsc-alias` 1.9.10 after `tsc` to emit ordinary relative `.js` imports for Node ESM. Updated architecture, D01, the root lockfile, and the contracts guide's relative-import wording. No application behavior or workspace boundary changed.

Passed: `npm run check`, `npm run build`, npm installation/audit (zero known vulnerabilities), positive/negative ESLint import-rule checks, alias resolution in both Vitest configurations without executing test files, and inspection of 26 compiled application files for resolved existing `.js` imports. Compiled API and source API through `tsx` both started on localhost:3002 with health/readiness HTTP 200 against local Postgres/Redis; the compiled worker reached readiness. Temporary processes were stopped. Documentation links/anchors and `git diff --check` passed. Test suites, migrations, browser interactions, and a new Compose image build were not run. No stage status changed.

Approximately **7 additional minutes** were conservatively counted from 21:51 UTC. Cumulative effort is approximately **167 of 300 minutes**, leaving approximately **133 minutes** in the original budget.

### Frontend and contracts import aliases — 2026-11-11

Extended workspace-local `@app/...` to frontend and contracts. Converted 29 frontend imports in 12 files and four contracts entrypoint re-exports; updated frontend TypeScript/Vite/shadcn configuration and shared ESLint restrictions. Contracts uses the existing pinned `tsc-alias` 1.9.10 after compilation for both JavaScript and declarations. Unit configuration now defines backend/frontend/contracts Vitest projects with isolated aliases and inherited SWC settings; the integration alias remains backend-scoped. Updated architecture and owning code-style/D01 documentation. No later-stage behavior was added.

Passed: `npm run check`, `npm run build`, installation/audit (zero known vulnerabilities), positive/negative ESLint import-rule checks, initialization/resolution of all three unit projects and the integration configuration without executing tests, and direct Node ESM import of the public contracts package. Emitted contracts JS/declarations contain no private aliases. The frontend JS/CSS bundle hashes are unchanged from the previous build. Compiled API health/readiness, `/login`, and both frontend assets returned HTTP 200; the temporary API was stopped. Documentation links/anchors and `git diff --check` passed. Test suites, migrations, browser interactions, and a new Compose build were not run. No stage status changed.

Approximately **7 additional minutes** were conservatively counted from 21:59 UTC. Cumulative effort is approximately **174 of 300 minutes**, leaving approximately **126 minutes** in the original budget.

### Tailwind layouts and shadcn composition — 2026-11-11

Removed global screen/component selectors from globals.css; it now owns reference/semantic variables, Tailwind mappings, and base rules. Layouts/forms use utility classes and shadcn Card/Label/Input/Button/Alert, with a shared AuthPanel. AppShell now composes the official shadcn Sidebar/SidebarInset and its mobile Sheet, with application navigation/account actions in local AppSidebar. Generated Sheet/Tooltip/Separator/Skeleton/media-query code was adapted to project placement, naming, existing helpers/primitives and the reference theme; lucide-react 1.72.0 is pinned. Updated the frontend styling rules, architecture and D01. Authentication/session business logic and later-stage scope remain unchanged.

Passed: `npm run check`, full workspace build and the final frontend build; npm audit (zero known vulnerabilities); real browser registration → local SMTP/Mailpit → wrong OTP → correct OTP/Enter → protected shell, Projects navigation/reload, desktop sidebar collapse/expand, skip-link focus, and logout. No browser console warnings/errors were observed during those desktop checks. The rebuilt Compose API/UI on localhost:3001 is healthy and serves the current JS/CSS; no migrations or storage resets ran. The temporary 127.0.0.1:3002 API was stopped. Documentation links/anchors and `git diff --check` passed. Test suites were not executed under the retained verification scope. Vite reports a non-failing ~519 kB JS chunk warning.

Mobile Sheet opening/Escape/focus return and narrow form/overflow checks remain **unverified**: a requested 375px viewport stayed 1202px, and a new tab stayed 1280px. The override was reset. S01 was still in_progress at this verification checkpoint; the later user acceptance closes it as done while retaining the assistant's mobile verification limitation.

Approximately **22 additional minutes** were conservatively counted from 22:09 UTC for implementation, installation/build waits, and manual verification. Cumulative effort is approximately **196 of 300 minutes**, leaving approximately **104 minutes** in the original budget.

S01 closure documentation adds approximately **2 minutes** from 23:06 UTC. The user confirmed that port 3000 works and explicitly requested Done; the stage heading, roadmap status, and current verification notes now agree. Documentation links/anchors and `git diff --check` passed; no application tests or migrations were rerun for this status-only change. Cumulative effort is approximately **198 of 300 minutes**, leaving approximately **102 minutes**. Later stages remain planned.

### JobRun trigger simplification — 2026-11-11

Replaced the separate automatic-review parent relation with trigger=manual/automatic (manual by default), retaining sourceSyncRunId/reviewRuns. Prepared a separate transactional migration without modifying the applied foundation migration: validate that legacy automatic parents match their sources, backfill automatic triggers, remove the old foreign key/column, and add a CHECK plus a partial unique source index for automatic reviews across all states. Manual regeneration remains allowed under the existing idempotency/activity-slot rules. Updated architecture, sync workflow, D05, and S02/S05 verification requirements. Removed stale links after the separate S01 verification journal was removed, retaining the recorded outcomes in this roadmap. Added a real-storage integration case for defaults, repeated manual reviews, duplicate automatic review after failure, concurrent automatic inserts, independent source snapshots, and invalid trigger/type/source combinations.

Passed: `npm run check`, full workspace build, compiled API startup on localhost:3002 with health/readiness HTTP 200 against local Postgres/Redis, documentation links/anchors, and `git diff --check`. The temporary API was stopped. Test bodies and migrations were **not executed**, retaining the user's verification scope; migration backfill and database enforcement therefore remain unverified at runtime. The SQL migration must be applied before using trigger in persisted jobs. Existing jobs/SSE execution remains S02 work; this change does not start that stage. S01 stays done and later-stage statuses are unchanged.

Approximately **8 additional minutes** were conservatively counted from 23:10 UTC. Cumulative effort is approximately **206 of 300 minutes**, leaving approximately **94 minutes** in the original budget.

## S02 implementation and verification — 2026-11-11–12

Status: **in_progress**. S01 was done before this work; its prepared JobRun trigger migration was applied successfully to isolated test storage. The user authorized S02 only and explicitly requested continuing without a live OpenAI key while leaving the stage unfinished. S03–S06 remain planned.

Implemented the owned fixture connection/catalog and direct project API; strict sync/review commands with canonical idempotency fingerprints and a shared project activity slot; BullMQ concurrency=1, atomic queued→running claim, attempts=1/maxStalledCount=0, heartbeat/deadline reconciliation and enqueue-gap recovery; immutable task/comment snapshots; deterministic 10-task analysis/review leaves and shrinking reduction; persisted SSE with JWT expiry; the official OpenAI SDK client and an explicitly scripted offline client through the same dispatcher; source/excerpt validation, bounded tools/requests/usage, attempt journals and safe traces; automatic/manual ReviewService, atomic report publication/current-pointer switch, selected refresh with copied/stale provenance, and saved JSON/Markdown export.

UI now includes fixture connections, a paginated project catalog/history/task table, real persisted progress, saved task/comment details, selected-refresh confirmation, partial-source acknowledgment, report citations/usage/export, and paginated safe traces. It reuses the S01 theme and Sheet; task tables scroll inside the reference reading column. Query keys include the user and resource. The one SSE recovery path deduplicates versions, reads current state, stops on inaccessible/terminal resources, and bounds transient retries to 1/2/4 seconds without submitting another command.

Passed on current source: `npm run check` (formatter, all source/test types, zero-warning lint, Prisma and theme/contrast validation), **34 unit tests**, **30 HTTP/storage/worker integration tests** on real isolated Postgres/Redis/BullMQ, and `npm run build`. The initial two auth regression failures caused by startup reconciliation against intentionally unavailable storage were fixed; the entire suite subsequently passed. The previously unexecuted trigger migration/storage constraints now pass runtime integration checks. SDK 7.55.0 installation audited 798 packages with zero known vulnerabilities. Local Markdown links/anchors and `git diff --check` passed.

Verified offline boundaries include: 6 saved project tasks and 5 Anna review tasks; 137 saved tasks, 14 sync/review leaves and the final batch in reduction; mandatory list/details and programmed comment versus description-only evidence paths; exact-source/reducer quotation checks and out-of-batch tool denial; duplicate delivery/concurrent command replay, changed-body/project conflicts and enqueue-gap recovery; generateReview=false/true; source-unique automatic review versus repeatable manual versions; failed model regeneration and actual SQL publication rollback preserving the old report; selected-only provider reads, copied dates and stale retention; labeled acknowledged partial review; empty sync/review without model calls; another user's project/task/report/job/SSE rejection; real SSE disconnect followed by completion and API restart with matching saved state. [Executed JSON, Markdown, and safe trace](docs/examples/README.md) are explicitly synthetic/offline artifacts.

SDK tests use synthetic HTTP responses to verify the exact pinned model, low reasoning, store=false, disabled parallel tools/retries, strict schemas, encrypted-reasoning/call-ID replay, request byte rejection, known token subsets, incomplete output under the unchanged 4096-token limit, and no automatic 401 retry. These tests do not establish live account access, real comment decisions, output quality, or usable real output under that limit.

Remaining acceptance checks: **live OpenAI** is unexecuted because OPENAI_API_KEY was absent; the user chose to leave it that way for this task. **Manual visual/interaction verification** is unexecuted: the computer-use inventory returned no browsers, and creating the in-app browser failed with “Browser is not available: iab.” Keyboard/Sheet focus, actual narrow-screen overflow/navigation, and two-tab auth/SSE interaction therefore remain unverified. A ~555 kB frontend chunk warning remains non-failing. S02 is not marked done.

Compose verification passed after rebuilding the final source on **localhost:3001**: migration completed; API/worker/Postgres/Redis/Mailpit are healthy. A separate HTTP smoke used actual Nodemailer→Mailpit delivery and a separate Compose worker process for synthetic signup→OTP→fixture catalog→sync→automatic review→saved tasks/report→deep-link HTML→logout. It returned succeeded sync/review, 6 saved tasks, 5 subject tasks, and explicitly unknown offline cost. Existing volumes were retained. The first build was stopped after ~14 minutes without progress at npm ci; a bounded-fetch rebuild succeeded. The optional infra startup encountered the already-occupied Mailpit port 8025; existing Postgres/Redis and the Compose Mailpit were used without resetting storage. No UI/browser outcome is inferred from this HTTP smoke.

Actual S02 implementation/verification window: **23:21 UTC on November 11 to approximately 00:16 UTC on November 12**, conservatively counted as **55 minutes** including dependency/build and approval waits. Cumulative effort is approximately **261 of 300 minutes**, leaving approximately **39 minutes** in the original active-work budget. The work did not start S03–S06 and does not imply that their remaining full scope fits that budget.

### Direct Nest exceptions follow-up — 2026-11-12

Removed the exported missing/conflict throwing helpers from JobsService and replaced their eight calls with explicit NotFoundException/ConflictException payloads. Replaced the four imported missing calls in ProjectsService with direct NotFoundException and removed that import. Status codes and public error fields are retained.

Passed: `npm run check`, backend build, manual comparison of all twelve replacements, absence of helper declarations/calls/imports, and `git diff --check`. Test suites, migrations, and Compose/browser checks were not rerun for this mechanical refactor. S02 remains in_progress.

Approximately **1 additional active minute**, conservatively rounded from the 12:18–12:19 UTC work window. Cumulative effort is approximately **262 of 300 minutes**, leaving approximately **38 minutes**.

### Agent run decomposition — 2026-11-12

Refactored AgentService.run into a short sequence: analyze all task batches, handle an empty selection, reduce the batch results, and parse the final stored output. Private analyzeTaskBatches handles scoped keyset pagination/progress; reduceBatchResults handles the shrinking reduction levels; reduceBatchGroup loads validated child claims and creates one reducer; executeBatch centralizes successful result persistence and failed-batch state. Batch sizes now reference the existing LIMITS values (10 tasks / 4 children). Removed the redundant second empty-page check. The model/tool loop and source-resolution implementation are byte-for-byte unchanged.

Passed: `npm run check`, 34 unit tests, 30 real isolated Postgres/Redis/BullMQ integration tests, full workspace build, manual comparison of persistence/coverage/error ordering, and `git diff --check`. Existing example artifacts were restored after the suite regenerated execution UUIDs. No migrations, Compose rebuild, browser checks, or live model requests were run for this refactor. S02 remains in_progress.

Approximately **2 additional active minutes**, conservatively rounded from the 12:31–12:33 UTC work window. Cumulative effort is approximately **264 of 300 minutes**, leaving approximately **36 minutes**.

Loop syntax follow-up (2026-11-12, 12:34–12:35 UTC): replaced `for (;;)` with equivalent `while (true)` in analyzeTaskBatches, retaining the existing empty-page break. `npm run check` and `git diff --check` passed; tests/build were not rerun for this syntax-only change. Approximately **1 minute** conservatively counted; cumulative effort is approximately **265 of 300 minutes**, leaving approximately **35 minutes**. S02 remains in_progress.


### Agent unit decomposition — 2026-11-12

Refactored AgentService.unit into a bounded attempt loop over an explicit per-unit IUnitContext. Private methods now own context/source preparation, prerequisite checks and durable attempt reservation, model submission/usage recording, response-history handling, one output correction, tool dispatch with individual list/details/comments handlers, comment persistence, bounded source exposure, result/evidence validation, failed-attempt tracing, and temporary transport retry. Scope, history, counters, memoization, and deadlines remain confined to one unit. The existing run/batch orchestration and cited-task resolution are retained exactly; model configuration, tool/output schemas, persistence ordering, limits, and retry rules are retained.

Passed: `npm run check`, **34 unit tests**, **34 HTTP/storage/worker integration tests** on real isolated Postgres/Redis/BullMQ, full workspace build, manual before/after review, and `git diff --check`. Four added integration cases verify reservation before submission, required tools and opaque reasoning/phase/call-ID replay after a temporary failure without trace exposure; one incomplete-output correction retaining known usage; cached comment calls consuming the tool budget with a single provider read; and the token threshold preventing the next request/reservation. Existing executed example artifacts were retained after the suite regenerated temporary execution UUIDs. No migrations, Compose/browser verification, or live OpenAI requests were performed for this backend refactor. S02 remains in_progress.

Approximately **6 additional active minutes**, conservatively rounded from the 12:44–12:50 UTC implementation/verification window. Cumulative effort is approximately **271 of 300 minutes**, leaving approximately **29 minutes**.


### JobsService decomposition — 2026-11-12

Split command acceptance into sync/selected-task/review scope resolution, canonical request fingerprinting, transactional acceptance, idempotency-key lookup, activity-slot validation, and concurrent unique-key recovery. Replaced the promise .catch chain with explicit try/catch. create now sequences those steps and enqueue; view delegates automatic-review lookup, counters, and result-reference selection. Related private command-data interfaces live in modules/jobs/jobs.interfaces.ts. Direct Nest exceptions are retained. Ownership checks, normalized fingerprints, project row-lock scope, replay-before-activity ordering, rollback-before-P2002 recovery, and public response fields are retained.

Passed: `npm run check`, **34 unit tests**, **36 HTTP/storage/worker integration tests** on real isolated Postgres/Redis/BullMQ, full workspace build, manual before/after review, absence of promise .catch in JobsService, and `git diff --check`. Added real-storage HTTP cases for concurrent selected-refresh replays with reordered/duplicated task IDs and for concurrent commands sharing an idempotency key across different projects (a temporary SQL trigger widens the insert race). Both cases preserve one accepted run. Existing example artifacts were retained after test execution. No migrations, Compose/browser checks, or live OpenAI calls were performed. S02 remains in_progress.

Approximately **4 additional active minutes**, conservatively rounded from the 12:53–12:57 UTC window. Cumulative effort is approximately **275 of 300 minutes**, leaving approximately **25 minutes**.


### ProcessorService decomposition — 2026-11-12

Split execution into atomic claim, heartbeat lifecycle, safe failure finalization, and terminal logging. sync now sequences full-period or selected-task import, coverage persistence, agent analysis, and completion. Private import methods separate paginated discovery, manifest persistence, per-task detail reads, selected-only refresh, transactional task/comment copying, and final source coverage. Completion separates publication from enqueue; terminal sync, SyncAnalysis insertion, and automatic-review creation still commit in one transaction before child enqueue. Replaced the detached heartbeat promise .catch with an async method using try/catch, and changed the two task-page loops to equivalent while(true) loops. Existing unit/batch limits are referenced through LIMITS. Scope, provenance, state/error fields, and failure behavior are retained.

Passed: `npm run check`, **34 unit tests**, **39 HTTP/storage/worker integration tests** on real isolated Postgres/Redis/BullMQ, full workspace build, manual before/after review, absence of promise .catch in ProcessorService, and `git diff --check`. Three added integration cases verify that one failed detail read does not skip the remaining tasks; an all-unavailable import fails before any model call; and automatic-review insertion failure rolls back the terminal sync/SyncAnalysis/child transaction while retaining imported tasks. The first integration attempt stopped during setup because self_review_test had no users table; `npm run db:migrate:test` successfully applied both committed migrations to that isolated database, and the repeated full suite passed. Existing generated examples and unrelated user edits were retained. No new migration, Compose rebuild, browser verification, or live OpenAI call was introduced. S02 remains in_progress.

Approximately **6 additional active minutes**, conservatively rounded from the 13:04–13:10 UTC window. Cumulative effort is approximately **281 of 300 minutes**, leaving approximately **19 minutes**.

### Docker/Vite registration diagnosis — 2026-11-12

Investigated signup returning 502 with Vite on localhost:5173 and the Compose API published on localhost:3001. Both direct and proxied API readiness returned 200. Mailpit was running and healthy but had no Docker network attachment; lookup of mailpit from API failed with ENOTFOUND, and Nodemailer verification returned EDNS. Recreated only the Compose mailpit service to restore its network and host-port bindings; Postgres, Redis, API, and worker were retained. No application source or configuration change was required.

Passed after recovery: SMTP verification from API, signup through the Vite proxy returning 201 with a local-delivery challenge, and retrieval of exactly one matching synthetic .invalid-recipient message through Mailpit on localhost:8025. The smoke did not verify OTP, create a completed account, or exercise the browser UI. Unauthenticated me/csrf 401 responses remain expected. S02 remains in_progress; live OpenAI and outstanding browser acceptance checks remain unverified.

Approximately **4 additional active minutes**, conservatively rounded from the 13:20–13:25 UTC diagnosis/verification window. Cumulative effort is approximately **285 of 300 minutes**, leaving approximately **15 minutes**.

### SMTP-aware Compose readiness — 2026-11-12

Added SMTP connectivity/authentication verification to API readiness alongside Postgres and Redis. The MailService transport exposes verify without sending a message, and the SMTP greeting timeout is bounded. Readiness returns a safe 503 on SMTP failure while liveness remains 200. Compose already waits for API health; `up --wait` now detects the previously missed API-to-Mailpit failure. This detects unavailable dependencies rather than automatically repairing a detached Docker endpoint. Historical Docker events no longer exposed the original Mailpit disconnection, so its initiating cause remains unknown. README documents waiting startup, Docker API/worker with Vite, consistent Compose project naming, and targeted Mailpit recovery; architecture records the readiness contract.

Passed: `npm run check`, **34 unit tests**, **40 HTTP/storage/worker integration tests** on isolated real Postgres/Redis/BullMQ, full workspace build, and `git diff --check`. The new HTTP case verifies SMTP outage/recovery, safe responses, retained liveness, and zero sent messages. Existing test migrations had no pending changes; only isolated Postgres/Redis were started, retaining the working Mailpit. Rebuilt the actual Compose image and completed `up -d --build --wait` with API on localhost:3001 and browser origin localhost:5173; a second ordinary `up -d --wait` also passed without recreating Mailpit. A separate process in the rebuilt API container with an unavailable SMTP hostname returned readiness 503/liveness 200, while the running API and Vite proxy both returned readiness 200. Existing volumes and executed example artifacts were retained. No browser checks or live OpenAI calls were performed; S02 remains in_progress.

Approximately **6 additional active minutes**, conservatively rounded from the 13:25–13:31 UTC implementation/verification window. Cumulative effort is approximately **291 of 300 minutes**, leaving approximately **9 minutes**.
