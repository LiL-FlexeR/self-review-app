# Working in Self Review App

This file guides development of the application. Domain skills are instructions for the coding assistant; they do not create separate agents or application services.

## Start with the requested outcome

- Read [ROADMAP.md](ROADMAP.md) for current implementation status, stage dependencies, and the active-work budget. Documentation and example commands are not proof that code or scripts exist.
- For implementation, read the relevant [stage brief](docs/stages/README.md) and the specifications it references. A documentation-only request does not start application implementation. Once implementation is requested, proceed within that authorized scope.
- Follow the user's current instructions. Preserve agreed product and stack decisions unless the user changes them; update the owning specification when an authorized change affects behavior.
- Keep normative rules in their owning documents. Skills explain how to work with those rules, rather than maintaining competing specifications.

## Specifications

| Concern | Source of truth |
| --- | --- |
| Scope, selection, review subject, interpretation | [Product](docs/product/overview.md) |
| Components, data model, HTTP/SSE contracts, frontend data flow | [Architecture](docs/architecture/overview.md) |
| Queue, idempotency, snapshots, SSE, report publication | [Sync workflow](docs/architecture/sync-workflow.md) |
| AI tools, evidence, batching, budgets, traces | [Agent workflow](docs/architecture/agent-workflow.md) and [D03](docs/decisions/D03-bounded-agent.md) |
| Stack and installation targets | [D01](docs/decisions/D01-stack-and-local-runtime.md) |
| Provider semantics and credentials | [D02](docs/decisions/D02-task-sources-and-selection.md) and [D04](docs/decisions/D04-auth-and-credentials.md) |
| Screens, visual inputs, theme precedence | [Frontend design inputs](docs/stages/README.md#frontend-design-inputs) |
| Verification and submission | [S05](docs/stages/S05-reliability-and-tests.md) and [S06](docs/stages/S06-submission.md) |

## Select project skills

Before working in one of these areas, read the linked skill. Load all applicable skills when a task crosses boundaries, and only the references needed for the task.

| Area | Skill |
| --- | --- |
| Password/OTP, sessions, CSRF, ownership, credential storage | [self-review-auth](.agents/skills/self-review-auth/SKILL.md) |
| Jobs, queue recovery, SSE, snapshots, selective refresh, report versions | [self-review-sync](.agents/skills/self-review-sync/SKILL.md) |
| Model calls, tool dispatch, prompts, source validation, AI usage | [self-review-agent](.agents/skills/self-review-agent/SKILL.md) |
| Linear, ClickUp, Jira, source discovery and normalization | [self-review-providers](.agents/skills/self-review-providers/SKILL.md) |
| React screens, routing, theme, query cache, browser recovery | [self-review-ui](.agents/skills/self-review-ui/SKILL.md) |

For example, browser token renewal uses auth + UI; SSE recovery uses sync + UI; provider credential replacement uses providers + auth. These responsibilities complement each other rather than assigning exclusive file ownership.

Project skills are stored in `.agents/skills/<name>/SKILL.md`. Paths in code spans inside skills are repository-relative; Markdown links resolve from the containing file. Keep automatic skill selection available. Use `openai-docs` for OpenAI API implementation and managed-runtime skills for environment-specific work when available; keep project skills usable through their linked specifications when those helpers are absent.

## Implementation and verification

- Follow the npm-workspace layout in D01 and architecture: `backend`, `frontend`, and browser-safe `contracts`, with one root lockfile. Confirm current compatible package versions during installation and record the pinned results.
- Preserve the offline/demo/live distinction. Synthetic fixtures and scripted model output must stay labeled; they do not verify live tracker or OpenAI access.
- Add boundary tests with the behavior being implemented. Follow the stage's required checks once tooling exists: `npm run check`, `npm run test:unit`, `npm run test:integration`, and `npm run build`. Prepare isolated test infrastructure/migrations as documented before integration checks.
- Use real isolated Postgres/Redis for concurrency, recovery, and persistence checks. Stub only the designated external provider/model/mail boundaries; do not replace the workflow with a prepared report.
- For frontend changes, read all five design inputs and record actual manual interaction/visual checks. Browser automation is outside the agreed MVP; HTTP integration and client unit tests provide automated coverage.
- For documentation or skill-only changes, verify local links, validate changed skill frontmatter, and run `git diff --check`. Application startup/tests are needed only when the change affects executable behavior.
- Keep secrets and private tracker content out of Git, fixtures, logs, model context, and job payloads. Use synthetic examples and safe error/trace fields.
- Record actual implementation time and stage verification in ROADMAP. Mark a stage done only after its acceptance criteria pass. Report unavailable live checks and remaining limitations explicitly; do not record planned commands as successful execution.
