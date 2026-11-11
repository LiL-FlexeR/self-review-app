---
name: self-review-ui
description: Implement or review Self Review App React screens, navigation, shadcn/ui theme, TanStack Query state, browser authentication recovery, and SSE interactions. Applies to visual or interaction verification as well as UI changes; combine with auth or sync for shared behavior.
---

# Application interface

## Read before UI work

Read all five [frontend design inputs](../../../docs/stages/README.md#frontend-design-inputs):

- [UX.md](../../../docs/design/UX.md): screens, transitions, messages, responsive behavior, and accessibility.
- [DESIGN.md](../../../docs/design/DESIGN.md): visual composition and component treatment.
- [tokens.json](../../../docs/design/tokens.json): baseline shared numeric/color values.
- [variables.css](../../../docs/design/variables.css): reference CSS properties and layout values.
- [theme.css](../../../docs/design/theme.css): reference Tailwind theme declarations.

Read Frontend routing, Frontend UI, Frontend data flow, and the relevant API contracts in [architecture](../../../docs/architecture/overview.md). Read the current stage brief. Use [D04](../../../docs/decisions/D04-auth-and-credentials.md) with the auth skill for session behavior, and [sync workflow](../../../docs/architecture/sync-workflow.md) with the sync skill for jobs/streams.

## Implement the screen and its states

1. Map the requested change to the UX journey and persisted API resources. Keep the application account distinct from the tracker token owner and report subject. Use the existing React Router Declarative layout and established components.
2. In S01, integrate tokens into `frontend/src/styles/globals.css`, semantic shadcn/ui variables, and Tailwind utilities. Later changes reuse that theme. Resolve invalid/conflicting token representations explicitly; use the approved fallback fonts when reference fonts are unavailable, and record material adaptations.
3. Keep server data in TanStack Query with user/resource-scoped keys, forms/selection in local React state, and public payload validation in contracts. Client navigation and deep-link reloads must preserve API/asset error responses rather than routing them into SPA HTML.
4. Map loading, empty, validation, inaccessible, infrastructure failure, and partial states explicitly. Show actual persisted progress/coverage, source freshness, and separate sync/review outcomes rather than invented percentages or generic completion.
5. For mutations, require the explicit user action, preserve idempotency keys, and disable automatic job-start retries. SSE terminal events invalidate saved-data queries; query refresh and stream reconnect never start model work.

For access recovery, use one shared coordinator following architecture: same-origin Web Locks for identity-sensitive transitions, BroadcastChannel account-change signals, and at most the documented same-session replay. Refresh itself is not automatically retried. Account changes must cancel pending reads/replays, clear caches, and close streams before another account's data appears. Do not persist the query cache or put access/refresh tokens in browser-readable storage.

For SSE, use one bounded reconnect path coordinated with authentication and persisted GET state. Stop on terminal/inaccessible runs and provide the documented manual recovery after transient retries are exhausted. Accepted background work continues when the tab closes.

Render tracker/model text safely and activate only verified source-registry links. Preserve the old valid report during regeneration, require acknowledgment for partial-source review, and export saved Markdown/JSON without another model request.

## Verify interactions and appearance

- Use client unit tests for coordination, identity changes, cancellation/late responses, mutation replay, query invalidation, and SSE deduplication/recovery as affected. Use HTTP integration for the underlying workflow; browser automation is outside the agreed MVP.
- Manually check the changed screens against UX and the visual inputs: keyboard/focus, dialog focus, labels/status announcements, contrast/readability, narrow navigation, forms, and table overflow.
- For auth/stream changes, follow the two-tab/account-switch and close/reopen scenarios in [S06](../../../docs/stages/S06-submission.md). Distinguish an infrastructure failure from a definitive session rejection.
- Record actual observations and material design adaptations. Report specific checks that could not run; a build alone does not verify appearance or interactions. Follow root AGENTS.md stage checks.
