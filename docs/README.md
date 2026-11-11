# Documentation

Architecture, implementation stages, and code-style guidance following the workflow clarifications. Current implementation status and actual verification are maintained in [ROADMAP](../ROADMAP.md).

## Navigation and authoritative specifications

| Document | Responsibility |
| --- | --- |
| [README](../README.md) | Evaluator entry point, startup, verification, examples, and business status |
| [Product](product/overview.md) | Users, workflow, scope, selection, and interpretation |
| [Architecture](architecture/overview.md) | Components, data model, API, configuration, and tooling |
| [Sync workflow](architecture/sync-workflow.md) | Queue, states, persistence, SSE, restart behavior, and idempotency |
| [Agent workflow](architecture/agent-workflow.md) | Model decisions, tools, JSON, sources, limits, and errors |
| [UX](design/UX.md) | Application screens, transitions, notifications, responsive behavior, and UI states |
| [Visual reference](design/DESIGN.md) | Visual style, composition, and component treatment |
| [Frontend design inputs](stages/README.md#frontend-design-inputs) | Required UX/style/token/CSS sources, precedence, and integration/verification rules |
| [Stages](stages/README.md) | Sequential implementation tasks and verifiable acceptance criteria |
| [Roadmap](../ROADMAP.md) | Current statuses and budget position |
| [Common code style](codestyle/common.md) | Shared readability, formatting, naming, imports, tests, and enforcement |
| [Frontend code style](codestyle/frontend.md) | React component/page/template layout and local/shared types |
| [Backend code style](codestyle/backend.md) | NestJS module/file layout and service/controller conventions |
| [Contracts code style](codestyle/contracts.md) | Public schema/type files and exports |

Do not duplicate normative tables across documents: link to the specification that owns the rule. Short explanations in the README and stage tasks do not replace the specifications.

## Decisions

- [D01 — stack and infrastructure](decisions/D01-stack-and-local-runtime.md): Nest, React/Vite, Postgres/Prisma, Redis/BullMQ, Compose, and SMTP.
- [D02 — sources and selection](decisions/D02-task-sources-and-selection.md): Linear, ClickUp List, Jira Cloud; API tokens; createdAt and current snapshots.
- [D03 — bounded agent](decisions/D03-bounded-agent.md): research during sync, separate database-backed self-review, validation, and cost controls.
- [D04 — authentication and secrets](decisions/D04-auth-and-credentials.md): email/password + email OTP, JWT access, rotating refresh hashes in Postgres, owner isolation, and credential storage.
- [D05 — sync, review, and refresh](decisions/D05-sync-review-and-refresh.md): generateReview, the token-owner subject, selective resync, and safe report replacement.
- [D06 — all tasks in the period](decisions/D06-all-period-tasks-and-batches.md): complete import without a count cap, batch analysis, and review reduction.

## Assignment coverage

Source: the two-page **AI Developer — Test Assignment**, supplied by the user as a PDF. Reviewed on 2026-11-11. It requires a small working business workflow, multi-step agent orchestration, at least two tools, JSON plus a human-readable summary, errors/guardrails, observability, basic unit tests and one integration/e2e test, and a public repository with the specified README and examples. A custom orchestrator is explicitly permitted; framework choice needs justification.

Project choices made in chat include email/password + OTP, personal API tokens, three trackers, Postgres, Redis, Docker, SSE, selected-task refresh, report versions, and processing all tasks in the selected period. The PDF does not mandate those technologies or features. Their scope is owned by the [product specification](product/overview.md); the chat timebox is recorded in the [roadmap](../ROADMAP.md#budget).

| Requirement | Authoritative specification | Planned verification |
| --- | --- | --- |
| Complete business workflow, scope, and business cases | [Product](product/overview.md), [README](../README.md) | S02, S06 |
| Multi-step orchestration and at least two useful tools | [Agent workflow](architecture/agent-workflow.md) | S02, S05 |
| Justified orchestration choice | [D03](decisions/D03-bounded-agent.md) | S02 |
| Structured JSON and human-readable summary | [Agent workflow](architecture/agent-workflow.md#json-result) | S02, S05 |
| Retries, invalid input handling, refusal, and injection boundaries | [Agent workflow](architecture/agent-workflow.md), [Sync workflow](architecture/sync-workflow.md) | S02, S05 |
| Tool logs/traces and a final decision summary | [Agent workflow](architecture/agent-workflow.md#tracing) | S02, S05 |
| Basic unit tests and at least one integration/e2e test | [S05](stages/S05-reliability-and-tests.md) | S01–S05 |
| Example inputs and expected outputs | [Agent example](architecture/agent-workflow.md#example-run) | S02, S05, S06 |
| README, local setup, manual verification, and public source repository | [README](../README.md), [S06](stages/S06-submission.md) | S06 |
| Real-world usage, realistic teams, and production prerequisites | [README](../README.md#limitations-and-business-status) | S06 |

This matrix records specification coverage, not completed functionality. Product thinking, engineering quality, reliability, clarity, and practicality must ultimately be assessed from working code, tests, and demonstration evidence.

OAuth is used neither for login nor for trackers. Password and OTP authentication is required in local demo/offline too. Synchronization does not filter by developer; self-review describes the confirmed token owner of the selected connection. It runs automatically through generateReview or manually through Review. Manual resync refreshes selected tasks, while review uses the entire resulting snapshot for its subject.

The document organization is inspired by Career Evidence; the code and architecture are independent. Current delivery status is maintained only in the roadmap.
