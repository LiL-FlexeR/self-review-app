# Implementation stages

Stage briefs define implementation scope and acceptance criteria; work follows the user's authorized scope. Sequence, budget, and current statuses are maintained only in the [ROADMAP](../../ROADMAP.md).

1. [S01 — foundation and login](S01-foundation.md).
2. [S02 — first end-to-end demo](S02-demo-vertical-slice.md).
3. [S03 — Linear](S03-linear-integration.md).
4. [S04 — ClickUp and Jira Cloud](S04-task-source-adapters.md).
5. [S05 — reliability and verification](S05-reliability-and-tests.md).
6. [S06 — submission](S06-submission.md).

## Execution rules

Start by reading the stage brief and authoritative specifications. Implement a complete outcome without adding adjacent scope. Update rules in their authoritative document and link to them. Keep significant decisions and consequences in decisions; follow [documentation maintenance](../../AGENTS.md#documentation-maintenance) when updating these files.

## Frontend design inputs

Before implementing or changing frontend UI, or verifying its appearance and interactions, read all five sources below. Every stage brief links here so an individually supplied stage still identifies the required design context. Backend-only changes do not require visual implementation work.

| Source | Responsibility |
| --- | --- |
| [UX.md](../design/UX.md) | Application screens, navigation, interactions, messages, responsive behavior, and accessibility |
| [DESIGN.md](../design/DESIGN.md) | Visual reference: composition, surfaces, visual hierarchy, density, and component treatment |
| [tokens.json](../design/tokens.json) | Machine-readable baseline values for the token categories it contains |
| [variables.css](../design/variables.css) | Reference CSS custom properties and layout variables for applying the tokens |
| [theme.css](../design/theme.css) | Reference Tailwind theme declarations to adapt to the frontend build |

Product behavior and API/authentication rules remain in their authoritative specifications; UX.md translates them into screens. Apply the visual reference to those project screens and the agreed scope. When representations differ, use valid tokens.json entries as the baseline for shared numeric/color tokens, DESIGN.md for visual intent, and UX.md for interactions/readability. Reconcile invalid or contradictory values explicitly in the affected sources before adopting them; record adaptations instead of silently inventing replacements. Reference font names do not imply bundled fonts: use the approved fallback stack when assets are absent.

The implemented theme lives in frontend/src/styles/globals.css, mapping the reference values to semantic shadcn/ui variables and Tailwind utilities. Keep reference representations and implemented tokens consistent; the documentation CSS files are design inputs. Reuse the established theme and verify affected screens against UX.md and the visual inputs, including loading/empty/error/partial states, keyboard/focus, contrast, and narrow layouts. Keep material design adaptations in the owning guide and the latest manual verification in ROADMAP.

## Delivery and verification rules

By the end of S02, the full user journey must work with fixtures and real OpenAI, and offline with a scripted model. Guardrails, owner checks, and source validation are included from the start; S05 expands verification and handles failures rather than introducing security for the first time.

Update the cumulative effort total, latest verification, and open acceptance checks in ROADMAP in place; keep task-level command details in the response or PR. Offline checks do not replace a live smoke test. State what transport stubs verified and what was not run against an account. Stage briefs retain acceptance criteria, without implementation journals or duplicate statuses.

Available npm/Compose commands are described in the [architecture](../architecture/overview.md#commands) and [startup instructions](../../README.md#local-startup). Integration tests always use a separate test database/Redis namespace rather than user data.

Product boundaries are defined in the [product scope](../product/overview.md#scope). Each selected adapter requires real contract/live checks. Effort and AI-spending policies are linked from the [roadmap budget](../../ROADMAP.md#budget).
