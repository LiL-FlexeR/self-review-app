# D01 — stack and infrastructure

Accepted 2026-11-11. Persistent accounts, project snapshots, background synchronization, and saved reports require database storage, authentication, and a queue. Current implementation and verification are tracked in the [ROADMAP](../../ROADMAP.md).

## Choice and alternatives

| Area | Choice | Alternative/consequence |
| --- | --- | --- |
| Backend | NestJS 12, Express adapter — confirmed | Nest recommends NodeAdapter from 12.3; Fastify is another supported adapter. Express remains the default and is selected for a familiar middleware setup; its performance has not been benchmarked for this project |
| Frontend | React 19.3, Vite 8, client SPA — confirmed | React/Vite fits the authenticated API-driven screens and static serving from Nest. Next.js also supports static export; its integrated server features are not required by the current workflow |
| Frontend data | TanStack Query with fetch — confirmed; native EventSource for SSE | Custom fetch hooks were considered. TanStack Query supplies server-state caching and invalidation; cache isolation, SSE refresh, and command behavior are defined in [architecture](../architecture/overview.md#frontend-data-flow) |
| Routing | React Router in Declarative mode — confirmed | It supplies client navigation and nested layouts alongside the chosen query layer. TanStack Router was considered for inferred route/search-param types; the simpler Declarative setup is sufficient for the planned screens |
| Styling and components | shadcn/ui + Tailwind CSS + a global theme stylesheet — confirmed | CSS Modules were considered. shadcn/ui supplies component source code that lives in frontend and can be customized; the project owns its maintenance and verifies accessibility after composition |
| Language and repository | TypeScript strict, ESM; backend, frontend, contracts at the root, targeting TypeScript 6 | The confirmed package layout supports shared public contracts. Separate repositories or another monorepo build tool add coordination work for this scope |
| Package manager | npm workspaces with one root package-lock.json — confirmed | pnpm was considered for its workspace and dependency-linking model. Use the pinned npm version consistently for development, CI, and Docker builds |
| Schemas | Zod — confirmed; target Zod 4, shared HTTP/SSE contracts, internal AI/provider schemas in backend | Zod provides runtime schemas and inferred types across browser/backend boundaries. class-validator DTOs were considered, but tool/result JSON schemas would need a separate integration approach |
| Data | PostgreSQL + Prisma — confirmed; target PostgreSQL 18 and Prisma ORM 7 with the pg adapter | Prisma's schema and generated client suit the related account, connection, snapshot, and report records. Drizzle was considered for its TypeScript schema and SQL-oriented queries; both support versioned SQL migrations and require database integration tests |
| Async | BullMQ with Redis and a separate worker — confirmed; target Redis 8 + BullMQ 5 | pg-boss was considered as a Postgres-backed queue. BullMQ uses the existing Redis service and Nest integration; coordination with persisted JobRun state remains application code |
| Progress | Cookie-authenticated SSE, state in Postgres — confirmed | Bidirectional WebSocket communication is unnecessary; polling remains a GET fallback |
| Email | Nodemailer SMTP, local Mailpit by default, optional external SMTP configuration — confirmed | Mailpit makes the complete local OTP flow available without an email-provider account. External SMTP delivers to real inboxes but requires credentials and separate delivery verification |
| Verification | Vitest/SWC + Supertest + isolated Postgres/Redis — confirmed | Jest was considered as an alternative runner. Vitest aligns with Vite and current Nest ESM defaults; SWC must preserve Nest decorator metadata. HTTP integration covers the required workflow without browser automation |

Node.js: the supported 24 LTS line, minimum 24.15 for the Nest CLI. Docker base: Debian slim. The API and worker use one application image; the API serves the static frontend, keeping sessions and SSE on one origin. Services, API, and scripts: [architecture](../architecture/overview.md).

## Compatibility and reproducibility

Exact package versions belong in workspace manifests and the root [lockfile](../../package-lock.json); image tags/digests belong in [Dockerfile](../../Dockerfile), [Compose](../../compose.yaml), and [development Compose](../../compose.infra.yaml). Keep external dependencies pinned and use the committed npm version. Verify installation, build, and integration compatibility when changing them; documented minimums do not establish a tested dependency tree. Do not use `latest` in reproducible startup instructions.

- Preserve Prisma major 7 unless a separate compatibility review changes it. Use its PostgreSQL driver adapter, pinned consistently with CLI/client. Root-level migration/diff commands need `--config backend/prisma.config.ts`.
- Use Node Debian slim to avoid Alpine/native-dependency complications. Verify Argon2 and Prisma in the Docker build.
- Backend/contracts compile private aliases to ordinary relative `.js` imports using `tsc-alias`; production runs directly in Node ESM. Workspace-local alias and test-project rules are in the [architecture](../architecture/overview.md#code-structure) and code-style guides.
- Vitest/SWC must preserve Nest decorator metadata; test transformation does not replace typechecking. Redis persistence/memory settings and BullMQ options require real-storage verification under the [sync workflow](../architecture/sync-workflow.md).
- The shadcn generator configuration, source origins, and current theme adaptations are maintained in the [frontend guide](../codestyle/frontend.md#shadcnui-additions).
- Docker dependency downloads use zero fetch retries and a 30-second request timeout; these bound installation requests, not application jobs.

## References

The selection was checked against official documentation on 2026-11-10–11: [Nest compatibility](https://docs.nestjs.com/faq/versions), [HTTP adapters](https://docs.nestjs.com/techniques/performance), [Vitest/SWC](https://docs.nestjs.com/recipes/swc#vitest), [Node release policy](https://github.com/nodejs/Release#release-schedule), [React client setup](https://react.dev/learn/build-a-react-app-from-scratch), [Next.js static export](https://nextjs.org/docs/app/guides/static-exports), [Prisma 7 setup](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/introduction), [Drizzle migrations](https://orm.drizzle.team/docs/migrations), [BullMQ production guidance](https://docs.bullmq.io/guide/going-to-production), [pg-boss](https://github.com/timgit/pg-boss), [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview), [React Router modes](https://reactrouter.com/start/modes), [shadcn/ui](https://ui.shadcn.com/docs), [Tailwind/Vite](https://tailwindcss.com/docs/installation/using-vite), [npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/), [Zod](https://zod.dev/), [Nodemailer SMTP](https://nodemailer.com/smtp), and [Mailpit Docker](https://mailpit.axllent.org/docs/install/docker/). Dependency changes require a fresh compatibility check.

## Consequences

Accounts, projects, snapshots, and reports survive closing the browser. Migrations, authentication, queue recovery, ownership checks, and operational failures add implementation and maintenance cost. The effort budget is maintained only in the [ROADMAP](../../ROADMAP.md#budget).
