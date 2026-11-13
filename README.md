# Self Review App

A web application for preparing developer self-reviews from Linear, ClickUp, and Jira Cloud tasks. Users connect task sources, synchronize a project, inspect saved tasks, and create a report with quotations and source references.

The local workflow supports synthetic tracker data in offline/demo modes and Linear, ClickUp and Jira Cloud token connections in live mode. Adapter acceptance, live-model verification, and remaining browser checks are tracked in the [ROADMAP](ROADMAP.md).

## Problem and users

Developers struggle to reconstruct their work before a review, while a task list alone does not explain outcomes or individual contributions. The application collects traceable material and exposes missing information. The primary user is a developer; an assignment evaluator follows the same workflow using synthetic data.

## Scope and non-scope

The target scope is a local application with email/password + OTP, personal API-token connections to three trackers, persisted project synchronization, task browsing, and source-backed self-review. It supports all accessible tasks in the selected creation period, automatic or manual review, and refresh of selected tasks.

Outside the MVP: OAuth, billing/team management, Git integration, scheduled or automatic incremental sync, a report editor/PDF export, account recovery, and production hosting. The [product specification](docs/product/overview.md#scope) owns the full boundaries and selection rules.

Business cases: prepare a review after project sync; refresh selected source tasks and regenerate a review; inspect sources and export an existing report without another model call.

## Architecture

TypeScript, NestJS, React/Vite with shadcn/ui and Tailwind CSS, Zod; Postgres + Prisma, Redis + BullMQ, Docker Compose. The API accepts commands, a separate worker executes the agent, and SSE delivers persisted state. The agent reads task lists/details and chooses useful comments; self-review uses saved evidence. JSON and Markdown come from the same validated result.

Design and trade-offs: [architecture](docs/architecture/overview.md), [sync workflow](docs/architecture/sync-workflow.md), [agent workflow](docs/architecture/agent-workflow.md), and [authentication](docs/decisions/D04-auth-and-credentials.md). The [product specification](docs/product/overview.md) owns selection, review-subject, and interpretation rules.

## Local startup

Docker Engine/Desktop with Compose is required. Host development requires Node 24 LTS (at least 24.15) and the npm version pinned in root package.json. Exact dependencies/images are pinned in manifests, the root lockfile, and Docker configuration; [D01](docs/decisions/D01-stack-and-local-runtime.md#compatibility-and-reproducibility) owns compatibility constraints, and [ROADMAP](ROADMAP.md#current-verification) records tested versions.

Use a browser with Web Locks on localhost/HTTPS. Tokens stay in HttpOnly cookies; CSRF and query state remain in memory.

```bash
git clone https://github.com/LiL-FlexeR/self-review-app.git
cd self-review-app
npm run setup
npm run docker:up
```

`setup` creates gitignored, mode-0600 `backend/.env` and `frontend/.env` from their workspace examples. Backend secrets are generated independently; existing workspace files are preserved. When upgrading, an existing root `.env` is moved unchanged to `backend/.env`, retaining signing/encryption keys and configured credentials. If both files exist, setup stops before overwriting either; resolve that duplicate explicitly. Alternatively copy both workspace `.env.example` files and generate each backend secret independently with `openssl rand -base64 32`. Never commit local env files. Migration completes before API/worker startup.

Docker configuration and helpers live in `backend/`; the image still builds all three workspaces from the repository root and Nest serves the built frontend. `npm run docker -- <arguments>` forwards commands to `backend/compose.yaml` using `backend/.env`, independently of the caller's Compose working directory. The default project names remain `self-review-app` and `self-review-infra`, preserving their existing Postgres/Redis volumes. If an installation used a custom project name, keep it with `npm run docker -- -p <existing-name> up -d --build --wait`. Stopping containers retains volumes; do not pass `--volumes` or `-v` when keeping data.

`backend/.env` owns server, database, queue, model and mail configuration. `frontend/.env` contains `DEV_API_PORT` for Vite's local `/api` proxy; it is not added to the browser bundle. Production browser requests use same-origin `/api`. Keep credentials in backend configuration; `VITE_` variables are browser-visible.

Open [localhost:3000](http://localhost:3000), create an account, open the email in [Mailpit :8025](http://localhost:8025), and enter the OTP. On Connections, choose **Add demo source**, browse Projects, and open **Demo platform**. Mailpit captures local messages; it does not deliver them to a real inbox. External SMTP is configurable but not live-verified.

If port 3000 is occupied, use `APP_PORT=3001 APP_ORIGIN=http://localhost:3001 npm run docker -- up --build`, then open [localhost:3001](http://localhost:3001). Cookies require a consistent hostname; use localhost throughout. Stop with `npm run docker:down` (volumes retained). Compose and the development infrastructure share Mailpit ports, so stop one before starting the other.

For host/Vite development, set `DEV_API_PORT=3000` in `frontend/.env` to match the default backend `PORT`. The frontend example uses 3001 for the Docker/Vite flow below.

```bash
npm ci
npm run infra:up
npm run db:migrate
APP_ORIGIN=http://localhost:5173 SMTP_HOST=localhost npm run dev
```

If the backend port is occupied, set `PORT=3002` in `backend/.env` and `DEV_API_PORT=3002` in `frontend/.env`; keep `APP_ORIGIN=http://localhost:5173` for the dev command. Shell environment overrides still take precedence.

Open [localhost:5173](http://localhost:5173); Vite proxies `/api` to `DEV_API_PORT` without rewriting Origin. `DATABASE_URL` in `backend/.env` targets the loopback dev database. Test migration/test scripts always select a separate `self_review_test` DB, Redis DB 15, and `s01-test:` prefix. They never inherit user-data endpoints. `infra:down` stops without deleting volumes. A managed Linux executor may select its daemon with `SELF_REVIEW_DOCKER_HOST=unix:///var/run/docker.sock` for the Docker/infra scripts.

For API/worker in Docker with the Vite frontend, stop the root `npm run dev` process and the separate development infrastructure first. Set `DEV_API_PORT=3001` in `frontend/.env`, then run:

```bash
APP_PORT=3001 APP_ORIGIN=http://localhost:5173 npm run docker:up
npm run build -w contracts
npm run dev -w frontend
```

The Compose project name remains `self-review-app` (`-p` if previously overridden). Open [localhost:5173](http://localhost:5173); browser requests to `/api` remain on that origin and Vite forwards them to the published API port. API code changes require a Compose rebuild. The API keeps port 3000 inside its container; APP_PORT changes only its host mapping.

`--wait` checks API readiness, including SMTP connectivity/authentication from the API container without sending a message. Mailpit's own healthcheck only checks its internal readiness; it does not prove that API can reach it. A readiness failure prevents reporting a successful startup, but does not automatically repair Docker networking or prove email delivery to a recipient. Inspect `npm run docker -- ps` and `npm run docker -- logs api mailpit`. If an existing Mailpit container has lost its Compose network attachment, recover just that service with `npm run docker -- up -d --force-recreate --no-deps --wait mailpit`, then repeat the startup command. This recreates Mailpit's temporary mailbox; Postgres/Redis volumes are retained.

Runtime modes:

| APP_MODE | Data and model | External keys |
| --- | --- | --- |
| offline — default | Synthetic source and scripted model; the entire auth/DB/queue/SSE workflow is real | None |
| demo | Synthetic source + real OpenAI | OPENAI_API_KEY on the worker |
| live | Linear, ClickUp or Jira Cloud + OpenAI; fixture creation is rejected | OpenAI on the worker; tracker credentials entered in the UI |

For Linear, set `APP_MODE=live` and `OPENAI_API_KEY` in the server `backend/.env`, then rebuild/recreate API and worker. After password + OTP, open Connections, enter a connection name and a personal Read key, and choose **Verify and connect**. Browse Projects and use **Load more projects** to reach later catalog pages, including accessible archived projects. Sync uses UTC task creation dates, every status and assignee; review uses only tasks assigned to the verified token owner. Replace a key only for the same Linear user and workspace. Confirmed connection deletion removes its local projects, snapshots and reports and is blocked while a job is active; it does not revoke the key in Linear. Never paste keys into chat or commit private tickets.

For ClickUp, enter a personal API token. The catalog shows Lists with workspace/Space/Folder breadcrumbs, including accessible archived containers. Sync explicitly requests closed tasks, subtasks, Tasks in Multiple Lists and accessible archived tasks; multiple assignees are retained. Review describes the API-confirmed token owner.

For Jira Cloud, enter the Atlassian account email, a **scoped** personal API token and the site's **cloudId**. Use the official [token setup](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/) and [cloudId lookup](https://support.atlassian.com/jira/kb/retrieve-my-atlassian-sites-cloud-id/) instructions. Grant read access to your profile, projects, issues and comments; server-info access enables browser links. Requests use the fixed Atlassian cloud gateway. If server-info is unavailable or its host is outside `*.atlassian.net`, saved internal citations still work and the UI warns that external links are unavailable. Standard Jira search does not guarantee archived issues. A replacement token must preserve the API-confirmed accountId and cloudId; switching sites requires explicit local connection deletion and a new connection.

Every mode requires email + password + OTP. Offline uses the same authentication/storage/queue path and clearly labels its scripted model. Full [configuration](docs/architecture/overview.md#modes-and-configuration) and [authentication and secret-handling rules](docs/decisions/D04-auth-and-credentials.md).

## Code style

Read [common rules](docs/codestyle/common.md) and the relevant [frontend](docs/codestyle/frontend.md), [backend](docs/codestyle/backend.md), or [contracts](docs/codestyle/contracts.md) guide for layout, naming, and imports.

```bash
npm run format
npm run format:check
npm run lint
```

`format` writes formatting; `format:check` and `lint` only check. Both checks are included in `npm run check`.

## Server logs

API and worker write Winston JSON logs. Read them with:

```bash
npm run docker -- logs -f api worker
```

Set `LOG_LEVEL=info` (default), `warn`, `error`, or `debug` in `backend/.env` and recreate API/worker to apply it. Correlate HTTP errors by `X-Request-Id`/`requestId` and worker events by `runId`/`batchId`. Validation diagnostics can contain bounded task/result text with credential redaction; the persisted owner trace stays compact. Event fields, redaction and logging boundaries are defined in [server logging](docs/architecture/overview.md#server-logging).

## Verification

If the main Compose application is already running, use `npm run infra:up -- postgres redis` to start only the isolated test storage services and avoid a second Mailpit on port 8025. The integration suite substitutes mail delivery.

```bash
npm ci
npm run infra:up
npm run db:migrate:test
npm run check
npm run test:unit
npm run test:integration
npm run build
```

Tests cover authentication, storage constraints, real BullMQ/Postgres/Redis execution, the 6/137-task cases, source validation, automatic/manual review, report rollback, selective refresh, ownership, enqueue-gap recovery, SSE disconnect/API restart, and client recovery. Integration substitutes SMTP and the external model/source boundaries. Provider transport/HTTP tests cover paginated catalogs/imports, exact UTC boundaries, scoped selected refresh, identity replacement, encrypted credentials, byte/time budgets and ownership. Linear cases include GraphQL HTTP 200 errors; ClickUp includes empty hierarchy traversal, archived/closed/subtask/TIML options and multiple assignees; Jira includes enhanced JQL continuation, ADF, safe-origin discovery and cloudId rotation restrictions. Shared evidence checks reject unfinished or unknown status categories as support for result/measurement claims. SDK tests use a synthetic HTTP transport and do not prove live OpenAI access. See [actual stage verification](ROADMAP.md).

[GitHub Actions](.github/workflows/verify.yaml) runs the same check, unit, integration and build sequence on pushes to `production`, pull requests and manual dispatch. It uses pinned Node/npm/actions and isolated Postgres/Redis; no OpenAI or tracker credentials are required. Local results and the hosted CI result are recorded independently in ROADMAP.

Manual S01 check: signup → Mailpit → OTP → protected shell → open a second tab → sign out → confirm both tabs clear the account → sign in with password and a fresh OTP. Reload `/connections` or `/projects`; missing `/api` and asset paths retain 404 responses. Authentication expiry and competing refreshes are covered with a controlled test clock and real storage.

## Evaluator walkthrough

1. Sign up, read the OTP in Mailpit, and enter it. Add the demo source on Connections.
2. Open Projects → Demo platform. Keep **2026-10-01–2026-10-31 (UTC)** and synchronize. The automatic-review checkbox starts unchecked.
3. Expect **6 saved tasks** across all assignees. Inspect a task's saved description/comments and the safe execution trace.
4. Choose **Create self-review**, or request automatic review on a new sync. The subject is **Anna / demo-anna**, with **5 qualifying tasks**. Export the saved JSON and Markdown.
5. Select DEMO-101 and **Refresh selected**. Confirm the base snapshot and optional review. A new snapshot contains one refreshed task and copies retaining original timestamps. Historical reports remain accessible through snapshot history.
6. Open **137-task pagination example**, synchronize, and browse every task page. All 137 tasks and 14 analysis leaves are processed; review reduction includes the last batch.
7. Close/reopen the project URL during work. Restart only the API with `npm run docker -- restart api`, then reopen the saved project URL. Saved data remains. Reconnect only reads persisted progress and does not start model work.
8. Open the same project in a second tab. Sign out in the first tab: both tabs must clear the account. Register/sign in as a second user with a new Mailpit OTP; the first user's connections, tasks and reports must not appear. Follow the complete [S06 manual scenario](docs/stages/S06-submission.md#evaluators-manual-scenario) for renewal, errors, keyboard and narrow-screen checks. Automated expiry/concurrency results and actual manual observations are recorded separately in ROADMAP.

Generation uses the configured model and can incur new usage. Opening/exporting never generates. Partial-source review requires explicit acknowledgment; failed regeneration preserves the old valid report.

For live-model verification, set `APP_MODE=demo` and `OPENAI_API_KEY` in the gitignored server `backend/.env`, then recreate API/worker. The pinned model is `gpt-5.4-mini-2026-03-17`, reasoning `low`, with no fallback. Repeat Demo platform and Description evidence example; inspect actual comment choices and quotations. See ROADMAP for the latest executed live-model checks and remaining limitations. Never put the key into a `VITE_` variable or a request body.

For Docker with Vite, apply these environment changes with `APP_PORT=3001 APP_ORIGIN=http://localhost:5173 npm run docker -- up -d --force-recreate --wait api worker`. Keep dependency startup enabled: `--no-deps` is appropriate only when Postgres, Redis, and Mailpit are already running and ready. OPENAI_MODEL must match the exact pinned snapshot above; other values fail configuration validation before startup.

## Example result

[Synthetic input](docs/examples/offline-input.json), [executed offline JSON](docs/examples/offline-review.json), [Markdown](docs/examples/offline-review.md), and [safe trace](docs/examples/offline-trace.json) come from the integration workflow with synthetic data and scripted model output. Their UUIDs identify that isolated test execution, not records in a user's database. Usage is explicitly unknown/scripted; this is not a live-model result. The [example guide](docs/examples/README.md) explains selection, expected invariants, regeneration, and how to assess real-model output.

[Executed OpenAI demo JSON](docs/examples/demo-review.json), [Markdown](docs/examples/demo-review.md), and [safe trace](docs/examples/demo-trace.json) use the same synthetic source with the real pinned model. The model chose no comments in this run; its output and known usage differ from the programmed offline example. All nine evidence pairs were checked against that saved snapshot. This verifies real model execution on synthetic material, not real delivery or business impact.

[Fixture inputs and acceptance invariants](docs/architecture/agent-workflow.md#example-run).

## Limitations and business status

**Not in production today.** Potential users include product teams with regular reviews, platform teams collecting technical outcomes, and agencies preparing individual project reports.

The application stores snapshots, not the tracker's full event history. "All tasks" means all accessible tasks in the selected project and period: there is no task-count cap, and pagination runs to completion. Import, analysis, and self-review operate in batches; incomplete coverage is shown explicitly. A correct quotation does not guarantee a correct interpretation. Individual contribution, rollout, and business impact are not inferred automatically from a ticket.

The main trade-offs are a custom orchestrator over the OpenAI SDK with application-owned limits, retries, and traces; manually entered API tokens instead of OAuth; and current snapshots instead of historical attribution. Batch processing bounds each operation, while total time and cost grow with volume. Details and alternatives: [decisions](docs/README.md#decisions).

Production would require operational monitoring and alerts, backups and key rotation, OAuth connections, account recovery, broader evaluations, cost monitoring, and queue recovery procedures. A person must inspect the draft and its evidence before using it. Teams must authorize data access and transmission to the model provider, define retention/deletion and redaction policies, and review applicable privacy, contractual, and compliance requirements. These are production prerequisites, not implemented guarantees.

## Documentation

[Navigation](docs/README.md) · [Roadmap](ROADMAP.md) · [UX](docs/design/UX.md) · [Visual reference](docs/design/DESIGN.md)

[Assignment coverage and requirement origins](docs/README.md#assignment-coverage) distinguish the supplied brief from additional project choices.
