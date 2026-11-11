# Self Review App

A web application for preparing developer self-reviews from Linear, ClickUp, and Jira Cloud tasks. Users connect task sources, synchronize a project, inspect saved tasks, and create a report with quotations and source references.

**Status: documentation only; the application has not been implemented yet.** The startup instructions below describe the intended implementation; the commands do not exist yet. Current stage statuses are maintained only in [ROADMAP](ROADMAP.md).

## Problem and users

Developers struggle to reconstruct their work before a review, while a task list alone does not explain outcomes or individual contributions. The application collects traceable material and exposes missing information. The primary user is a developer; an assignment evaluator follows the same workflow using synthetic data.

## Scope and non-scope

The target scope is a local application with email/password + OTP, personal API-token connections to three trackers, persisted project synchronization, task browsing, and source-backed self-review. It supports all accessible tasks in the selected creation period, automatic or manual review, and refresh of selected tasks.

Outside the MVP: OAuth, billing/team management, Git integration, scheduled or automatic incremental sync, a report editor/PDF export, account recovery, and production hosting. The [product specification](docs/product/overview.md#scope) owns the full boundaries and selection rules.

Business cases: prepare a review after project sync; refresh selected source tasks and regenerate a review; inspect sources and export an existing report without another model call.

## Supported workflow

1. Sign up or log in with an email and password, then enter the OTP from the email.
2. Add a task-source connection using a personal API token.
3. Find an accessible project in the combined source catalog.
4. Select a project and task-creation period, optionally enable "Create self-review after sync," and start synchronization.
5. Receive progress and results through SSE; source tasks and agent analysis are saved in Postgres.
6. Open the project and inspect tasks from the selected synchronization.
7. Obtain a self-review for the token owner automatically after sync or using the Review button. The button creates or updates the current report for the selected snapshot. Export Markdown/JSON.
8. If needed, select tasks and refresh only those tasks, carrying the remaining data into a new revision with its original retrieval timestamps.

All statuses are included. The period applies to createdAt, not to the dates when work actually happened. The current assignee does not prove individual contribution; completed status does not prove deployment. Full rules and scope: [product](docs/product/overview.md).

## Architecture

TypeScript, NestJS, React/Vite with shadcn/ui and Tailwind CSS, Zod; Postgres + Prisma, Redis + BullMQ, Docker Compose. The API accepts commands, a separate worker executes a bounded agent loop, and SSE delivers persisted state. Email uses SMTP; local messages go to Mailpit. Google login and OAuth connections are outside scope. The tracker API confirms the token owner; that ID is captured in the snapshot and determines the review subject.

The agent reads task lists and details, decides whether comments are needed based on their content, and returns validated analysis. Application code handles persistence. Self-review uses saved sources without contacting the tracker again; generateReview=true automatically invokes the same process as the Review button. A new valid version replaces the current report; an error preserves the previous report. [Architecture](docs/architecture/overview.md), [synchronization and SSE](docs/architecture/sync-workflow.md), [agent and examples](docs/architecture/agent-workflow.md).

After OTP, authentication uses an access JWT and rotating opaque refresh token in HttpOnly cookies. Postgres stores refresh-token hashes and session metadata; Redis serves OTP challenges, rate limits, and the queue. Logout revokes refresh and clears cookies; an already issued access JWT can remain valid until expiry. Lifetimes, renewal, CSRF, and this revocation trade-off are defined in [D04](docs/decisions/D04-auth-and-credentials.md#limits-and-sessions).

## Local startup — after implementation

Docker Engine/Desktop with Compose v2 is required. Development also requires a current Node.js 24 LTS patch, at least 24.15, and npm. Exact package and image versions will be pinned in S01.

Use a current browser with Web Locks support on localhost or HTTPS for coordinated token renewal across tabs. S01 records the verified browser/version.

```bash
cp .env.example .env
openssl rand -base64 32
openssl rand -base64 32
openssl rand -base64 32
docker compose up --build
```

Put the three independently generated values into AUTH_SECRET, JWT_SECRET, and TOKEN_ENCRYPTION_KEY in the local .env. Do not commit them. A one-shot migration service applies migrations before the API and worker start.

Application: [localhost:3000](http://localhost:3000). Local mailbox: [localhost:8025](http://localhost:8025). Sign up, open the message in Mailpit, and enter the OTP. Mailpit does not deliver messages to an external email inbox; configure an SMTP provider for actual delivery.

| APP_MODE | Data and model | External keys |
| --- | --- | --- |
| offline — default | Synthetic source and scripted model; the entire auth/DB/queue/SSE workflow is real | None |
| demo | Synthetic source + real OpenAI | OPENAI_API_KEY on the worker |
| live | Linear, ClickUp, Jira Cloud + OpenAI | OpenAI on the worker; tracker tokens are entered in the UI |

In the planned application, every mode requires email + password + OTP. Offline uses the same authentication/storage/queue path and clearly labels its scripted model. Full [configuration](docs/architecture/overview.md#modes-and-configuration) and [authentication and secret-handling rules](docs/decisions/D04-auth-and-credentials.md).

## Verification — after implementation

```bash
npm ci
npm run infra:up
npm run db:migrate:test
npm run check
npm run test:unit
npm run test:integration
npm run build
```

Planned integration tests cover registration/OTP, authenticated execution, the queue, the agent with a model substitute, snapshot persistence, SSE, and self-review using isolated Postgres/Redis. External accounts are not required. The planned [tooling](docs/architecture/overview.md#commands) is created in S01.

Manual check: log in using an OTP from Mailpit → demo connection → Demo Platform → October 2026 → synchronization → SSE result → saved tasks → Review for the token owner (Anna in demo) → source and both exports. Close the page during sync and reopen it: the database determines the result, not the presence of an SSE connection. Full acceptance criteria: [S05](docs/stages/S05-reliability-and-tests.md), [S06](docs/stages/S06-submission.md).

## Example result

Planned example, not output from an actual execution:

> A comment on DEMO-101 reports that p95 decreased from 1200 to 900 ms on staging, based on 1000 requests. Production impact and individual contribution are not confirmed.
>
> DEMO-102 describes retries and is in progress. Canceled DEMO-103 is not treated as a completed achievement.

[Input, tool calls, expected JSON, and invariants](docs/architecture/agent-workflow.md#example-run).

## Limitations and business status

**Not in production today.** Potential users include product teams with regular reviews, platform teams collecting technical outcomes, and agencies preparing individual project reports.

The application stores snapshots, not the tracker's full event history. "All tasks" means all accessible tasks in the selected project and period: there is no task-count cap, and pagination runs to completion. Import, analysis, and self-review operate in batches; incomplete coverage is shown explicitly. A correct quotation does not guarantee a correct interpretation. Individual contribution, rollout, and business impact are not inferred automatically from a ticket.

The main trade-offs are a custom orchestrator over the OpenAI SDK with application-owned limits, retries, and traces; manually entered API tokens instead of OAuth; and current snapshots instead of historical attribution. Batch processing bounds each operation, while total time and cost grow with volume. Details and alternatives: [decisions](docs/README.md#decisions).

Production would require operational monitoring and alerts, backups and key rotation, OAuth connections, account recovery, broader evaluations, cost monitoring, and queue recovery procedures. A person must inspect the draft and its evidence before using it. Teams must authorize data access and transmission to the model provider, define retention/deletion and redaction policies, and review applicable privacy, contractual, and compliance requirements. These are production prerequisites, not implemented guarantees.

The user confirmed the full scope: foundation, an end-to-end demo with a real model, all three real adapters, reliability verification, and submission preparation. AI-request spending has no configured monetary ceiling, while technical safeguards and actual-usage accounting remain in place under [agent limits and costs](docs/architecture/agent-workflow.md#limits-and-costs). This does not change the original active-work timebox; the full scope has no validated estimate within it. [Roadmap and effort budget](ROADMAP.md#budget).

## Documentation

[Navigation](docs/README.md) · [Roadmap](ROADMAP.md) · [UX](docs/design/UX.md) · [Visual reference](docs/design/DESIGN.md)

The documentation was checked against the supplied assignment on 2026-11-11. [Assignment coverage and requirement origins](docs/README.md#assignment-coverage) distinguish the original brief from project decisions made in chat. Before submission, update the README using only actual implementation results.
