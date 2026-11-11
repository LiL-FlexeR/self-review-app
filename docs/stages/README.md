# Implementation stages

Implementation starts with a separate request. Sequence, budget, and current statuses are maintained only in the [ROADMAP](../../ROADMAP.md).

1. [S01 — foundation and login](S01-foundation.md).
2. [S02 — first end-to-end demo](S02-demo-vertical-slice.md).
3. [S03 — Linear](S03-linear-integration.md).
4. [S04 — ClickUp and Jira Cloud](S04-task-source-adapters.md).
5. [S05 — reliability and verification](S05-reliability-and-tests.md).
6. [S06 — submission](S06-submission.md).

## Execution rules

Start by reading the stage brief and authoritative specifications. Implement a complete outcome without adding adjacent scope. Update rules in their authoritative document and leave a reference here. Record significant alternatives/consequences in decisions.

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

In S01, integrate the chosen values into frontend/src/styles/globals.css, map them to semantic shadcn/ui variables, and expose the needed Tailwind utilities. Keep token values consistent across the reference representations and implemented theme. These documentation CSS files are inputs to that integration, not an already connected stylesheet or a requirement for a token-generation service. Later stages reuse the established theme. Verify the stage's screens against UX.md and the visual inputs, including loading/empty/error/partial states, keyboard/focus, contrast, and narrow layouts; record material deviations and actual manual results. This work adds no application code at the documentation stage.

## Delivery and verification rules

By the end of S02, the full user journey must work with fixtures and real OpenAI, and offline with a scripted model. Guardrails, owner checks, and source validation are included from the start; S05 expands verification and handles failures rather than introducing security for the first time.

Record actual time, status, and real command results in the ROADMAP. Offline checks do not replace a live smoke test. When API access is blocked, state explicitly what transport stubs verified and what was not run against an account. Do not mark a stage done merely because a document exists.

All npm/Compose commands refer to future tooling from the [architecture](../architecture/overview.md#commands). Scripts and containers do not exist yet. S01 first creates the scaffold/lockfile, then verifies npm ci. Integration tests always use a separate test database/Redis namespace rather than user data.

The user confirmed the full three-source delivery plan. S02 establishes the complete user journey early; S03/S04 then add all selected real sources, followed by reliability and submission verification. The active-work timebox and AI spending are separate policies in the [roadmap](../../ROADMAP.md#budget); the full scope still has no validated time estimate. Product boundaries are defined in the [product scope](../product/overview.md#scope). Each selected adapter requires real contract/live checks, rather than a “coming soon” UI card.
