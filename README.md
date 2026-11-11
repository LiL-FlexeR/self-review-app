# Self Review App

A web application for preparing developer self-reviews from Linear, ClickUp, and Jira Cloud tasks. Users connect task sources, synchronize a project, inspect saved tasks, and create a report with quotations and source references.

S01 provides the npm workspaces, Docker infrastructure, Prisma schema/migration, email/password + OTP authentication, coordinated session renewal, and protected UI shell. Tracker connections, queue execution, snapshots/SSE, and self-review are future stages. Current stage status and actual verification are maintained in [ROADMAP](ROADMAP.md) and the [S01 stage brief](docs/stages/S01-foundation.md).

## Problem and users

Developers struggle to reconstruct their work before a review, while a task list alone does not explain outcomes or individual contributions. The application collects traceable material and exposes missing information. The primary user is a developer; an assignment evaluator follows the same workflow using synthetic data.

## Scope and non-scope

The target scope is a local application with email/password + OTP, personal API-token connections to three trackers, persisted project synchronization, task browsing, and source-backed self-review. It supports all accessible tasks in the selected creation period, automatic or manual review, and refresh of selected tasks.

Outside the MVP: OAuth, billing/team management, Git integration, scheduled or automatic incremental sync, a report editor/PDF export, account recovery, and production hosting. The [product specification](docs/product/overview.md#scope) owns the full boundaries and selection rules.

Business cases: prepare a review after project sync; refresh selected source tasks and regenerate a review; inspect sources and export an existing report without another model call.

## Target workflow (S02–S06)

1. Sign up or log in with an email and password, then enter the OTP from the email.
2. Add a task-source connection using a personal API token.
3. Find an accessible project in the combined source catalog.
4. Select a project and task-creation period, optionally enable "Create self-review after sync," and start synchronization.
5. Receive progress and results through SSE; source tasks and agent analysis are saved in Postgres.
6. Open the project and inspect tasks from the selected synchronization.
7. Obtain a self-review for the token owner automatically after sync or using the Review button. The button creates or updates the current report for the selected snapshot. Export Markdown/JSON.
8. If needed, select tasks and refresh only those tasks, carrying the remaining data into a new revision with its original retrieval timestamps.

All statuses are included. The period applies to createdAt, not to the dates when work actually happened. The current assignee does not prove individual contribution; completed status does not prove deployment. Full rules and scope: [product](docs/product/overview.md).

## Target architecture

TypeScript, NestJS, React/Vite with shadcn/ui and Tailwind CSS, Zod; Postgres + Prisma, Redis + BullMQ, Docker Compose. The API accepts commands, a separate worker executes a bounded agent loop, and SSE delivers persisted state. Email uses SMTP; local messages go to Mailpit. Google login and OAuth connections are outside scope. The tracker API confirms the token owner; that ID is captured in the snapshot and determines the review subject.

The agent reads task lists and details, decides whether comments are needed based on their content, and returns validated analysis. Application code handles persistence. Self-review uses saved sources without contacting the tracker again; generateReview=true automatically invokes the same process as the Review button. A new valid version replaces the current report; an error preserves the previous report. [Architecture](docs/architecture/overview.md), [synchronization and SSE](docs/architecture/sync-workflow.md), [agent and examples](docs/architecture/agent-workflow.md).

After OTP, authentication uses an access JWT and rotating opaque refresh token in HttpOnly cookies. Postgres stores refresh-token hashes and session metadata; Redis serves OTP challenges, rate limits, and the queue. Logout revokes refresh and clears cookies; an already issued access JWT can remain valid until expiry. Lifetimes, renewal, CSRF, and this revocation trade-off are defined in [D04](docs/decisions/D04-auth-and-credentials.md#limits-and-sessions).

## Local startup

Docker Engine/Desktop with Compose is required. Host development uses Node 24 LTS (at least 24.15, tested 24.16.0) and npm 11.13.0; the Docker image pins Node 24.22.2 and npm 11.13.0. Dependencies/images are recorded in [D01](docs/decisions/D01-stack-and-local-runtime.md#s01-installation-record--2026-11-11).

Use a browser with Web Locks on localhost/HTTPS. Tokens stay in HttpOnly cookies; CSRF and query state remain in memory.

```bash
npm run setup
docker compose up --build
```

`setup` creates a gitignored, mode-0600 `.env` with three independent random secrets, preserving an existing file. Alternatively copy `.env.example` and generate each secret independently with `openssl rand -base64 32`. Migration completes before API/worker startup. Never commit `.env`.

Open [localhost:3000](http://localhost:3000), create an account, open the email in [Mailpit :8025](http://localhost:8025), and enter the OTP. The Connections/Projects pages currently show explicit S01 empty states. Mailpit captures local messages; it does not deliver them to a real inbox. External SMTP is configurable but not live-verified.

If port 3000 is occupied, use `APP_PORT=3001 APP_ORIGIN=http://localhost:3001 docker compose up --build`, then open [localhost:3001](http://localhost:3001). Cookies require a consistent hostname; use localhost throughout. Stop with `docker compose down` (volumes retained). Compose and the development infrastructure share Mailpit ports, so stop one before starting the other.

For host/Vite development:

```bash
npm ci
npm run infra:up
node --env-file=.env node_modules/prisma/build/index.js migrate deploy --config backend/prisma.config.ts
APP_ORIGIN=http://localhost:5173 SMTP_HOST=localhost npm run dev
```

If the backend port is occupied, prefix the dev command with `PORT=3002 DEV_API_PORT=3002`; keep `APP_ORIGIN=http://localhost:5173`.

Open [localhost:5173](http://localhost:5173); Vite proxies `/api` to port 3000 without rewriting Origin. `DATABASE_URL` in the generated `.env` targets the loopback dev database. Test migration/test scripts always select a separate `self_review_test` DB, Redis DB 15, and `s01-test:` prefix. They never inherit user-data endpoints. `infra:down` stops without deleting volumes. A managed Linux executor may select its daemon with `SELF_REVIEW_DOCKER_HOST=unix:///var/run/docker.sock` for the infra scripts.

Future modes (only authentication and shell exist in S01):

| APP_MODE | Data and model | External keys |
| --- | --- | --- |
| offline — default | Synthetic source and scripted model; the entire auth/DB/queue/SSE workflow is real | None |
| demo | Synthetic source + real OpenAI | OPENAI_API_KEY on the worker |
| live | Linear, ClickUp, Jira Cloud + OpenAI | OpenAI on the worker; tracker tokens are entered in the UI |

In the planned application, every mode requires email + password + OTP. Offline uses the same authentication/storage/queue path and clearly labels its scripted model. Full [configuration](docs/architecture/overview.md#modes-and-configuration) and [authentication and secret-handling rules](docs/decisions/D04-auth-and-credentials.md).

## Code style

Read [common rules](docs/codestyle/common.md) and the relevant [frontend](docs/codestyle/frontend.md), [backend](docs/codestyle/backend.md), or [contracts](docs/codestyle/contracts.md) guide. React components use `ComponentName/index.tsx`; page-only components stay under their page, and shared composed blocks live in `components/templates/`. NestJS root modules and feature directories live in `backend/src/modules/`, with flat features or category folders as described in the backend guide. Reusable technical modules also belong in `backend/src/shared/`: ConfigModule lives beside ConfigService in `shared/config/`, and InfrastructureModule lives in `shared/infrastructure/`. Expected HTTP failures use standard Nest exceptions; the global filter in `backend/src/exceptions/` preserves the validated public error contract and redacts unknown errors.

```bash
npm run format
npm run format:check
npm run lint
```

The root formatter/linter configuration is shared across workspaces. `format` writes formatting; `format:check` and `lint` only check. `npm run check` includes both checks. File placement and logical blank lines are reviewed against the guides.

Backend services use [Nest dependency injection](docs/architecture/overview.md#backend-dependency-injection) with static modules. ConfigService validates the environment once; infrastructure services own database/Redis/mail initialization and shutdown. API/worker bootstraps use the module graph rather than manually constructing auth services.

## Verification

```bash
npm ci
npm run infra:up
npm run db:migrate:test
npm run check
npm run test:unit
npm run test:integration
npm run build
```

S01 tests cover authentication, actual Postgres/Redis concurrency and failures, SQL constraints, routing, and client session coordination. SMTP is substituted in integration tests; the browser smoke test uses real Nodemailer → Mailpit. No tracker or model requests are part of S01. The [verification notes](ROADMAP.md#s01-implementation-and-verification--2026-11-11) distinguishes actual results from unavailable checks.

Manual S01 check: signup → Mailpit → OTP → protected shell → open a second tab → sign out → confirm both tabs clear the account → sign in with password and a fresh OTP. Reload `/connections` or `/projects`; missing `/api` and asset paths retain 404 responses. Authentication expiry and competing refreshes are covered with a controlled test clock and real storage.

## Example result

Planned example, not output from an actual execution:

> A comment on DEMO-101 reports that p95 decreased from 1200 to 900 ms on staging, based on 1000 requests. Production impact and individual contribution are not confirmed.
>
> DEMO-102 describes retries and is in progress. Canceled DEMO-103 is not treated as a completed achievement.

[Input, tool calls, expected JSON, and invariants](docs/architecture/agent-workflow.md#example-run).

## Limitations and business status

**Not in production today.** Potential users include product teams with regular reviews, platform teams collecting technical outcomes, and agencies preparing individual project reports.

The planned complete application stores snapshots, not the tracker's full event history. "All tasks" means all accessible tasks in the selected project and period: there is no task-count cap, and pagination runs to completion. Import, analysis, and self-review operate in batches; incomplete coverage is shown explicitly. A correct quotation does not guarantee a correct interpretation. Individual contribution, rollout, and business impact are not inferred automatically from a ticket.

The main trade-offs are a custom orchestrator over the OpenAI SDK with application-owned limits, retries, and traces; manually entered API tokens instead of OAuth; and current snapshots instead of historical attribution. Batch processing bounds each operation, while total time and cost grow with volume. Details and alternatives: [decisions](docs/README.md#decisions).

Production would require operational monitoring and alerts, backups and key rotation, OAuth connections, account recovery, broader evaluations, cost monitoring, and queue recovery procedures. A person must inspect the draft and its evidence before using it. Teams must authorize data access and transmission to the model provider, define retention/deletion and redaction policies, and review applicable privacy, contractual, and compliance requirements. These are production prerequisites, not implemented guarantees.

The user confirmed the full scope: foundation, an end-to-end demo with a real model, all three real adapters, reliability verification, and submission preparation. AI-request spending has no configured monetary ceiling, while technical safeguards and actual-usage accounting remain in place under [agent limits and costs](docs/architecture/agent-workflow.md#limits-and-costs). This does not change the original active-work timebox; the full scope has no validated estimate within it. [Roadmap and effort budget](ROADMAP.md#budget).

## Documentation

[Navigation](docs/README.md) · [Roadmap](ROADMAP.md) · [UX](docs/design/UX.md) · [Visual reference](docs/design/DESIGN.md)

The documentation was checked against the supplied assignment on 2026-11-11. [Assignment coverage and requirement origins](docs/README.md#assignment-coverage) distinguish the original brief from project decisions made in chat. Before submission, update the README using only actual implementation results.
