# D01 — stack and infrastructure

Date: 2026-11-10. This revision replaces the original decision without a database, authentication, or queue. The user explicitly requested Postgres, Redis, and Docker; background sync and saved projects give them concrete roles. The application has not been implemented yet.

## Confirmation status

Accepted as an architecture decision on 2026-11-11, including npm workspaces with one root package-lock.json. The agreed choices are recorded in the table below. TypeScript strict/ESM and the described build layout are implementation defaults for this stack. Acceptance does not mean the application is implemented: version lines remain installation targets, and S01 must pin exact versions and verify the dependency tree, build, and integration setup.

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

Node.js: current patch of 24 LTS, minimum 24.15 for the Nest CLI. Docker base: Debian slim. The API and worker use one application image; the API serves the static frontend, keeping sessions and SSE on one origin. Services, API, and scripts: [architecture](../architecture/overview.md).

## Currency check

Read on 2026-11-10:

- [Nest compatibility](https://docs.nestjs.com/faq/versions), [migration guide](https://docs.nestjs.com/migration-guide), [testing](https://docs.nestjs.com/fundamentals/testing), [SWC](https://docs.nestjs.com/recipes/swc#vitest): selected release line, CLI requirements, and Vitest/decorator metadata.
- [Node schedule](https://github.com/nodejs/Release#release-schedule), [React](https://react.dev/versions), [Vite 8](https://vite.dev/blog/announcing-vite8), [Zod](https://zod.dev/): supported release lines. Node 24 is Maintenance LTS, not the latest Active LTS.
- [Prisma 7 requirements](https://www.prisma.io/docs/orm/v7/reference/system-requirements) and [client setup](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/introduction): Node 24, TypeScript >=5.4, ESM/client generation. The installation target remains Prisma 7; a major-version change requires a separate compatibility review.
- [Postgres version policy](https://www.postgresql.org/support/versioning/): stable, supported 18; use the current minor version.
- [BullMQ](https://docs.bullmq.io/guide/going-to-production), [Nest SSE](https://docs.nestjs.com/http/server-sent-events), [Mailpit Docker](https://mailpit.axllent.org/docs/install/docker/): the queue, SSE, and local SMTP fit their selected roles.

Rechecked on 2026-11-11: [Nest HTTP adapters](https://docs.nestjs.com/techniques/performance) confirms the Express default and the NodeAdapter recommendation from 12.3. [React client-app setup](https://react.dev/learn/build-a-react-app-from-scratch) describes Vite and the need to select routing/data-fetching separately; [Next.js static export](https://nextjs.org/docs/app/guides/static-exports) confirms that Next.js can also run as static assets without a separate application server.

Data-access comparison checked on 2026-11-11: the planned [Prisma 7 client setup](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/introduction) requires client generation and a PostgreSQL driver adapter, while [Prisma Migrate](https://www.prisma.io/docs/orm/v7/prisma-migrate) generates editable SQL migration files. [Drizzle PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql) and [migration workflows](https://orm.drizzle.team/docs/migrations) document its driver integration and TypeScript-schema-to-SQL migration path.

Validation comparison checked on 2026-11-11: [Nest validation](https://docs.nestjs.com/techniques/validation) supports class-validator DTOs through ValidationPipe and schema libraries through StandardSchemaValidationPipe. [Zod](https://zod.dev/) documents runtime parsing, inferred types, browser/Node support, and JSON Schema conversion; [class-validator](https://github.com/typestack/class-validator) documents its class/decorator validation model.

Queue comparison checked on 2026-11-11: [BullMQ Nest integration](https://docs.bullmq.io/guide/nestjs/) documents the Nest module and processors; [BullMQ persistence guidance](https://docs.bullmq.io/guide/going-to-production) covers Redis persistence and memory policy. [pg-boss](https://github.com/timgit/pg-boss) provides a Postgres-backed job queue. The selected BullMQ backend is Redis; queue delivery does not replace the application-level claim, attempt journal, and recovery rules in [sync workflow](../architecture/sync-workflow.md).

Email comparison checked on 2026-11-11: [Mailpit Docker](https://mailpit.axllent.org/docs/install/docker/) documents a local SMTP server and browser mailbox, while [Nodemailer SMTP](https://nodemailer.com/smtp) supports configurable SMTP transport. OTP content, delivery failures, and authentication behavior are owned by [D04](D04-auth-and-credentials.md).

Test tooling checked on 2026-11-11: [Nest testing](https://docs.nestjs.com/fundamentals/testing) documents its testing container and Supertest integration. [Nest Vitest/SWC setup](https://docs.nestjs.com/recipes/swc#vitest) describes the current ESM default and backend test transformation; [Vitest](https://vitest.dev/guide/) documents its Vite-based runner, and [Jest](https://jestjs.io/docs/getting-started) remains an alternative. Runtime metadata, module resolution, and test infrastructure must be verified in S01.

Frontend data comparison checked on 2026-11-11: [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview) manages server state while allowing fetch as the request function. Its [defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults) include background refetch/retry behavior, and [invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations) coordinates refresh after changes. Job-start mutations and SSE-triggered reads must respect the application idempotency and paid-execution rules.

Routing comparison checked on 2026-11-11: [React Router modes](https://reactrouter.com/start/modes) describes Declarative mode for URL-to-component routing when data state has its own abstraction, and its [Vite setup](https://reactrouter.com/start/declarative/installation) uses BrowserRouter. [TanStack Router](https://tanstack.com/router/latest/docs/overview) documents inferred route types, search-param validation, and integration with client data caches.

UI choice checked on 2026-11-11: [shadcn/ui](https://ui.shadcn.com/docs) distributes editable component source. Its [Vite setup](https://ui.shadcn.com/docs/installation/vite) supports an existing application, and [theming](https://ui.shadcn.com/docs/theming) uses semantic CSS variables. [Tailwind with Vite](https://tailwindcss.com/docs/installation/using-vite) documents the styling build plugin. S01 pins the CLI/preset, component source origins, and installed dependencies for the existing frontend workspace.

Package-manager comparison checked on 2026-11-11: [npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/) manages linked local packages through the root package.json. [pnpm workspaces](https://pnpm.io/workspaces) uses pnpm-workspace.yaml and supports explicit local workspace dependencies; its [dependency layout](https://pnpm.io/motivation) provides direct-dependency isolation. Either choice requires a pinned manager version and a committed root lockfile in S01.

Pin exact package patch/minor versions and Docker tags/digests in S01 and verify a clean installation, build, and integration test. Compatible minimum requirements do not equal a tested dependency tree. Do not use latest in reproducible startup instructions. Confirm the Redis version/settings and BullMQ options against the selected lockfile and smoke tests; containers have not been run yet.

## Consequences

The result is a persistent product: accounts, projects, data, and results survive closing the browser. The cost is migrations, authentication, a queue, ownership checks, operational errors, and substantially larger scope. The previous five-hour plan does not carry over to this architecture; the current budget status is in the [ROADMAP](../../ROADMAP.md#budget).
